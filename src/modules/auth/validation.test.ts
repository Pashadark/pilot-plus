import { describe, expect, it } from 'vitest';

import { parseLoginInput } from './validation';

function loginData(email: string, password: string) {
  const formData = new FormData();
  formData.set('email', email);
  formData.set('password', password);
  return formData;
}

describe('parseLoginInput', () => {
  it('нормализует email и сохраняет пароль только при успехе', () => {
    expect(parseLoginInput(loginData(' Admin@Example.COM ', 'Надёжный пароль 2026'))).toEqual({
      ok: true,
      email: 'admin@example.com',
      password: 'Надёжный пароль 2026',
    });
  });

  it('возвращает локальные ошибки для email и пустого пароля', () => {
    const result = parseLoginInput(loginData('не-email', ''));

    expect(result).toEqual({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: { email: 'Введите корректный email', password: 'Введите пароль' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('Надёжный пароль');
  });
});
