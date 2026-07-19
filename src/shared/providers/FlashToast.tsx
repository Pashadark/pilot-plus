'use client';

import { useEffect, useRef } from 'react';

import { useToast } from './ToastProvider';

export type FlashToastKind = 'welcome' | 'loggedOut';

const flashToasts = {
  welcome: {
    tone: 'success',
    title: 'Вы вошли в Pilot+',
  },
  loggedOut: {
    tone: 'success',
    title: 'Вы вышли из системы',
  },
} as const;

export function FlashToast({ kind }: { kind: FlashToastKind | null }) {
  const { showToast } = useToast();
  const displayed = useRef(false);

  useEffect(() => {
    if (!kind || displayed.current) return;

    displayed.current = true;
    showToast(flashToasts[kind]);

    const url = new URL(window.location.href);
    url.searchParams.delete(kind === 'welcome' ? 'welcome' : 'loggedOut');
    window.history.replaceState(window.history.state, '', url);
  }, [kind, showToast]);

  return null;
}
