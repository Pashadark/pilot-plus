'use client';

import { useActionState } from 'react';

import { loginAction } from './actions';
import type { LoginState } from './types';
import { Alert, Button, Input } from '@/shared/ui';

const initialState: LoginState = { status: 'idle' };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state.message && (
        <div aria-live="polite">
          <Alert tone="danger" title={state.message} />
        </div>
      )}
      <Input
        label="Логин"
        name="login"
        type="text"
        autoCapitalize="none"
        spellCheck={false}
        autoComplete="username"
        placeholder="Ваш логин"
        error={state.fieldErrors?.login}
        required
        autoFocus
      />
      <Input
        label="Пароль"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        required
      />
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? 'Входим…' : 'Войти'}
      </Button>
    </form>
  );
}
