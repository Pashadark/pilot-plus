import type {
  NotificationCategory,
  NotificationTone,
  PilotNotification,
} from '../types';

export type AuditNotificationRow = {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'ASSIGN' | 'BLOCK' | 'ARCHIVE' | 'DELETE' | 'VIEW' | 'DOWNLOAD' | 'SCAN';
  entityType:
    | 'COMPANY'
    | 'CLIENT'
    | 'USER'
    | 'ROLE'
    | 'VEHICLE'
    | 'DEVICE'
    | 'DOCUMENT'
    | 'CLIENT_DOCUMENT'
    | 'RENTAL'
    | 'FINE'
    | 'FINE_INTEGRATION'
    | 'SYSTEM';
  entityId: string | null;
  entityLabel: string | null;
  changes: unknown;
  actorLabel: string;
  companyLabel: string | null;
  createdAt: Date | string;
  isRead: boolean;
};

type Copy = {
  category: NotificationCategory;
  title: string;
  tone: NotificationTone;
  href: string;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function href(path: string, id: string | null): string {
  return id ? `${path}/${id}` : path;
}

function describe(row: AuditNotificationRow): Copy {
  const changes = record(row.changes);

  if (row.entityType === 'RENTAL') {
    if (changes.type === 'HANDOVER' || row.entityLabel === 'Выдача автомобиля') {
      return { category: 'RENTAL', title: 'Аренда началась', tone: 'success', href: href('/rentals', row.entityId) };
    }
    if (changes.type === 'RETURN' || row.entityLabel === 'Возврат автомобиля') {
      return { category: 'RENTAL', title: 'Аренда завершена', tone: 'info', href: href('/rentals', row.entityId) };
    }
    if (row.entityLabel === 'Продление аренды') {
      return { category: 'RENTAL', title: 'Аренда продлена', tone: 'success', href: href('/rentals', row.entityId) };
    }
    if (changes.settlement === 'PAYMENT_RECORDED') {
      return { category: 'RENTAL', title: 'Оплата по договору обновлена', tone: 'success', href: href('/rentals', row.entityId) };
    }
    if (changes.status === 'CONFIRMED') {
      return { category: 'RENTAL', title: 'Договор подтверждён', tone: 'success', href: href('/rentals', row.entityId) };
    }
    return {
      category: 'RENTAL',
      title: row.action === 'CREATE' ? 'Договор создан' : 'Договор изменён',
      tone: 'info',
      href: href('/rentals', row.entityId),
    };
  }

  if (row.entityType === 'FINE' || row.entityType === 'FINE_INTEGRATION') {
    const title = row.action === 'CREATE'
      ? 'Новый штраф'
      : row.action === 'ASSIGN'
        ? changes.assigned === false ? 'Привязка штрафа снята' : 'Штраф привязан'
        : 'Штраф обновлён';
    return { category: 'FINE', title, tone: row.action === 'CREATE' ? 'warning' : 'info', href: '/fines' };
  }

  if (row.entityType === 'CLIENT') {
    const isComment = row.entityLabel === 'Внутренний комментарий клиента' || 'commentId' in changes;
    const title = isComment
      ? row.action === 'CREATE' ? 'Комментарий добавлен' : row.action === 'ARCHIVE' || row.action === 'DELETE' ? 'Комментарий удалён' : 'Комментарий изменён'
      : row.action === 'CREATE' ? 'Клиент создан' : 'Карточка клиента изменена';
    return { category: 'CLIENT', title, tone: 'info', href: href('/clients', row.entityId) };
  }

  if (row.entityType === 'VEHICLE') {
    return {
      category: 'FLEET',
      title: row.action === 'CREATE' ? 'Автомобиль добавлен' : 'Автомобиль изменён',
      tone: 'info',
      href: href('/vehicles', row.entityId),
    };
  }

  return {
    category: 'SYSTEM',
    title: row.entityLabel ?? 'Системное действие',
    tone: row.action === 'BLOCK' || row.action === 'DELETE' ? 'warning' : 'info',
    href: '/admin',
  };
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function buildAuditNotifications(rows: readonly AuditNotificationRow[]): PilotNotification[] {
  return rows.map((row) => {
    const copy = describe(row);
    const occurredAt = new Date(row.createdAt).toISOString();
    const subject = row.entityLabel && !['Выдача автомобиля', 'Возврат автомобиля', 'Внутренний комментарий клиента'].includes(row.entityLabel)
      ? row.entityLabel
      : null;
    return {
      id: `audit:${row.id}`,
      ...copy,
      description: [subject, row.actorLabel, row.companyLabel].filter(Boolean).join(' · '),
      createdAt: formatDate(row.createdAt),
      occurredAt,
      actorLabel: row.actorLabel,
      companyLabel: row.companyLabel,
      isRead: row.isRead,
    };
  });
}
