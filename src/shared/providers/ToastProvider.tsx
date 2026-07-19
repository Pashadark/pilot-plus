'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { Toast } from '@/shared/ui/Toast';

import {
  getToastDuration,
  initialToastState,
  toastReducer,
  type ToastInput,
  type ToastRecord,
} from './toast-state';

interface ToastContextValue {
  showToast(input: ToastInput): string;
  dismissToast(id: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function TimedToast({
  toast,
  dismiss,
  reduceMotion,
}: {
  toast: ToastRecord;
  dismiss: (id: string) => void;
  reduceMotion: boolean;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), getToastDuration(toast));
    return () => window.clearTimeout(timer);
  }, [dismiss, paused, toast]);

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
    >
      <Toast toast={toast} onDismiss={() => dismiss(toast.id)} onPauseChange={setPaused} />
    </motion.li>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, initialToastState);
  const fallbackId = useRef(0);
  const reduceMotion = useReducedMotion() ?? false;

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'dismiss', id });
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    fallbackId.current += 1;
    const id = globalThis.crypto?.randomUUID?.() ?? `pilot-toast-${fallbackId.current}`;
    dispatch({ type: 'add', toast: { id, ...input } });
    return id;
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Системные уведомления"
        className="pointer-events-none fixed top-20 right-4 z-[100] w-[min(24rem,calc(100vw-2rem))] sm:right-6"
      >
        <ol className="grid gap-3">
          <AnimatePresence initial={false}>
            {state.toasts.map((toast) => (
              <TimedToast
                key={toast.id}
                toast={toast}
                dismiss={dismissToast}
                reduceMotion={reduceMotion}
              />
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast должен использоваться внутри ToastProvider.');
  return context;
}

export type { ToastInput, ToastTone } from './toast-state';
export { FlashToast, type FlashToastKind } from './FlashToast';
