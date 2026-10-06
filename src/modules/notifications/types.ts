export type NotificationTone = 'success' | 'warning' | 'danger' | 'info';
export type NotificationCategory = 'RENTAL' | 'FINE' | 'CLIENT' | 'FLEET' | 'SYSTEM';

export interface PilotNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  createdAt: string;
  occurredAt: string;
  tone: NotificationTone;
  href: string;
  isRead?: boolean;
  actorLabel?: string | null;
  companyLabel?: string | null;
}
