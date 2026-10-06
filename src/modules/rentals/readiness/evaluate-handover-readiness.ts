export const HANDOVER_READINESS_ACTIVATED_AT = new Date('2026-09-02T09:00:00.000Z');

export type HandoverReadinessBlocker = {
  code:
    | 'PDF_MISSING'
    | 'CLIENT_SIGNATURE_MISSING'
    | 'COMPANY_SIGNATURE_MISSING'
    | 'RENT_PAYMENT_MISSING'
    | 'DEPOSIT_PAYMENT_MISSING'
    | 'DEPOSIT_STATUS_INVALID';
  message: string;
  href: '#rental-documents' | '#rental-settlement';
};

export type HandoverReadiness = {
  ready: boolean;
  blockers: HandoverReadinessBlocker[];
};

export type HandoverReadinessFacts = {
  rentalStatus: string;
  occurredAt: Date;
  hasCommittedPdf: boolean;
  clientSigned: boolean;
  companySigned: boolean;
  totalPriceMinor: bigint;
  confirmedRentMinor: bigint;
  requiredDepositMinor: bigint;
  confirmedDepositMinor: bigint;
  selectedDepositStatus: string;
};

export function evaluateHandoverReadiness(facts: HandoverReadinessFacts): HandoverReadiness {
  if (facts.rentalStatus !== 'CONFIRMED' || facts.occurredAt < HANDOVER_READINESS_ACTIVATED_AT) {
    return { ready: true, blockers: [] };
  }

  const blockers: HandoverReadinessBlocker[] = [];
  if (!facts.hasCommittedPdf) {
    blockers.push({
      code: 'PDF_MISSING',
      message: 'Перед выдачей сформируйте PDF договора.',
      href: '#rental-documents',
    });
  }
  if (!facts.clientSigned) {
    blockers.push({
      code: 'CLIENT_SIGNATURE_MISSING',
      message: 'Перед выдачей отметьте подпись клиента.',
      href: '#rental-settlement',
    });
  }
  if (!facts.companySigned) {
    blockers.push({
      code: 'COMPANY_SIGNATURE_MISSING',
      message: 'Перед выдачей отметьте подпись компании.',
      href: '#rental-settlement',
    });
  }
  if (facts.confirmedRentMinor < facts.totalPriceMinor) {
    blockers.push({
      code: 'RENT_PAYMENT_MISSING',
      message: 'Перед выдачей запишите полную оплату аренды.',
      href: '#rental-settlement',
    });
  }
  if (
    facts.requiredDepositMinor > BigInt(0) &&
    facts.confirmedDepositMinor < facts.requiredDepositMinor
  ) {
    blockers.push({
      code: 'DEPOSIT_PAYMENT_MISSING',
      message: 'Перед выдачей запишите внесение залога.',
      href: '#rental-settlement',
    });
  }
  if (facts.requiredDepositMinor > BigInt(0) && facts.selectedDepositStatus !== 'COLLECTED') {
    blockers.push({
      code: 'DEPOSIT_STATUS_INVALID',
      message: 'Перед выдачей укажите, что залог получен.',
      href: '#rental-settlement',
    });
  }
  return { ready: blockers.length === 0, blockers };
}
