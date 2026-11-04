export const rentalWizardSteps = ['Документы', 'Аренда', 'Проверка'] as const;

type StepState = {
  documentsReady?: boolean;
  vehicleSelected?: boolean;
  vehicleAvailable?: boolean;
  calculationReady?: boolean;
};

export function validateRentalWizardStep(step: number, state: StepState) {
  if (step !== 1) return '';
  if (!state.vehicleSelected) return 'Выберите автомобиль.';
  if (state.vehicleAvailable === false) return 'Этот автомобиль недоступен для аренды.';
  if (!state.calculationReady) return 'Укажите корректные дату и время выдачи и возврата.';
  return '';
}
