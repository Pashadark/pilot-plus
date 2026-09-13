export const CAMRY_DAMAGE_IMPORT = {
  vehicleId: 'cmtdgxote000ttu18133knumk',
  rentalId: '0fae8f8b-70e4-4c1c-80ee-85129c00a496',
  clientId: 'cmtg3v9sg0013tuuwxjoi49fh',
  registrationNumber: 'Х069АЕ997',
  importKey: 'camry-x069ae997-damage-2026-09-12',
} as const;

type Target = {
  vehicle: { id: string; companyId: string; registrationNumber: string | null };
  rental: { id: string; vehicleId: string; clientId: string };
};

function normalizePlate(value: string | null) {
  return value?.replace(/[^0-9A-ZА-ЯЁ]/giu, '').toLocaleUpperCase('ru-RU') ?? '';
}

export function buildCamryDamageImport({ vehicle, rental }: Target) {
  if (
    vehicle.id !== CAMRY_DAMAGE_IMPORT.vehicleId ||
    normalizePlate(vehicle.registrationNumber) !==
      normalizePlate(CAMRY_DAMAGE_IMPORT.registrationNumber)
  ) {
    throw new Error('Выбранный автомобиль не является Camry Х069АЕ997.');
  }
  if (rental.id !== CAMRY_DAMAGE_IMPORT.rentalId || rental.vehicleId !== vehicle.id) {
    throw new Error('Договор не относится к Camry Х069АЕ997.');
  }
  if (rental.clientId !== CAMRY_DAMAGE_IMPORT.clientId) {
    throw new Error('В договоре указан другой клиент.');
  }

  return {
    vehicleId: vehicle.id,
    rentalId: rental.id,
    clientId: rental.clientId,
    recordType: 'REPAIR' as const,
    kind: 'OTHER' as const,
    status: 'IN_PROGRESS' as const,
    title: 'Повреждение бампера и подкрылка',
    description: 'Разрыв и деформация подкрылка в колесной арке, повреждение нижней части бампера.',
    damageReportedAt: new Date('2026-09-12T09:00:00.000Z'),
    startedAt: new Date('2026-09-12T09:00:00.000Z'),
    notes: `Фото повреждений до ремонта. import-key:${CAMRY_DAMAGE_IMPORT.importKey}`,
  };
}
