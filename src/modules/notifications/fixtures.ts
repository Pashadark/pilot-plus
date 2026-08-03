import type { PilotNotification } from './types';

// Демонстрационные уведомления до подключения серверной модели и пользовательских настроек.
export const demoNotifications: readonly PilotNotification[] = [
  {
    id: 'demo-event',
    title: 'Зафиксировано превышение скорости',
    description: 'Автомобиль Pilot 017 превысил установленный лимит.',
    createdAt: 'Сегодня, 10:15',
    tone: 'danger',
    href: '/events',
  },
  {
    id: 'demo-maintenance',
    title: 'Приближается техническое обслуживание',
    description: 'Для Pilot 042 плановое ТО наступит через 300 км.',
    createdAt: 'Сегодня, 09:40',
    tone: 'warning',
    href: '/maintenance',
  },
  {
    id: 'demo-device',
    title: 'Связь с устройством восстановлена',
    description: 'Pilot Connect 023 снова передаёт данные.',
    createdAt: 'Вчера, 18:20',
    tone: 'success',
    href: '/devices',
  },
  {
    id: 'demo-vehicle',
    title: 'Автомобиль добавлен в автопарк',
    description: 'Карточка Pilot 130 готова к заполнению.',
    createdAt: 'Вчера, 16:05',
    tone: 'info',
    href: '/vehicles',
  },
];
