import { describe, expect, it } from 'vitest';

import { APPROVED_REAL_FLEET } from './approved-fleet';
import { buildRealFleetPreview } from './fleet-reconciliation';

describe('предпросмотр реального автопарка', () => {
  it('содержит ровно десять подтверждённых автомобилей', () => {
    expect(APPROVED_REAL_FLEET).toHaveLength(10);
    expect(APPROVED_REAL_FLEET.map((vehicle) => vehicle.plate)).toEqual([
      'В342НР797',
      'Е435АН997',
      'С886АУ997',
      'Т949АМ997',
      'М283АМ997',
      'Р400АМ997',
      'А156АХ997',
      'Р604АО997',
      'А429АУ997',
      'Н726АХ550',
    ]);
  });

  it('создаёт отсутствующие, связывает совпавшие и игнорирует чужие объекты провайдера', () => {
    const preview = buildRealFleetPreview({
      existing: [
        {
          id: 'polo',
          plate: 'А156АХ997',
          make: 'Volkswagen',
          model: 'Polo',
          references: 2,
          isDemoImport: false,
        },
      ],
      provider: [
        { externalId: '42', name: 'Volkswagen Polo A156AX997' },
        { externalId: '99', name: 'Demo Truck X999XX999' },
      ],
    });

    expect(preview.link).toEqual([
      expect.objectContaining({ vehicleId: 'polo', externalId: '42', plate: 'А156АХ997' }),
    ]);
    expect(preview.create).toHaveLength(9);
    expect(preview.ignoredProvider).toEqual([{ externalId: '99', name: 'Demo Truck X999XX999' }]);
    expect(preview.blocked).toEqual([]);
  });

  it('удаляет только демо без истории и архивирует машину со ссылками', () => {
    const preview = buildRealFleetPreview({
      existing: [
        {
          id: 'delete-me',
          plate: 'О001ОО77',
          make: 'Demo',
          model: 'One',
          references: 0,
          isDemoImport: true,
        },
        {
          id: 'archive-me',
          plate: 'О002ОО77',
          make: 'Legacy',
          model: 'Two',
          references: 3,
          isDemoImport: false,
        },
      ],
      provider: [],
    });

    expect(preview.delete).toEqual([expect.objectContaining({ vehicleId: 'delete-me' })]);
    expect(preview.archive).toEqual([
      expect.objectContaining({ vehicleId: 'archive-me', references: 3 }),
    ]);
  });

  it('помечает старый номер Toyota для исправления', () => {
    const preview = buildRealFleetPreview({
      existing: [
        {
          id: 'toyota',
          plate: 'Н26АХ550',
          make: 'Toyota',
          model: 'Camry',
          references: 1,
          isDemoImport: false,
        },
      ],
      provider: [{ externalId: 'camry-object', name: 'Toyota Camry H726AX550' }],
    });

    expect(preview.update).toEqual([
      expect.objectContaining({ vehicleId: 'toyota', plate: 'Н726АХ550' }),
    ]);
    expect(preview.link).toEqual([
      expect.objectContaining({ vehicleId: 'toyota', externalId: 'camry-object' }),
    ]);
  });

  it('блокирует неоднозначный внешний объект или дубликат номера в базе', () => {
    const duplicate = buildRealFleetPreview({
      existing: [
        {
          id: 'one',
          plate: 'А156АХ997',
          make: 'Volkswagen',
          model: 'Polo',
          references: 0,
          isDemoImport: false,
        },
        {
          id: 'two',
          plate: 'А156АХ997',
          make: 'Volkswagen',
          model: 'Polo',
          references: 0,
          isDemoImport: false,
        },
      ],
      provider: [{ externalId: '42', name: 'Volkswagen Polo A156AX997' }],
    });
    const ambiguous = buildRealFleetPreview({
      existing: [],
      provider: [{ externalId: '42', name: 'A156AX997 and A429AY997' }],
    });

    expect(duplicate.blocked).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_PLATE' }));
    expect(ambiguous.blocked).toContainEqual(
      expect.objectContaining({ code: 'AMBIGUOUS_PROVIDER_OBJECT' }),
    );
  });
});
