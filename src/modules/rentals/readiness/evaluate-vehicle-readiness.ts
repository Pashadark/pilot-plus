import { blocker, readinessResult, warning, type ReadinessResult } from './types';

export type RentalPeriod = { startsAt: Date; endsAt: Date };

export type VehicleReadinessInput = {
  id: string;
  archivedAt?: Date | string | null;
  isRentalReady: boolean;
  registrationNumber?: string | null;
  vin?: string | null;
  registrationCertificateNumber?: string | null;
  vehiclePassportNumber?: string | null;
  osagoInsurer?: string | null;
  osagoPolicyNumber?: string | null;
  osagoStartsAt?: Date | null;
  osagoEndsAt?: Date | null;
  dailyPriceMinor?: bigint | number | null;
  depositMinor?: bigint | number | null;
  cascoPolicyNumber?: string | null;
};

function empty(value: string | null | undefined): boolean {
  return !value?.trim();
}

function positive(value: bigint | number | null | undefined): boolean {
  return typeof value === 'bigint' ? value > BigInt(0) : typeof value === 'number' && value > 0;
}

export function evaluateVehicleReadiness(
  vehicle: VehicleReadinessInput,
  period?: RentalPeriod,
): ReadinessResult {
  const edit = `/vehicles/${vehicle.id}/edit`;
  const issues = [];

  if (vehicle.archivedAt) issues.push(blocker('VEHICLE_ARCHIVED', 'Автомобиль архивирован.', edit));
  if (!vehicle.isRentalReady)
    issues.push(
      blocker('VEHICLE_NOT_ENABLED', 'Разрешите выдачу автомобиля в аренду.', `${edit}#rental`),
    );
  if (empty(vehicle.registrationNumber))
    issues.push(
      blocker('VEHICLE_REGISTRATION_MISSING', 'Укажите регистрационный номер.', `${edit}#identity`),
    );
  if (empty(vehicle.vin))
    issues.push(blocker('VEHICLE_VIN_MISSING', 'Укажите VIN.', `${edit}#identity`));
  if (empty(vehicle.registrationCertificateNumber))
    issues.push(blocker('VEHICLE_STS_MISSING', 'Укажите номер СТС.', `${edit}#documents`));
  if (empty(vehicle.vehiclePassportNumber))
    issues.push(blocker('VEHICLE_PTS_MISSING', 'Укажите номер ПТС.', `${edit}#documents`));
  if (empty(vehicle.osagoInsurer) || empty(vehicle.osagoPolicyNumber)) {
    issues.push(blocker('VEHICLE_OSAGO_MISSING', 'Заполните данные ОСАГО.', `${edit}#insurance`));
  } else if (
    period &&
    (!vehicle.osagoStartsAt ||
      !vehicle.osagoEndsAt ||
      vehicle.osagoStartsAt.getTime() > period.startsAt.getTime() ||
      vehicle.osagoEndsAt.getTime() < period.endsAt.getTime())
  ) {
    issues.push(
      blocker(
        'VEHICLE_OSAGO_PERIOD_INVALID',
        'ОСАГО не покрывает выбранный период аренды.',
        `${edit}#insurance`,
      ),
    );
  }
  if (!positive(vehicle.dailyPriceMinor))
    issues.push(blocker('VEHICLE_RATE_MISSING', 'Укажите суточный тариф.', `${edit}#rental`));
  if (!positive(vehicle.depositMinor))
    issues.push(blocker('VEHICLE_DEPOSIT_MISSING', 'Укажите сумму залога.', `${edit}#rental`));
  if (empty(vehicle.cascoPolicyNumber))
    issues.push(warning('VEHICLE_CASCO_MISSING', 'КАСКО не заполнено.', `${edit}#insurance`));

  return readinessResult(issues);
}
