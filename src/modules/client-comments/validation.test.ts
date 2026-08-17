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
});
