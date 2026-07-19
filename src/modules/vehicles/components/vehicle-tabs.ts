export type VehicleTab =
  | 'overview'
  | 'trips'
  | 'routes'
  | 'events'
  | 'fuel'
  | 'maintenance'
  | 'documents';

export const vehicleTabs: readonly { value: VehicleTab; label: string }[] = [
  { value: 'overview', label: 'Обзор' },
  { value: 'trips', label: 'Поездки' },
  { value: 'routes', label: 'Маршруты' },
  { value: 'events', label: 'События' },
  { value: 'fuel', label: 'Топливо' },
  { value: 'maintenance', label: 'Обслуживание' },
  { value: 'documents', label: 'Документы' },
];

const values = new Set<VehicleTab>(vehicleTabs.map((tab) => tab.value));

export function normalizeVehicleTab(value: string | undefined): VehicleTab {
  return value && values.has(value as VehicleTab) ? (value as VehicleTab) : 'overview';
}

const emptyStates: Record<Exclude<VehicleTab, 'overview'>, { title: string; description: string }> = {
  trips: {
    title: 'Поездки ещё не поступали',
    description: 'История появится после первой обработанной поездки автомобиля.',
  },
  routes: {
    title: 'Маршрут появится после первой поездки',
    description: 'Для построения линии нужны реальные координаты GPS-трекера.',
  },
  events: {
    title: 'Событий пока нет',
    description: 'Тревоги и значимые изменения состояния появятся в этом журнале.',
  },
  fuel: {
    title: 'Записей о топливе пока нет',
    description: 'Уровень, расход и заправки появятся после подключения телеметрии.',
  },
  maintenance: {
    title: 'Обслуживание ещё не запланировано',
    description: 'Здесь будут регламенты, выполненные работы, даты и пробег.',
  },
  documents: {
    title: 'Документы ещё не добавлены',
    description: 'Страховки, регистрационные документы и сроки будут храниться здесь.',
  },
};

export function getVehicleEmptyState(tab: Exclude<VehicleTab, 'overview'>) {
  return emptyStates[tab];
}
