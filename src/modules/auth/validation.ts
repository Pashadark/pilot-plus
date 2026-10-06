import type { LoginState } from './types';

export type LoginInputResult =
  { ok: true; email: string; password: string } | { ok: true; login: string; password: string } | { ok: false; state: LoginState };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLoginInput(formData: FormData): LoginInputResult {
  if (formData.has('login')) {
    const value = formData.get('login');
    const secret = formData.get('password');
    const login = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const password = typeof secret === 'string' ? secret : '';
    const fieldErrors: NonNullable<LoginState['fieldErrors']> = {};
    if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(login)) fieldErrors.login = 'Введите логин: 3–32 символа, латинские буквы, цифры, точка, дефис или подчёркивание';
    if (!password) fieldErrors.password = 'Введите пароль';
    if (Object.keys(fieldErrors).length) return {ok: false, state: {status: 'error', fieldErrors}};
    return {ok: true, login, password};
  }
  const emailValue = formData.get('email');
  const passwordValue = formData.get('password');
  const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  const fieldErrors: NonNullable<LoginState['fieldErrors']> = {};

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'Введите корректный email';
  }

  if (!password) {
    fieldErrors.password = 'Введите пароль';
  }

  if (fieldErrors.email || fieldErrors.password) {
    return { ok: false, state: { status: 'error', fieldErrors } };
  }

  return { ok: true, email, password };
}
