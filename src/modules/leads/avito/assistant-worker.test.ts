import { expect, it, vi } from 'vitest';
import type { PrismaClient } from '@/database/generated/prisma';
import { encryptField, decryptField } from '@/services/security/field-encryption';
import { tickAssistant } from './assistant-worker';
import { emptyDialogue } from './dialogue-policy';
import { extractRentalRequest } from './rental-request';
import type { AvitoClient } from './client';
const now = new Date('2026-09-24T09:00:00Z');
const key = Buffer.alloc(32, 1).toString('base64');
const config = {
  companyId: 'c',
  accountId: '11',
  encryptionKey: key,
  enabledAt: new Date('2026-09-24T08:00:00Z'),
  sendEnabledAt: new Date('2026-09-24T08:50:00Z'),
};
function fixture() {
  const state = {
    clock: {
      ...emptyDialogue(),
      lastCustomerAt: now.toISOString(),
      waitingSince: now.toISOString(),
    },
    request: extractRentalRequest('Сегодня на 3 дня', now),
    messages: [{ id: 'in1', at: now.toISOString(), text: 'Сегодня на 3 дня' }],
    lastQuestion: '',
  };
  const job = {
    id: 'j',
    chatId: 'chat',
    incomingId: 'in1',
    createdAt: now,
    textEncrypted: encryptField('old question', key),
  };
  const db = {
    auditLog: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          changes: {
            enabled: true,
            enabledAt: config.sendEnabledAt.toISOString(),
            updatedAt: config.sendEnabledAt.toISOString(),
          },
        }),
    },
    $transaction: vi.fn().mockResolvedValue(null),
    avitoDialogue: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        leadId: 'l',
        contentEncrypted: encryptField(JSON.stringify(state), key),
      }),
    },
    avitoOutgoing: {
      findFirst: vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    avitoInboxEvent: { count: vi.fn().mockResolvedValue(0) },
    lead: { findFirst: vi.fn().mockResolvedValue({ id: 'l' }) },
    vehicle: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'car',
          model: 'Toyota Camry',
          registrationNumber: 'PRIVATE',
          isRentalReady: true,
          status: 'PARKED',
          rentals: [],
          maintenanceRecords: [],
        },
      ]),
    },
  };
  const chat = {
    id: 'chat',
    users: [{ id: 11 }],
    context: { type: 'item', value: { id: 8252873021, title: 'Аренда Toyota Camry', user_id: 11 } },
  };
  const api = {
    chat: vi.fn().mockResolvedValue(chat),
    activeItems: vi.fn().mockResolvedValue({
      resources: [{ id: 8252873021, category: { id: 114 }, title: 'Аренда Toyota Camry' }],
    }),
    messages: vi.fn().mockResolvedValue({ messages: [], meta: { has_more: false } }),
    sendText: vi.fn().mockResolvedValue({ id: 'provider-1' }),
  };
  const run = () =>
    tickAssistant(config, api as unknown as AvitoClient, db as unknown as PrismaClient, true, now);
  return { db, api, job, state, run };
}
it('never sends when the owner switch is off despite environment enable', async () => {
  const { db, api, run } = fixture();
  db.auditLog.findFirst.mockResolvedValue(null);
  await run();
  expect(api.sendText).not.toHaveBeenCalled();
});
it('rechecks the switch after remote lookups and before reservation', async () => {
  const { db, api, run } = fixture();
  api.activeItems.mockImplementation(async () => {
    db.auditLog.findFirst.mockResolvedValue(null);
    return { resources: [{ id: 8252873021, category: { id: 114 }, title: 'Аренда Toyota Camry' }] };
  });
  await run();
  expect(api.sendText).not.toHaveBeenCalled();
});
it('does not resume a conversation started before the current enable cutoff', async () => {
  const { db, state, api, run } = fixture();
  state.messages.unshift({ id: 'old', at: '2026-09-24T08:40:00Z', text: 'Здравствуйте' });
  db.avitoDialogue.findUnique.mockResolvedValue({
    leadId: 'l',
    contentEncrypted: encryptField(JSON.stringify(state), key),
  });
  await run();
  expect(api.sendText).not.toHaveBeenCalled();
});
it('rebuilds and persists the customer answer using fresh fleet state immediately before sending', async () => {
  const { db, api, run } = fixture();
  await run();
  expect(api.sendText).toHaveBeenCalledOnce();
  const text = api.sendText.mock.calls[0][2];
  expect(text).toContain('По расписанию свободны: Toyota Camry');
  expect(text).toContain('Во сколько');
  expect(text).not.toContain('PRIVATE');
  const reserve = db.avitoOutgoing.updateMany.mock.calls.find((c) => c[0].data.state === 'SENDING');
  expect(decryptField(reserve![0].data.textEncrypted, key)).toBe(text);
});
it('does not send a pending job created before the launch cutoff', async () => {
  const { job, api, run } = fixture();
  job.createdAt = new Date('2026-09-24T08:49:00Z');
  await run();
  expect(api.sendText).not.toHaveBeenCalled();
});
it('waits for pending incoming events from the same chat', async () => {
  const { db, api, run } = fixture();
  db.avitoInboxEvent.count.mockResolvedValue(1);
  await run();
  expect(api.sendText).not.toHaveBeenCalled();
});
it('cancels a queued follow-up when an earlier reply was sent', async () => {
  const { db, api, run } = fixture();
  db.avitoOutgoing.findFirst.mockResolvedValue({ state: 'SENT' } as never);
  await run();
  expect(api.sendText).not.toHaveBeenCalled();
});
it('allows the first question before a completed lead exists', async () => {
  const { db, api, run } = fixture();
  db.lead.findFirst.mockResolvedValue(null as never);
  await run();
  expect(api.sendText).toHaveBeenCalledOnce();
});
it('does not send for a pre-launch incoming message even if its webhook arrived after launch', async () => {
  const { db, state, api } = fixture();
  state.clock.lastCustomerAt = '2026-09-24T08:59:00Z';
  db.avitoDialogue.findUnique.mockResolvedValue({
    leadId: 'l',
    contentEncrypted: encryptField(JSON.stringify(state), key),
  });
  await tickAssistant(
    { ...config, sendEnabledAt: new Date('2026-09-24T08:59:30Z') },
    api as unknown as AvitoClient,
    db as unknown as PrismaClient,
    true,
    now,
  );
  expect(api.sendText).not.toHaveBeenCalled();
});
it('does not pause again on a human message predating an explicit manual resume', async () => {
  const { db, api, state, run } = fixture();
  db.avitoDialogue.findUnique.mockResolvedValue({
    leadId: 'l',
    contentEncrypted: encryptField(
      JSON.stringify({ ...state, automationResumedAt: '2026-09-24T08:55:00Z' }),
      key,
    ),
  });
  api.messages.mockResolvedValue({
    messages: [
      {
        id: 'human-before-resume',
        created: Date.parse('2026-09-24T08:54:00Z') / 1000,
        direction: 'out',
        author_id: 11,
        type: 'text',
      },
    ],
    meta: { has_more: false },
  } as never);
  await run();
  expect(db.$transaction).not.toHaveBeenCalled();
  expect(api.sendText).toHaveBeenCalledOnce();
});
