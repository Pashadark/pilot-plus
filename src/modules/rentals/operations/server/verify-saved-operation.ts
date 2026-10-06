interface SavedRentalOperationRepository {
  findFirst(args: {
    where: {
      id: string;
      companyId: string;
      rentalId: string;
      status: 'COMMITTED';
    };
    select: {
      mileageKm: true;
      vehicle: { select: { id: true; odometerKm: true } };
      media: { where: { status: 'CLEAN' }; select: { id: true } };
    };
  }): Promise<{
    mileageKm: number | null;
    vehicle: { id: string; odometerKm: unknown };
    media: { id: string }[];
  } | null>;
}

export interface VerifySavedRentalOperationInput {
  companyId: string;
  rentalId: string;
  operationId: string;
  expectedMileageKm: number;
  expectedMediaCount: number;
}

const verificationError =
  'Сервер не подтвердил сохранение операции. Обновите страницу и проверьте договор.';

export async function verifySavedRentalOperation(
  repository: SavedRentalOperationRepository,
  input: VerifySavedRentalOperationInput,
) {
  const operation = await repository.findFirst({
    where: {
      id: input.operationId,
      companyId: input.companyId,
      rentalId: input.rentalId,
      status: 'COMMITTED',
    },
    select: {
      mileageKm: true,
      vehicle: { select: { id: true, odometerKm: true } },
      media: { where: { status: 'CLEAN' }, select: { id: true } },
    },
  });

  const vehicleMileageKm = operation?.vehicle.odometerKm;
  if (
    !operation ||
    operation.mileageKm !== input.expectedMileageKm ||
    Number(vehicleMileageKm) !== input.expectedMileageKm ||
    operation.media.length !== input.expectedMediaCount
  ) {
    throw new Error(verificationError);
  }

  return {
    mileageKm: operation.mileageKm,
    savedMediaCount: operation.media.length,
    vehicleId: operation.vehicle.id,
  };
}
