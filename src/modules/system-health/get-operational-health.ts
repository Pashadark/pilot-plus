import 'server-only';

import { prisma } from '@/database/prisma/client';
import { isLibreOfficeAvailable } from '@/modules/rentals/documents/pdf/convert-docx-to-pdf';

import { assessHeartbeat, assessQueue, type OperationalHealthState } from './operational-health';

interface QueueSnapshot {
  pending: number;
  failed: number;
  oldestPendingAt: Date | null;
}

interface OperationalSnapshot {
  glonasssoft: {
    configuredCount: number;
    linkedVehicles: number;
    lastAttemptAt: Date | null;
    lastSuccessAt: Date | null;
    lastErrorCode: string | null;
  };
  rentalDocuments: QueueSnapshot & {
    libreOfficeAvailable: boolean;
    missingPdf: number;
  };
  returnMedia: QueueSnapshot;
  clientDocuments: QueueSnapshot;
  telegram: QueueSnapshot;
}

export interface OperationalHealthItem {
  key: 'glonasssoft' | 'rental-documents' | 'return-media' | 'client-documents' | 'telegram';
  label: string;
  description: string;
  status: OperationalHealthState;
  message: string;
  checkedAt: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  errorCode: string | null;
  metrics: Array<{ label: string; value: string }>;
}

type SnapshotLoader = () => Promise<OperationalSnapshot>;

function queueItem(
  key: OperationalHealthItem['key'],
  label: string,
  description: string,
  snapshot: QueueSnapshot,
  now: Date,
): OperationalHealthItem {
  const assessment = assessQueue({ ...snapshot, now });
  return {
    key,
    label,
    description,
    ...assessment,
    checkedAt: now.toISOString(),
    lastAttemptAt: snapshot.oldestPendingAt?.toISOString() ?? null,
    lastSuccessAt: null,
    errorCode: null,
    metrics: [
      { label: 'Ожидают', value: String(snapshot.pending) },
      { label: 'Ошибки', value: String(snapshot.failed) },
    ],
  };
}

function rentalDocumentsItem(
  snapshot: OperationalSnapshot['rentalDocuments'],
  now: Date,
): OperationalHealthItem {
  const item = queueItem(
    'rental-documents',
    'Договоры аренды',
    'Формирование и безопасная публикация DOCX/PDF.',
    snapshot,
    now,
  );
  item.metrics.push(
    { label: 'Без PDF', value: String(snapshot.missingPdf) },
    {
      label: 'LibreOffice',
      value: snapshot.libreOfficeAvailable ? 'Доступен' : 'Недоступен',
    },
  );
  if (!snapshot.libreOfficeAvailable) {
    return {
      ...item,
      status: 'unavailable',
      message: 'Конвертер PDF недоступен. Создание новых PDF остановлено.',
      errorCode: 'RENTAL_PDF_PIPELINE',
    };
  }
  if (snapshot.missingPdf > 0 && item.status === 'healthy') {
    return {
      ...item,
      status: 'degraded',
      message: `Договоров без PDF: ${snapshot.missingPdf}.`,
      errorCode: 'RENTAL_PDF_MISSING',
    };
  }
  return item;
}

export function createOperationalHealthLoader(loadSnapshot: SnapshotLoader, now: () => Date) {
  return async function getOperationalHealth(): Promise<OperationalHealthItem[]> {
    const snapshot = await loadSnapshot();
    const checkedAt = now();
    const heartbeat = assessHeartbeat({
      configured: snapshot.glonasssoft.configuredCount > 0,
      lastAttemptAt: snapshot.glonasssoft.lastAttemptAt,
      lastSuccessAt: snapshot.glonasssoft.lastSuccessAt,
      lastErrorCode: snapshot.glonasssoft.lastErrorCode,
      now: checkedAt,
    });

    return [
      {
        key: 'glonasssoft',
        label: 'GLONASSSoft',
        description: 'Свежие координаты и состояние связанных автомобилей.',
        ...heartbeat,
        checkedAt: checkedAt.toISOString(),
        lastAttemptAt: snapshot.glonasssoft.lastAttemptAt?.toISOString() ?? null,
        lastSuccessAt: snapshot.glonasssoft.lastSuccessAt?.toISOString() ?? null,
        errorCode: snapshot.glonasssoft.lastErrorCode,
        metrics: [
          { label: 'Интеграции', value: String(snapshot.glonasssoft.configuredCount) },
          { label: 'Автомобили', value: String(snapshot.glonasssoft.linkedVehicles) },
        ],
      },
      rentalDocumentsItem(snapshot.rentalDocuments, checkedAt),
      queueItem(
        'return-media',
        'Фото выдачи и возврата',
        'Проверка и сохранение материалов осмотра автомобиля.',
        snapshot.returnMedia,
        checkedAt,
      ),
      queueItem(
        'client-documents',
        'Документы клиентов',
        'Антивирусная проверка загруженных документов.',
        snapshot.clientDocuments,
        checkedAt,
      ),
      queueItem(
        'telegram',
        'Telegram-уведомления',
        'Очередь сообщений сотрудникам и клиентам.',
        snapshot.telegram,
        checkedAt,
      ),
    ];
  };
}

