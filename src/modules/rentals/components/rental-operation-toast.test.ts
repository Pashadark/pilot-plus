import { describe, expect, it } from 'vitest';

import { buildRentalOperationToast } from './rental-operation-toast';

describe('buildRentalOperationToast', () => {
  it('reports exactly what the server verified for a handover', () => {
    expect(
      buildRentalOperationToast('HANDOVER', {
        ok: true,
        rentalId: 'rental-1',
        operationId: 'operation-1',
        mileageKm: 83_273,
        savedMediaCount: 3,
      }),
    ).toEqual({
      tone: 'success',
      title: 'Автомобиль выдан',
      description: 'Пробег 83 273 км · файлов сохранено: 3.',
    });
  });

  it('keeps an action error visible in a danger toast', () => {
    expect(
      buildRentalOperationToast('RETURN', {
        ok: false,
        code: 'OPERATION_FAILED',
        message: 'Сервер не подтвердил сохранение операции.',
      }),
    ).toEqual({
      tone: 'danger',
      title: 'Возврат не сохранён',
      description: 'Сервер не подтвердил сохранение операции.',
      durationMs: 10_000,
    });
  });
});
