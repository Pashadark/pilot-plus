import { blocker, readinessResult, type ReadinessResult } from './types';

type DocumentVersion = { version: number; scanVerdict: string | null };
type ClientDocument = {
  category: string;
  archivedAt: Date | string | null;
  currentVersion: number;
  versions: readonly DocumentVersion[];
};

export type ClientReadinessInput = {
  id: string;
  status: string;
  phone?: string | null;
  passport?: string | null;
  driverLicense?: string | null;
  driverLicenseExpiresAt?: Date | null;
  documents: readonly ClientDocument[];
};

function currentDocument(
  documents: readonly ClientDocument[],
  category: 'PASSPORT' | 'DRIVER_LICENSE',
) {
  return documents.find(
    (document) => document.archivedAt === null && document.category === category,
  );
}

function hasValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function evaluateClientReadiness(
  client: ClientReadinessInput,
  now = new Date(),
): ReadinessResult {
  const href = `/clients/${client.id}?tab=documents`;
  const issues = [];

  if (client.status === 'BLOCKED' || client.status === 'ARCHIVED') {
    issues.push(
      blocker(
        'CLIENT_STATUS_BLOCKED',
        'Клиент заблокирован или архивирован.',
        `/clients/${client.id}`,
      ),
    );
  }
  if (!hasValue(client.phone)) {
    issues.push(
      blocker(
        'CLIENT_PHONE_MISSING',
        'Укажите телефон клиента.',
        `/clients/${client.id}/edit#contacts`,
      ),
    );
  }
  if (!hasValue(client.passport)) {
    issues.push(
      blocker(
        'CLIENT_PASSPORT_DATA_MISSING',
        'Заполните паспортные данные.',
        `/clients/${client.id}/edit#documents`,
      ),
    );
  }
  if (!hasValue(client.driverLicense)) {
    issues.push(
      blocker(
        'CLIENT_LICENSE_DATA_MISSING',
        'Заполните данные водительского удостоверения.',
        `/clients/${client.id}/edit#documents`,
      ),
    );
  }
  if (!client.driverLicenseExpiresAt) {
    issues.push(
      blocker(
        'CLIENT_LICENSE_EXPIRY_MISSING',
        'Укажите срок действия водительского удостоверения.',
        `/clients/${client.id}/edit#documents`,
      ),
    );
  } else if (client.driverLicenseExpiresAt.getTime() < now.getTime()) {
    issues.push(
      blocker(
        'CLIENT_LICENSE_EXPIRED',
        'Срок действия водительского удостоверения истёк.',
        `/clients/${client.id}/edit#documents`,
      ),
    );
  }

  for (const [category, missingCode, uncleanCode, label] of [
    ['PASSPORT', 'CLIENT_PASSPORT_FILE_MISSING', 'CLIENT_PASSPORT_FILE_UNCLEAN', 'паспорта'],
    [
      'DRIVER_LICENSE',
      'CLIENT_LICENSE_FILE_MISSING',
      'CLIENT_LICENSE_FILE_UNCLEAN',
      'водительского удостоверения',
    ],
  ] as const) {
    const document = currentDocument(client.documents, category);
    if (!document) {
      issues.push(blocker(missingCode, `Загрузите файл ${label}.`, href));
      continue;
    }
    const current = document.versions.find(
      (version) => version.version === document.currentVersion,
    );
    if (current?.scanVerdict !== 'CLEAN') {
      issues.push(blocker(uncleanCode, `Дождитесь успешной проверки файла ${label}.`, href));
    }
  }

  return readinessResult(issues);
}
