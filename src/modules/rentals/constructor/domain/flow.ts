import type {
  RentalConstructorSectionId,
  RentalConstructorSectionStatus,
  RentalConstructorState,
} from './types';

export const constructorSections = [
  { id: 'general', label: 'Общие данные' },
  { id: 'client', label: 'Клиент' },
  { id: 'documents', label: 'Документы' },
  { id: 'vehicle', label: 'Автомобиль' },
  { id: 'terms', label: 'Условия аренды' },
  { id: 'handover', label: 'Выдача автомобиля' },
  { id: 'review', label: 'Проверка' },
] as const satisfies readonly {
  id: RentalConstructorSectionId;
  label: string;
}[];

export function validateSection(
  state: RentalConstructorState,
  id: RentalConstructorSectionId,
): string[] {
  if (id === 'general') return state.companyId ? [] : ['Не выбрана компания.'];
  if (id === 'client') return state.clientId ? [] : ['Выберите или создайте клиента.'];
  if (id === 'documents') {
    return state.documentsReady ? [] : ['Проверьте паспорт и водительское удостоверение.'];
  }
  if (id === 'vehicle') {
    if (!state.vehicleId) return ['Выберите автомобиль.'];
    return state.vehicleAvailable === false
      ? ['Автомобиль недоступен на выбранный период.']
      : [];
  }
  if (id === 'terms') {
    return state.startsAt && state.endsAt && state.dailyRateMinor !== undefined
      ? []
      : ['Укажите срок и стоимость аренды.'];
  }
  if (id === 'handover') {
    return state.startMileageKm !== undefined && state.startFuelPercent !== undefined
      ? []
      : ['Укажите одометр и топливо при выдаче.'];
  }
  return constructorSections
    .filter((section) => section.id !== 'review')
    .flatMap((section) => validateSection(state, section.id));
}

export function sectionStatus(
  state: RentalConstructorState,
  id: RentalConstructorSectionId,
): RentalConstructorSectionStatus {
  return validateSection(state, id).length ? 'error' : 'complete';
}
