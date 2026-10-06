import { describe, expect, it } from 'vitest';

import { evaluateHandoverReadiness } from './evaluate-handover-readiness';

const readyFacts = {
  rentalStatus: 'CONFIRMED',
  occurredAt: new Date('2026-09-03T09:00:00.000Z'),
  hasCommittedPdf: true,
  clientSigned: true,
  companySigned: true,
  totalPriceMinor: BigInt(100_000),
  confirmedRentMinor: BigInt(100_000),
  requiredDepositMinor: BigInt(50_000),
  confirmedDepositMinor: BigInt(50_000),
  selectedDepositStatus: 'COLLECTED',
} as const;

describe('evaluateHandoverReadiness', () => {
  it('разрешает выдачу полностью готового нового договора', () => {
    expect(evaluateHandoverReadiness(readyFacts)).toEqual({ ready: true, blockers: [] });
  });

  it.each([
    ['hasCommittedPdf', false, 'Перед выдачей сформируйте PDF договора.'],
    ['clientSigned', false, 'Перед выдачей отметьте подпись клиента.'],
    ['companySigned', false, 'Перед выдачей отметьте подпись компании.'],
  ] as const)('блокирует новый договор при проблеме %s', (field, value, message) => {
    const result = evaluateHandoverReadiness({ ...readyFacts, [field]: value });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContainEqual(expect.objectContaining({ message }));
  });

  it('требует полную оплату аренды и внесённый залог', () => {
    const result = evaluateHandoverReadiness({
      ...readyFacts,
      confirmedRentMinor: BigInt(90_000),
      confirmedDepositMinor: BigInt(0),
      selectedDepositStatus: 'NOT_COLLECTED',
    });
    expect(result.blockers.map((blocker) => blocker.code)).toEqual([
      'RENT_PAYMENT_MISSING',
      'DEPOSIT_PAYMENT_MISSING',
      'DEPOSIT_STATUS_INVALID',
    ]);
  });

  it('не применяет новый gate задним числом к старой выдаче', () => {
    expect(
      evaluateHandoverReadiness({
        ...readyFacts,
        occurredAt: new Date('2026-09-01T09:00:00.000Z'),
        hasCommittedPdf: false,
        clientSigned: false,
        companySigned: false,
        confirmedRentMinor: BigInt(0),
        confirmedDepositMinor: BigInt(0),
      }),
    ).toEqual({ ready: true, blockers: [] });
  });

  it('не инвалидирует уже активную старую аренду', () => {
    expect(
      evaluateHandoverReadiness({
        ...readyFacts,
        rentalStatus: 'ACTIVE',
        hasCommittedPdf: false,
      }),
    ).toEqual({ ready: true, blockers: [] });
  });
});
