export interface ApprovedRealVehicle {
  make: string;
  model: string;
  plate: string;
}

export const APPROVED_REAL_FLEET: readonly ApprovedRealVehicle[] = [
  { make: 'Kia', model: 'K5', plate: 'В342НР797' },
  { make: 'Skoda', model: 'Octavia', plate: 'Е435АН997' },
  { make: 'Kia', model: 'Cerato', plate: 'С886АУ997' },
  { make: 'Skoda', model: 'Octavia', plate: 'Т949АМ997' },
  { make: 'Mercedes-Benz', model: 'E220d 4Matic', plate: 'М283АМ997' },
  { make: 'Volkswagen', model: 'Polo', plate: 'Р400АМ997' },
  { make: 'Volkswagen', model: 'Polo', plate: 'А156АХ997' },
  { make: 'Kia', model: 'Rio', plate: 'Р604АО997' },
  { make: 'Kia', model: 'Ceed', plate: 'А429АУ997' },
  { make: 'Toyota', model: 'Camry', plate: 'Н726АХ550' },
] as const;

export const APPROVED_REAL_PLATES = new Set(APPROVED_REAL_FLEET.map((vehicle) => vehicle.plate));
