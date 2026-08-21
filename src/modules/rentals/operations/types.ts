export const rentalOperationTypes = ['HANDOVER', 'EXTENSION', 'RETURN'] as const;
export type RentalOperationType = (typeof rentalOperationTypes)[number];

export const rentalEvidenceStatuses = [
  'COMPLETE',
  'VIDEO_MISSING',
  'DASHBOARD_PHOTO_MISSING',
  'MISSING',
] as const;
export type RentalEvidenceStatus = (typeof rentalEvidenceStatuses)[number];

export const rentalOperationMediaKinds = ['INSPECTION_VIDEO', 'DASHBOARD_PHOTO'] as const;
export type RentalOperationMediaKind = (typeof rentalOperationMediaKinds)[number];

export type RentalFulfillmentMethod = 'OFFICE' | 'DELIVERY';
export type RentalDepositStatus =
  'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD';
export type RentalPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type RentalVehicleCondition = 'GOOD' | 'DAMAGE_RECORDED';
