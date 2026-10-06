import { describe, expect, it } from 'vitest';

import { toUserFacingGlobalError } from './global-error-toast';

describe('toUserFacingGlobalError', () => {
  it('explains a stale Server Action without exposing framework internals', () => {
    expect(
      toUserFacingGlobalError(
        new Error('Failed to find Server Action. This request might be from an older deployment.'),
      ),
    ).toEqual({
      kind: 'deployment-skew',
      title: 'Страница устарела после обновления',
      description: 'Обновите страницу и повторите действие. Введённые данные не были сохранены.',
    });
  });

  it('hides Prisma and database details from the operator', () => {
    expect(
      toUserFacingGlobalError(
        new Error('Invalid `prisma.rental.updateMany()` invocation: ConnectorError(P2001)'),
      ),
    ).toEqual({
      kind: 'internal',
      title: 'Не удалось сохранить данные',
      description: 'Сервер отклонил операцию. Повторите попытку или сообщите администратору.',
    });
  });

  it('gives a specific message for a network failure', () => {
    expect(toUserFacingGlobalError(new TypeError('Failed to fetch'))).toMatchObject({
      kind: 'network',
      title: 'Нет связи с сервером',
    });
  });
});
