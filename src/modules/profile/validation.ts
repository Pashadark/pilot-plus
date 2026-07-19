import type {
  PasswordValidationResult,
  ProfileActionState,
  ProfileValidationResult,
} from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 12;

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function parseProfileInput(formData: FormData): ProfileValidationResult {
  const name = stringValue(formData, 'name').trim();
  const email = stringValue(formData, 'email').trim().toLowerCase();
  const currentPassword = stringValue(formData, 'currentPassword');
  const fieldErrors: NonNullable<ProfileActionState['fieldErrors']> = {};

  if (!name) {
    fieldErrors.name = 'Введите имя';
  }

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'Введите корректный email';
  }

  if (!currentPassword) {
    fieldErrors.currentPassword = 'Введите текущий пароль';
  }

  if (fieldErrors.name || fieldErrors.email || fieldErrors.currentPassword) {
    return { ok: false, state: { status: 'error', fieldErrors } };
  }

  return { ok: true, name, email, currentPassword };
}

export function parsePasswordInput(formData: FormData): PasswordValidationResult {
  const currentPassword = stringValue(formData, 'currentPassword');
  const newPassword = stringValue(formData, 'newPassword');
  const confirmPassword = stringValue(formData, 'confirmPassword');
  const fieldErrors: NonNullable<ProfileActionState['fieldErrors']> = {};

  if (!currentPassword) {
    fieldErrors.currentPassword = 'Введите текущий пароль';
  }

  if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    fieldErrors.newPassword = 'Новый пароль должен содержать не менее 12 символов';
  } else if (newPassword === currentPassword) {
    fieldErrors.newPassword = 'Новый пароль должен отличаться от текущего';
  }

  if (confirmPassword !== newPassword) {
    fieldErrors.confirmPassword = 'Пароли не совпадают';
  }

  if (fieldErrors.currentPassword || fieldErrors.newPassword || fieldErrors.confirmPassword) {
    return { ok: false, state: { status: 'error', fieldErrors } };
  }

  return { ok: true, currentPassword, newPassword };
}
