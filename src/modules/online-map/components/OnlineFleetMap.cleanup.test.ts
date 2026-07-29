import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, it } from 'vitest';

it('откладывает размонтирование вложенных React roots до завершения parent cleanup', () => {
  const source = readFileSync(
    resolve('src/modules/online-map/components/OnlineFleetMap.tsx'),
    'utf8',
  );

  expect(source).toContain('queueMicrotask(() => root.unmount())');
  expect(source).not.toContain('root.unmount();');
});

it('не пересоздаёт карту из-за нового массива с теми же данными автомобилей', () => {
  const source = readFileSync(
    resolve('src/modules/online-map/components/OnlineFleetMap.tsx'),
    'utf8',
  );

  expect(source).toContain('const vehiclesSnapshotKey = JSON.stringify(vehicles);');
  expect(source).toContain('[instanceKey, stableVehicles]');
  expect(source).not.toContain('[instanceKey, vehicles]');
});
