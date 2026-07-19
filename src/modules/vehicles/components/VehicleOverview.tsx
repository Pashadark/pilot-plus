import { FiCpu, FiDroplet, FiHash, FiMapPin, FiUsers } from 'react-icons/fi';

import type { VehicleDetailDto } from '../types';
import { formatOptionalMetric } from '../utils';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

const fuelLabels = {
  PETROL: 'Бензин',
  DIESEL: 'Дизель',
  ELECTRIC: 'Электричество',
  HYBRID: 'Гибрид',
  OTHER: 'Другое',
} as const;

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

export function VehicleOverview({ vehicle }: { vehicle: VehicleDetailDto }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader><h2 className="font-bold">Характеристики</h2></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Внутренний номер" value={vehicle.internalNumber} />
            <Detail label="Госномер" value={vehicle.registrationNumber ?? 'Не указан'} />
            <Detail label="VIN" value={vehicle.vin ?? 'Не указан'} />
            <Detail label="Коробка" value={vehicle.transmission} />
            <Detail label="Двигатель" value={vehicle.engineLiters ? `${vehicle.engineLiters} л` : 'Нет данных'} />
            <Detail label="Топливо" value={fuelLabels[vehicle.fuelType]} />
            <Detail label="Количество мест" value={vehicle.seats} />
            <Detail label="Город" value={vehicle.city} />
            <Detail label="Офис" value={vehicle.office ?? 'Не указан'} />
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-bold">Последнее состояние</h2></CardHeader>
        <CardContent className="grid gap-4">
          <p className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-[var(--color-text-secondary)]"><FiHash aria-hidden="true" />Пробег</span><strong>{formatOptionalMetric(vehicle.telemetry.odometerKm, 'км')}</strong></p>
          <p className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-[var(--color-text-secondary)]"><FiDroplet aria-hidden="true" />Топливо</span><strong>{formatOptionalMetric(vehicle.telemetry.fuelLevelPercent, '%')}</strong></p>
          <p className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-[var(--color-text-secondary)]"><FiCpu aria-hidden="true" />GPS-сигнал</span><strong>{vehicle.telemetry.hasPosition ? 'Получен' : 'Нет данных'}</strong></p>
          <p className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-[var(--color-text-secondary)]"><FiMapPin aria-hidden="true" />Позиция</span><strong>{vehicle.telemetry.hasPosition ? 'Доступна' : 'Не получена'}</strong></p>
          <p className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-[var(--color-text-secondary)]"><FiUsers aria-hidden="true" />Мест</span><strong>{vehicle.seats}</strong></p>
        </CardContent>
      </Card>
      <Card className="xl:col-span-3">
        <CardHeader><h2 className="font-bold">Условия и особенности</h2></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {vehicle.features.length ? vehicle.features.map((feature) => <Badge key={feature}>{feature}</Badge>) : <span className="text-sm text-[var(--color-text-secondary)]">Особенности не указаны.</span>}
        </CardContent>
      </Card>
    </div>
  );
}
