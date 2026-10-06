import type { PilotNotification } from './types';

// Демонстрационные уведомления до подключения серверной модели и пользовательских настроек.
export const demoNotifications: readonly PilotNotification[] = [
  {
    id: 'demo-event',
    category: 'SYSTEM',
    title: 'Зафиксировано превышение скорости',
    description: 'Автомобиль Pilot 017 превысил установленный лимит.',
    createdAt: 'Сегодня, 10:15',
    occurredAt: '2026-09-14T07:15:00.000Z',
    tone: 'danger',
    href: '/events',
  },
  {
    id: 'demo-maintenance',
    category: 'FLEET',
    title: 'Приближается техническое обслуживание',
    description: 'Для Pilot 042 плановое ТО наступит через 300 км.',
    createdAt: 'Сегодня, 09:40',
    occurredAt: '2026-09-14T06:40:00.000Z',
    tone: 'warning',
    href: '/maintenance',
  },
  {
    id: 'demo-device',
    category: 'SYSTEM',
    title: 'Связь с устройством восстановлена',
    description: 'Pilot Connect 023 снова передаёт данные.',
    createdAt: 'Вчера, 18:20',
    occurredAt: '2026-09-13T15:20:00.000Z',
    tone: 'success',
    href: '/devices',
  },
  {
    id: 'demo-vehicle',
    category: 'FLEET',
    title: 'Автомобиль добавлен в автопарк',
    description: 'Карточка Pilot 130 готова к заполнению.',
    createdAt: 'Вчера, 16:05',
    occurredAt: '2026-09-13T13:05:00.000Z',
    tone: 'info',
    href: '/vehicles',
  },
];