async function loadOperationalSnapshot(): Promise<OperationalSnapshot> {
  const [
    glonassAggregate,
    latestGlonass,
    linkedVehicles,
    rentalPending,
    rentalFailed,
    rentalOldest,
    rentalMissingPdf,
    libreOfficeAvailable,
    mediaPending,
    mediaFailed,
    mediaOldest,
    clientPending,
    clientFailed,
    clientOldest,
    telegramPending,
    telegramFailed,
    telegramOldest,
  ] = await Promise.all([
    prisma.telematicsIntegration.aggregate({
      where: { provider: 'GLONASSSOFT', enabled: true },
      _count: true,
      _max: { lastAttemptAt: true, lastSuccessAt: true },
    }),
    prisma.telematicsIntegration.findFirst({
      where: { provider: 'GLONASSSOFT', enabled: true },
      orderBy: { updatedAt: 'desc' },
      select: { lastErrorCode: true },
    }),
    prisma.telematicsVehicleLink.count({ where: { provider: 'GLONASSSOFT' } }),
    prisma.rentalDocumentGeneration.count({
      where: { status: { in: ['PENDING', 'PROMOTED', 'CLEANING'] } },
    }),
    prisma.rentalDocumentGeneration.count({ where: { status: 'ERROR' } }),
    prisma.rentalDocumentGeneration.findFirst({
      where: { status: { in: ['PENDING', 'PROMOTED', 'CLEANING'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.rental.count({
      where: {
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        documentVersions: { none: { format: 'PDF' } },
      },
    }),
    isLibreOfficeAvailable(),
    prisma.rentalOperationMedia.count({
      where: { status: { in: ['PENDING', 'SCANNING', 'CLEANING'] } },
    }),
    prisma.rentalOperationMedia.count({ where: { status: { in: ['ERROR', 'BLOCKED'] } } }),
    prisma.rentalOperationMedia.findFirst({
      where: { status: { in: ['PENDING', 'SCANNING', 'CLEANING'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.clientDocument.count({
      where: { archivedAt: null, status: { in: ['UPLOADING', 'PENDING'] } },
    }),
    prisma.clientDocument.count({
      where: { archivedAt: null, status: { in: ['ERROR', 'BLOCKED'] } },
    }),
    prisma.clientDocument.findFirst({
      where: { archivedAt: null, status: { in: ['UPLOADING', 'PENDING'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.botNotificationJob.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
    prisma.botNotificationJob.count({
      where: {
        status: 'ERROR',
        OR: [{ lastErrorCode: null }, { lastErrorCode: { not: 'SUPERSEDED_BY_CURRENT_REPORT' } }],
      },
    }),
    prisma.botNotificationJob.findFirst({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    glonasssoft: {
      configuredCount: glonassAggregate._count,
      linkedVehicles,
      lastAttemptAt: glonassAggregate._max.lastAttemptAt,
      lastSuccessAt: glonassAggregate._max.lastSuccessAt,
      lastErrorCode: latestGlonass?.lastErrorCode ?? null,
    },
    rentalDocuments: {
      pending: rentalPending,
      failed: rentalFailed,
      oldestPendingAt: rentalOldest?.createdAt ?? null,
      libreOfficeAvailable,
      missingPdf: rentalMissingPdf,
    },
    returnMedia: {
      pending: mediaPending,
      failed: mediaFailed,
      oldestPendingAt: mediaOldest?.createdAt ?? null,
    },
    clientDocuments: {
      pending: clientPending,
      failed: clientFailed,
      oldestPendingAt: clientOldest?.createdAt ?? null,
    },
    telegram: {
      pending: telegramPending,
      failed: telegramFailed,
      oldestPendingAt: telegramOldest?.createdAt ?? null,
    },
  };
}

export const getOperationalHealth = createOperationalHealthLoader(
  loadOperationalSnapshot,
  () => new Date(),
);
