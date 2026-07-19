import { describe, expect, it } from 'vitest';

import {
  getToastDuration,
  initialToastState,
  toastReducer,
  type ToastRecord,
} from './toast-state';

function toast(id: string, tone: ToastRecord['tone'] = 'info'): ToastRecord {
  return { id, tone, title: `Уведомление ${id}` };
}

describe('очередь тостов', () => {
  it('показывает новый тост сверху и ограничивает очередь четырьмя элементами', () => {
    const state = ['1', '2', '3', '4', '5'].reduce(
      (current, id) => toastReducer(current, { type: 'add', toast: toast(id) }),
      initialToastState,
    );

    expect(state.toasts.map((item) => item.id)).toEqual(['5', '4', '3', '2']);
  });

  it('закрывает выбранный тост независимо от его позиции', () => {
    const withToasts = ['1', '2', '3'].reduce(
      (current, id) => toastReducer(current, { type: 'add', toast: toast(id) }),
      initialToastState,
    );

    const state = toastReducer(withToasts, { type: 'dismiss', id: '2' });

    expect(state.toasts.map((item) => item.id)).toEqual(['3', '1']);
  });

  it('держит опасное уведомление дольше остальных и уважает ручную длительность', () => {
    expect(getToastDuration(toast('danger', 'danger'))).toBe(8000);
    expect(getToastDuration(toast('success', 'success'))).toBe(5000);
    expect(getToastDuration({ ...toast('custom'), durationMs: 12000 })).toBe(12000);
  });
});
