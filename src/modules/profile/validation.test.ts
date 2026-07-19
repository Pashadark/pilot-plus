import { describe, expect, it } from 'vitest';

import { parsePasswordInput, parseProfileInput } from './validation';

function profileForm(name: string, email: string, currentPassword: string) {
  const formData = new FormData();
  formData.set('name', name);
  formData.set('email', email);
  formData.set('currentPassword', currentPassword);
  return formData;
}

function passwordForm(currentPassword: string, newPassword: string, confirmPassword: string) {
  const formData = new FormData();
  formData.set('currentPassword', currentPassword);
  formData.set('newPassword', newPassword);
  formData.set('confirmPassword', confirmPassword);
  return formData;
}

describe('parseProfileInput', () => {
  it('нормализует имя и email при корректном вводе', () => {
    expect(
      parseProfileInput(
        profileForm('  Павел Седов  ', '  PAVEL@EXAMPLE.COM ', 'Текущий пароль 2026'),
      ),
    ).toEqual({
      ok: true,
      name: 'Павел Седов',
      email: 'pavel@example.com',
      currentPassword: 'Текущий пароль 2026',
    });
  });

  it('требует текущий пароль', () => {
    expect(parseProfileInput(profileForm('Павел Седов', 'pavel@example.com', ''))).toEqual({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: { currentPassword: 'Введите текущий пароль' },
      },
    });
  });

  it('не возвращает пароль в состоянии ошибки', () => {
    const password = 'Секретный текущий пароль';
    const result = parseProfileInput(profileForm('', 'не-email', password));

    expect(result).toMatchObject({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: { name: 'Введите имя', email: 'Введите корректный email' },
      },
    });
    expect(JSON.stringify(result)).not.toContain(password);
  });
});

describe('parsePasswordInput', () => {
  it('требует текущий пароль', () => {
    expect(parsePasswordInput(passwordForm('', 'Новый пароль 2026', 'Новый пароль 2026'))).toEqual({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: { currentPassword: 'Введите текущий пароль' },
      },
    });
  });

  it('отклоняет новый пароль короче 12 символов', () => {
    expect(parsePasswordInput(passwordForm('старый пароль', 'короткий', 'короткий'))).toMatchObject(
      {
        ok: false,
        state: {
          fieldErrors: { newPassword: 'Новый пароль должен содержать не менее 12 символов' },
        },
      },
    );
  });

  it('отклоняет несовпадающее подтверждение', () => {
    expect(
      parsePasswordInput(
        passwordForm('Старый пароль 2026', 'Новый пароль 2026', 'Другой пароль 2026'),
      ),
    ).toMatchObject({
      ok: false,
      state: { fieldErrors: { confirmPassword: 'Пароли не совпадают' } },
    });
  });

  it('отклоняет новый пароль, совпадающий с текущим', () => {
    expect(
      parsePasswordInput(
        passwordForm('Одинаковый пароль 2026', 'Одинаковый пароль 2026', 'Одинаковый пароль 2026'),
      ),
    ).toMatchObject({
      ok: false,
      state: {
        fieldErrors: { newPassword: 'Новый пароль должен отличаться от текущего' },
      },
    });
  });

  it('возвращает пароли только при успешной валидации', () => {
    expect(
      parsePasswordInput(
        passwordForm('Старый пароль 2026', 'Новый пароль 2026', 'Новый пароль 2026'),
      ),
    ).toEqual({
      ok: true,
      currentPassword: 'Старый пароль 2026',
      newPassword: 'Новый пароль 2026',
    });
  });

  it('не возвращает пароли в состоянии ошибки', () => {
    const currentPassword = 'Секретный старый пароль';
    const newPassword = 'Секретный новый пароль';
    const result = parsePasswordInput(passwordForm(currentPassword, newPassword, 'не совпадает'));

    expect(result).toMatchObject({ ok: false, state: { status: 'error' } });
    expect(JSON.stringify(result)).not.toContain(currentPassword);
    expect(JSON.stringify(result)).not.toContain(newPassword);
  });
});
