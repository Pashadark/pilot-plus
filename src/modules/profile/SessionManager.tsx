'use client';

import { useActionState, useEffect } from 'react';
import { FiLogOut, FiMonitor } from 'react-icons/fi';

import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button } from '@/shared/ui';

import {
  terminateOtherProfileSessionsAction,
  terminateProfileSessionAction,
} from './actions';
import type { ProfileViewModel } from './profile-model';
import type { ProfileActionState } from './types';

const initialState: ProfileActionState = { status: 'idle' };

function SessionAction({
  session,
}: {
  session: ProfileViewModel['account']['sessions'][number];
}) {
  const [state, action, pending] = useActionState(terminateProfileSessionAction, initialState);
  const { showToast } = useToast();

  useEffect(() => {
    if (state.status === 'success') {
      showToast({ tone: 'success', title: state.message ?? 'Сессия завершена.' });
    }
    if (state.status === 'error') {
      showToast({ tone: 'danger', title: state.message ?? 'Не удалось завершить сессию.' });
    }
  }, [showToast, state]);

  return (
    <form action={action}>
      <input type="hidden" name="sessionId" value={session.id} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        loading={pending}
        aria-label={`Завершить сессию от ${session.createdAt}`}
      >
        <FiLogOut aria-hidden />
        Завершить
      </Button>
    </form>
  );
}

function TerminateOthersButton() {
  const [state, action, pending] = useActionState(
    terminateOtherProfileSessionsAction,
    initialState,
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (state.status === 'success') {
      showToast({ tone: 'success', title: state.message ?? 'Остальные сессии завершены.' });
    }
    if (state.status === 'error') {
      showToast({ tone: 'danger', title: state.message ?? 'Не удалось завершить сессии.' });
    }
  }, [showToast, state]);

  return (
    <form action={action}>
      <Button type="submit" variant="outline" loading={pending}>
        <FiLogOut aria-hidden />
        Завершить остальные сессии
      </Button>
    </form>
  );
}

export function SessionManager({
  sessions,
}: {
  sessions: ProfileViewModel['account']['sessions'];
}) {
  const hasOtherSessions = sessions.some((session) => !session.current);

  return (
    <section aria-labelledby="profile-sessions-title" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="profile-sessions-title" className="text-lg font-bold">
            Активные сессии
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Устройства, на которых сейчас открыт ваш аккаунт.
          </p>
        </div>
        {hasOtherSessions ? <TerminateOthersButton /> : null}
      </div>

      <div className="mt-4 grid gap-3">
        {sessions.map((session) => (
          <article
            key={session.id}
            className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:flex-row sm:items-center"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiMonitor aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  Вход {session.createdAt}
                </p>
                {session.current ? <Badge tone="success">Текущая</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Действует до {session.expiresAt}
              </p>
            </div>
            {!session.current ? <SessionAction session={session} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
