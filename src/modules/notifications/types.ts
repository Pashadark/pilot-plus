export type NotificationTone = 'success' | 'warning' | 'danger' | 'info';

export interface PilotNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: NotificationTone;
  href: string;
}
