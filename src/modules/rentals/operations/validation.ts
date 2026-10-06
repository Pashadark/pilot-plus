import { moscowLocalToUtc } from '../domain/calculate-rental';
import { rentalEvidenceStatuses } from './types';
import type {
  RentalDepositStatus,
  RentalEvidenceStatus,
  RentalFulfillmentMethod,
  RentalPaymentMethod,
  RentalVehicleCondition,
} from './types';

type CommonCommand = {
  rentalId: string;
  idempotencyKey: string;
  occurredAt: string;
  mileageKm: number;
  fuelLevelPercent: number;
  evidenceStatus: RentalEvidenceStatus;
  evidenceMissingReason?: string;
};

type HandoverCommand = CommonCommand & {
  fulfillmentMethod: RentalFulfillmentMethod;
  fulfillmentAddress?: string;
  depositStatus: RentalDepositStatus;
  depositAmountMinor?: number;
  depositPaymentMethod?: RentalPaymentMethod;
};

type ReturnCommand = CommonCommand & {
  vehicleCondition: RentalVehicleCondition;
  damageDescription?: string;
};

type ExtensionCommand = {
  rentalId: string;
  idempotencyKey: string;
  occurredAt: string;
  nextEndsAt: string;
  notes?: string;
};

function rejectUnknownFields(command: object, allowed: readonly string[]) {
  const unknown = Object.keys(command).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Неизвестное поле: ${unknown}.`);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} обязательно.`);
  return value.trim();
}

function safeInteger(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`${label} указано некорректно.`);
  return value;
}

function validateCommon(command: CommonCommand) {
  const evidenceStatus = command.evidenceStatus;
  if (!rentalEvidenceStatuses.includes(evidenceStatus))
    throw new Error('Статус фиксации некорректен.');
  const evidenceMissingReason = command.evidenceMissingReason?.trim() || undefined;
  if (evidenceStatus !== 'COMPLETE' && !evidenceMissingReason)
    throw new Error('Причина отсутствия фиксации обязательна.');
  return {
    rentalId: requiredText(command.rentalId, 'Договор'),
    idempotencyKey: requiredText(command.idempotencyKey, 'Ключ операции'),
    occurredAt: moscowLocalToUtc(command.occurredAt),
    mileageKm: safeInteger(command.mileageKm, 'Пробег'),
    fuelLevelPercent: safeInteger(command.fuelLevelPercent, 'Уровень топлива', 100),
    evidenceStatus,
    evidenceMissingReason,
  };
}

export function validateHandoverCommand(command: HandoverCommand) {
  rejectUnknownFields(command, [
    'rentalId',
    'idempotencyKey',
    'occurredAt',
    'mileageKm',
    'fuelLevelPercent',
    'evidenceStatus',
    'evidenceMissingReason',
    'fulfillmentMethod',
    'fulfillmentAddress',
    'depositStatus',
    'depositAmountMinor',
    'depositPaymentMethod',
  ]);
  const common = validateCommon(command);
  if (command.fulfillmentMethod !== 'OFFICE' && command.fulfillmentMethod !== 'DELIVERY')
    throw new Error('Способ получения некорректен.');
  const fulfillmentAddress = command.fulfillmentAddress?.trim() || undefined;
  if (command.fulfillmentMethod === 'DELIVERY' && !fulfillmentAddress)
    throw new Error('Адрес подачи обязателен.');
  return {
    ...common,
    fulfillmentMethod: command.fulfillmentMethod,
    fulfillmentAddress,
    depositStatus: command.depositStatus,
    depositAmountMinor:
      command.depositAmountMinor === undefined
        ? undefined
        : safeInteger(command.depositAmountMinor, 'Сумма залога'),
    depositPaymentMethod: command.depositPaymentMethod,
  };
}

export function validateReturnCommand(command: ReturnCommand) {
  rejectUnknownFields(command, [
    'rentalId',
    'idempotencyKey',
    'occurredAt',
    'mileageKm',
    'fuelLevelPercent',
    'evidenceStatus',
    'evidenceMissingReason',
    'vehicleCondition',
    'damageDescription',
  ]);
  const common = validateCommon(command);
  const damageDescription = command.damageDescription?.trim() || undefined;
  if (command.vehicleCondition === 'DAMAGE_RECORDED' && !damageDescription)
    throw new Error('Опишите повреждения.');
  return {
    ...common,
    vehicleCondition: command.vehicleCondition,
    damageDescription,
  };
}

export function validateExtensionCommand(command: ExtensionCommand) {
  rejectUnknownFields(command, ['rentalId', 'idempotencyKey', 'occurredAt', 'nextEndsAt', 'notes']);
  return {
    rentalId: requiredText(command.rentalId, 'Договор'),
    idempotencyKey: requiredText(command.idempotencyKey, 'Ключ операции'),
    occurredAt: moscowLocalToUtc(command.occurredAt),
    nextEndsAt: moscowLocalToUtc(command.nextEndsAt),
    notes: command.notes?.trim() || undefined,
  };
}
