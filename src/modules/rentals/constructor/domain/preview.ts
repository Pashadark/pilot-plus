import { calculateRental, moscowLocalToUtc } from '@/modules/rentals/domain/calculate-rental';

import type { RentalConstructorState } from './types';

export type ContractPreviewBootstrap = {
  company: { name: string; contractCity: string | null };
  client: { phone: string | null } | null;
  vehicle: {
    label: string;
    registrationNumber?: string | null;
    vin?: string | null;
  } | null;
};

const blank = (value: string | null | undefined) => value?.trim() || 'Не заполнено';

function totalMinor(state: RentalConstructorState) {
  if (!state.startsAt || !state.endsAt || state.dailyRateMinor === undefined) return null;
  try {
    return calculateRental({
      startsAt: moscowLocalToUtc(state.startsAt),
      endsAt: moscowLocalToUtc(state.endsAt),
      dailyMinor: state.dailyRateMinor,
      discountMinor: state.discountMinor ?? 0,
      serviceMinor: state.servicesMinor ?? 0,
    }).agreedTotalMinor;
  } catch {
    return null;
  }
}

export function buildContractPreview(
  state: RentalConstructorState,
  data: ContractPreviewBootstrap,
) {
  return {
    city: blank(data.company.contractCity),
    companyName: blank(data.company.name),
    date: state.startsAt ? state.startsAt.slice(0, 10) : 'Не заполнено',
    client: {
      fullName: blank(state.clientFullName),
      phone: blank(data.client?.phone ?? state.clientPhone),
    },
    vehicle: {
      label: blank(data.vehicle?.label),
      registrationNumber: blank(data.vehicle?.registrationNumber),
      vin: blank(data.vehicle?.vin),
    },
    rental: {
      startsAt: blank(state.startsAt),
      endsAt: blank(state.endsAt),
      totalMinor: totalMinor(state),
      depositMinor: state.depositMinor ?? null,
      pickupAddress: blank(state.pickupAddress),
      returnAddress: blank(state.returnAddress),
      territory: blank(state.territory),
      conditions: blank(state.conditions),
    },
  };
}

export type ContractPreviewViewModel = ReturnType<typeof buildContractPreview>;
