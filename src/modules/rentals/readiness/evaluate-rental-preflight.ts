import { blocker, readinessResult, type ReadinessResult } from './types';

export type RentalPreflightInput = {
  client: ReadinessResult;
  vehicle: ReadinessResult;
  companyReady: boolean;
  templateReady: boolean;
  calculationReady: boolean;
  available: boolean;
};

export function evaluateRentalPreflight(input: RentalPreflightInput): ReadinessResult {
  const issues = [
    ...input.client.blockers,
    ...input.client.warnings,
    ...input.vehicle.blockers,
    ...input.vehicle.warnings,
  ];
  if (!input.companyReady)
    issues.push(
      blocker('RENTAL_COMPANY_LEGAL_MISSING', 'Заполните реквизиты компании.', '/admin/company'),
    );
  if (!input.templateReady)
    issues.push(
      blocker('RENTAL_TEMPLATE_MISSING', 'Опубликуйте шаблон договора.', '/admin/contracts'),
    );
  if (!input.calculationReady)
    issues.push(blocker('RENTAL_CALCULATION_INVALID', 'Проверьте расчёт аренды.', '#pricing'));
  if (!input.available)
    issues.push(
      blocker('RENTAL_VEHICLE_UNAVAILABLE', 'Автомобиль занят в выбранный период.', '#vehicle'),
    );
  return readinessResult(issues);
}
