import { describe, expect, it } from 'vitest';

import { parseClientCommentInput } from './validation';

describe('валидация внутреннего комментария', () => {
  it('нормализует текст и удаляет управляющие символы', () => {
    expect(
      parseClientCommentInput({
        clientId: 'client-1',
        rentalId: '',
        category: 'GENERAL',
        severity: 'INFO',
        text: '  Возврат\u0000 без замечаний  ',
      }),
    ).toMatchObject({ ok: true, data: { text: 'Возврат без замечаний', rentalId: null } });
  });

  it('отклоняет пустой и слишком длинный текст', () => {
    expect(parseClientCommentInput({ clientId: 'c', text: '   ' }).ok).toBe(false);
    expect(parseClientCommentInput({ clientId: 'c', text: 'а'.repeat(2001) }).ok).toBe(false);
  });

  it('оставляет обычную заметку без влияния на рейтинг', () => {
    expect(
      parseClientCommentInput({
        clientId: 'client-1',
        text: 'Перезвонить перед следующей арендой',
        affectsRating: false,
        ratingDelta: '',
      }),
    ).toMatchObject({
      ok: true,
      data: { affectsRating: false, ratingDelta: null, problemStatus: null },
    });
  });

  it('принимает явное ручное отрицательное влияние в разрешённом диапазоне', () => {
    expect(
      parseClientCommentInput({
        clientId: 'client-1',
        category: 'PAYMENT',
        text: 'Отказывается оплачивать подтверждённый штраф',
        affectsRating: true,
        ratingDelta: '-15',
      }),
    ).toMatchObject({
      ok: true,
      data: { affectsRating: true, ratingDelta: -15, problemStatus: 'OPEN' },
    });
  });

  it('отклоняет ноль и влияние за пределами ручного диапазона', () => {
    expect(
      parseClientCommentInput({
        clientId: 'client-1',
        text: 'Проверить',
        affectsRating: true,
        ratingDelta: '-31',
      }).ok,
    ).toBe(false);
    expect(
      parseClientCommentInput({
        clientId: 'client-1',
        text: 'Проверить',
        affectsRating: true,
        ratingDelta: '0',
      }).ok,
    ).toBe(false);
  });
});
