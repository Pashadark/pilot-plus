export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface ToastRecord extends ToastInput {
  id: string;
}

export interface ToastState {
  toasts: ToastRecord[];
}

export type ToastAction =
  | { type: 'add'; toast: ToastRecord }
  | { type: 'dismiss'; id: string };

export const initialToastState: ToastState = { toasts: [] };

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  if (action.type === 'dismiss') {
    return { toasts: state.toasts.filter((toast) => toast.id !== action.id) };
  }

  return { toasts: [action.toast, ...state.toasts].slice(0, 4) };
}

export function getToastDuration(toast: ToastRecord) {
  return toast.durationMs ?? (toast.tone === 'danger' ? 8000 : 5000);
}
