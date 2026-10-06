import { expect, it, vi } from 'vitest';
import { sendReservedQuestion } from './delivery';
it('reserves before sending and records the returned message ID', async () => {
  const events: string[] = [];
  await sendReservedQuestion({
    reserve: async () => {
      events.push('reserve');
      return true;
    },
    send: async () => {
      events.push('send');
      return { id: 'provider-1' };
    },
    finish: async (state, id) => {
      events.push(`${state}:${id}`);
    },
  });
  expect(events).toEqual(['reserve', 'send', 'SENT:provider-1']);
});
it('never sends when the job has already been reserved', async () => {
  const send = vi.fn();
  await sendReservedQuestion({ reserve: async () => false, send, finish: vi.fn() });
  expect(send).not.toHaveBeenCalled();
});
it('records uncertain network outcomes without a blind retry', async () => {
  const send = vi.fn().mockRejectedValue(new Error('timeout'));
  const finish = vi.fn();
  await sendReservedQuestion({ reserve: async () => true, send, finish });
  expect(send).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledWith('UNKNOWN', null);
});
it('unknown response format cannot be declared sent', async () => {
  const finish = vi.fn();
  await sendReservedQuestion({ reserve: async () => true, send: async () => ({}), finish });
  expect(finish).toHaveBeenCalledWith('UNKNOWN', null);
});
