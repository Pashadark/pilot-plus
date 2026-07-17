import type { LoginState } from './types';

export type LoginInputResult =
  { ok: true; email: string; password: string } | { ok: false; state: LoginState };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLoginInput(formData: FormData): LoginInputResult {
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
