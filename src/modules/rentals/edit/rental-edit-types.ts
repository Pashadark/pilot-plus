import type { RentalStatus } from '@/database/generated/prisma';

export interface RentalEditVehicleOption {
  id: string;
  label: string;
  dailyRateRub: number;
  depositRub: number;
}

export interface RentalEditDto {
  id: string;
  companyId: string;
  contractNumber: string | null;
  status: RentalStatus;
  clientLabel: string;
  updatedAt: string;
  vehicleId: string;
  startsAt: string;
  endsAt: string;
  dailyRateRub: number;
  discountRub: number;
  servicesRub: number;
  depositRub: number;
  includedMileageKm: number;
  overageMileagePriceRub: number;
  missingFuelPriceRub: number;
  pickupAddress: string;
  returnAddress: string;
  paymentTerms: string;
  territory: string;
  allowedDrivers: string;
  vehicles: RentalEditVehicleOption[];
}
