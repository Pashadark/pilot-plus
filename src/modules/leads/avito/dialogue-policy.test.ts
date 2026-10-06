import { expect, it } from 'vitest';
import { advanceDialogue, emptyDialogue, reminderDue } from './dialogue-policy';

const start = new Date('2026-09-24T10:00:00Z');
it('starts a single waiting episode and later customer messages do not postpone it', () => {
  const a = advanceDialogue(emptyDialogue(), {
    kind: 'customer',
    at: start.toISOString(),
    id: 'm1',
  });
  const b = advanceDialogue(a, { kind: 'customer', at: '2026-09-24T10:10:00Z', id: 'm2' });
  expect(b.waitingSince).toBe(start.toISOString());
  expect(b.episode).toBe('m1');
  expect(reminderDue(b, new Date('2026-09-24T10:15:00Z'))).toBe(true);
  expect(reminderDue(b, new Date('2026-09-24T10:14:59Z'))).toBe(false);
});
it('autoanswers and opening a lead do not satisfy human response SLA', () => {
  const a = advanceDialogue(emptyDialogue(), {
    kind: 'customer',
    at: start.toISOString(),
    id: 'm1',
  });
  const b = advanceDialogue(a, { kind: 'assistant', at: '2026-09-24T10:01:00Z', id: 'bot1' });
  expect(b).toEqual(a);
  expect(reminderDue(b, new Date('2026-09-24T10:16:00Z'))).toBe(true);
});
it('human response closes episode and permanently pauses automatic questions', () => {
  const a = advanceDialogue(emptyDialogue(), {
    kind: 'customer',
    at: start.toISOString(),
    id: 'm1',
  });
  const b = advanceDialogue(a, { kind: 'human', at: '2026-09-24T10:02:00Z', id: 'h1' });
  expect(b.waitingSince).toBeNull();
  expect(b.paused).toBe(true);
  expect(reminderDue(b, new Date('2026-09-24T10:16:00Z'))).toBe(false);
  const c = advanceDialogue(b, { kind: 'customer', at: '2026-09-24T10:20:00Z', id: 'm2' });
  expect(c.episode).toBe('m2');
  expect(c.paused).toBe(true);
});
it('late customer delivery before a human answer cannot reopen the episode', () => {
  const a = advanceDialogue(emptyDialogue(), {
    kind: 'human',
    at: '2026-09-24T10:02:00Z',
    id: 'h1',
  });
  const b = advanceDialogue(a, { kind: 'customer', at: start.toISOString(), id: 'm1' });
  expect(b.waitingSince).toBeNull();
});
it('a late human reply before the current customer message cannot close its episode', () => {
  const a = advanceDialogue(emptyDialogue(), {
    kind: 'customer',
    at: start.toISOString(),
    id: 'm1',
  });
  const b = advanceDialogue(a, { kind: 'human', at: '2026-09-24T09:59:00Z', id: 'h1' });
  expect(b.waitingSince).toBe(start.toISOString());
  expect(b.paused).toBe(true);
});
it('one reminder per episode and invalid dates never trigger a reminder', () => {
  const a = advanceDialogue(emptyDialogue(), {
    kind: 'customer',
    at: start.toISOString(),
    id: 'm1',
  });
  expect(reminderDue({ ...a, remindedEpisode: 'm1' }, new Date('2026-09-24T10:16:00Z'))).toBe(
    false,
  );
  expect(reminderDue({ ...a, waitingSince: 'invalid' }, new Date())).toBe(false);
});
