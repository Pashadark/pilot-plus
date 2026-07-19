'use client';

import { useActionState, useEffect, useRef } from 'react';

import type { SafeUser } from '@/modules/auth/types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button, Card, CardContent, CardHeader, Input } from '@/shared/ui';

import { changePasswordAction, updateProfileAction } from './actions';
import type { ProfileActionState } from './types';

const initialState: ProfileActionState = { status: 'idle' };

function useProfileToast(state: ProfileActionState, successTitle: string, errorTitle: string) {
  const { showToast } = useToast();

  useEffect(() => {
    if (!state.message || state.status === 'idle') return;
    showToast({
      tone: state.status === 'success' ? 'success' : 'danger',
      title: state.status === 'success' ? successTitle : errorTitle,
      description: state.message,
    });
  }, [errorTitle, showToast, state, successTitle]);
}

function ActionMessage({ state }: { state: ProfileActionState }) {
  if (!state.message) return null;

  return (
    <p
      role={state.status === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={
        state.status === 'error'
          ? 'text-sm text-[var(--color-danger)]'
          : 'text-sm text-[var(--color-success)]'
      }
    >
      {state.message}
    </p>
  );
}

function BasicProfileForm({ user }: { user: SafeUser }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useProfileToast(state, 'Профиль обновлён', 'Не удалось сохранить профиль');

  useEffect(() => {
    const currentPassword = formRef.current?.elements.namedItem('currentPassword');
    if (state.status === 'success' && currentPassword instanceof HTMLInputElement) {
      currentPassword.value = '';
    }
  }, [state]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="text-lg font-semibold">Основное</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Имя отображается в рабочем пространстве, а email используется для входа.
        </p>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-4">
          <Input
            label="Имя"
            name="name"
            autoComplete="name"
            defaultValue={user.name}
            error={state.fieldErrors?.name}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={user.email}
            error={state.fieldErrors?.email}
            required
          />
          <Input
            label="Текущий пароль"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            hint="Подтвердите изменения текущим паролем."
            error={state.fieldErrors?.currentPassword}
            required
          />
          <ActionMessage state={state} />
          <div>
            <Button type="submit" loading={pending}>
              {pending ? 'Сохраняем…' : 'Сохранить профиль'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useProfileToast(state, 'Пароль изменён', 'Не удалось изменить пароль');

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset();
  }, [state]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="text-lg font-semibold">Безопасность</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          После смены пароля остальные активные сессии будут завершены.
        </p>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-4">
          <Input
            label="Текущий пароль для смены"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            error={state.fieldErrors?.currentPassword}
            required
          />
          <Input
            label="Новый пароль"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint="Не менее 12 символов и не совпадает с текущим."
            error={state.fieldErrors?.newPassword}
            required
          />
          <Input
            label="Повторите новый пароль"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={state.fieldErrors?.confirmPassword}
            required
          />
          <ActionMessage state={state} />
          <div>
            <Button type="submit" loading={pending}>
              {pending ? 'Изменяем…' : 'Изменить пароль'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ProfileForms({ user }: { user: SafeUser }) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <BasicProfileForm user={user} />
      <PasswordForm />
    </div>
  );
}
