export type RentalConstructorSectionId =
  | 'general'
  | 'client'
  | 'documents'
  | 'vehicle'
  | 'terms'
  | 'handover'
  | 'review';

export type RentalConstructorSectionStatus = 'idle' | 'complete' | 'warning' | 'error';

export type RentalConstructorState = {
  companyId?: string;
  rentalId?: string;
  expectedUpdatedAt?: string;
  agreementType: 'STANDARD' | 'LEASE_TO_OWN';
  clientMode: 'existing' | 'new';
  clientId?: string;
  clientFullName?: string;
  clientPhone?: string | null;
  documentsReady?: boolean;
  vehicleId?: string;
  vehicleAvailable?: boolean;
  startsAt?: string;
  endsAt?: string;
  dailyRateMinor?: number;
  discountMinor?: number;
  servicesMinor?: number;
  depositMinor?: number;
  includedMileageKm?: number | null;
  pickupAddress?: string;
  returnAddress?: string;
  territory?: string;
  paymentTerms?: string;
  startMileageKm?: number;
  startFuelPercent?: number;
  conditions?: string;
  allowedDrivers?: string;
  rentReceived?: boolean;
  depositReceived?: boolean;
  paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
};

