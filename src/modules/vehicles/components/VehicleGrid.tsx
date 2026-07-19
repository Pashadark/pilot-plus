import type { VehicleCardDto } from '../types';
import { VehicleCard } from './VehicleCard';
import { Button, EmptyState } from '@/shared/ui';

export function VehicleGrid({
  vehicles,
  onReset,
}: {
  vehicles: readonly VehicleCardDto[];
  onReset: () => void;
}) {
  if (!vehicles.length) {
    return (
      <EmptyState
        title="Автомобили не найдены"
        description="Измените условия поиска или сбросьте выбранные фильтры."
        action={<Button onClick={onReset}>Сбросить фильтры</Button>}
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  );
}
