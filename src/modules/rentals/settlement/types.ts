export const RENTAL_PAYMENT_KINDS = ['RENT', 'DEPOSIT'] as const;
export const RENTAL_PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const;
export const RENTAL_SIGNATURE_PARTIES = ['CLIENT', 'COMPANY'] as const;
export const RENTAL_SIGNATURE_STATUSES = ['MISSING', 'SIGNED', 'REVOKED'] as const;

export type RentalPaymentKind = (typeof RENTAL_PAYMENT_KINDS)[number];
export type RentalPaymentMethod = (typeof RENTAL_PAYMENT_METHODS)[number];
export type RentalSignatureParty = (typeof RENTAL_SIGNATURE_PARTIES)[number];
export type RentalSignatureStatus = (typeof RENTAL_SIGNATURE_STATUSES)[number];
