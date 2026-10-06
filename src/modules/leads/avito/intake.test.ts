import { describe, expect, it, vi } from 'vitest';
import { receiveAvitoMessage } from './intake';
import { decryptField, encryptField } from '@/services/security/field-encryption';
import type { PrismaClient } from '@/database/generated/prisma';
import { extractRentalRequest } from './rental-request';

const config = {
  companyId: 'company',
  userId: 'operator',
  accountId: '11',
  enabledAt: new Date('2026-09-23T00:00:00Z'),
  encryptionKey: Buffer.alloc(32, 1).toString('base64'),
  searchKey: 'test-key',
};
const input = {
  eventId: 'event',
  chatId: 'chat',
  message: {
    id: 'm1',
    author_id: 22,
    direction: 'in',
    type: 'text',
    created: config.enabledAt.getTime() / 1000 + 1,
    content: { text: 'Нужна Camry на 5 дней' },
  },
  name: 'Клиент',
  title: 'Прокат',
  chatVerified: true,
};
function fixture(
  existing: {
    id: string;
    companyId: string;
    commentEncrypted: string;
    phoneEncrypted?: string;
  } | null = null,
) {
  const tx = {
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'operator', email: 'test@example.test' }) },
    avitoInboxEvent: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'event',
        state: 'PENDING',
        companyId: 'company',
        accountId: '11',
        chatId: 'chat',
        messageId: 'm1',
      }),
      update: vi.fn(),
    },
    lead: { findUnique: vi.fn().mockResolvedValue(existing), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue(null) },
    telegramIdentity: { findFirst: vi.fn().mockResolvedValue(null) },
    botNotificationJob: { createMany: vi.fn() },
  };
  const db = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as Pick<
    PrismaClient,
    '$transaction'
  >;
  return { tx, db };
}
describe('Avito transactional intake', () => {
  it('notifies staff once with a stable handoff key when a legacy lead becomes complete', async () => {
    const { tx, db } = fixture({
      id: 'lead',
      companyId: 'company',
      commentEncrypted: encryptField('Черновик', config.encryptionKey),
    });
    tx.telegramGroupBinding.findUnique.mockResolvedValue({ telegramChatId: '-100123' } as never);
    await receiveAvitoMessage(
      {
        ...input,
        rentalRequest: extractRentalRequest(
          'Камри завтра в 14:00 на 3 дня, всего 500 км, 89991234567',
          new Date('2026-09-24T09:00:00Z'),
        ),
      },
      config,
      db,
    );
    expect(tx.botNotificationJob.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            template: 'AVITO_READY',
            eventKey: expect.stringContaining('avito-ready:'),
          }),
        ],
      }),
    );
  });
  it('keeps an incomplete assistant request as dialogue only, not a new lead', async () => {
    const { tx, db } = fixture();
    await receiveAvitoMessage(
      {
        ...input,
        rentalRequest: extractRentalRequest('Камри на 3 дня', new Date('2026-09-24T09:00:00Z')),
      },
      config,
      db,
    );
    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.botNotificationJob.createMany).not.toHaveBeenCalled();
    expect(tx.avitoInboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'DONE' }) }),
    );
  });
  it('hands a completed request to staff with the accumulated phone and conversation', async () => {
    const { tx, db } = fixture();
    await receiveAvitoMessage(
      {
        ...input,
        rentalRequest: extractRentalRequest(
          'Камри завтра в 14:00 на 3 дня, всего 500 км, 8.916.717.65.56',
          new Date('2026-09-24T09:00:00Z'),
        ),
        conversationText: 'Камри на 3 дня\nЗавтра в 14:00\nВсего 500 км\n8.916.717.65.56',
      },
      config,
      db,
    );
    const data = tx.lead.create.mock.calls[0][0].data;
    expect(decryptField(data.phoneEncrypted, config.encryptionKey)).toBe('79167176556');
    expect(decryptField(data.commentEncrypted, config.encryptionKey)).toContain('Всего 500 км');
  });
  it('fills a previously empty phone from the reply without changing a manual phone', async () => {
    const event = {
      ...input,
      message: { ...input.message, content: { text: 'Мой телефон 89991234567' } },
    };
    const empty = fixture({
      id: 'lead',
      companyId: 'company',
      commentEncrypted: encryptField('Заметка', config.encryptionKey),
      phoneEncrypted: encryptField('', config.encryptionKey),
    });
    await receiveAvitoMessage(event, config, empty.db);
    expect(
      decryptField(empty.tx.lead.update.mock.calls[0][0].data.phoneEncrypted, config.encryptionKey),
    ).toBe('79991234567');
    const manual = fixture({
      id: 'lead',
      companyId: 'company',
      commentEncrypted: encryptField('Заметка', config.encryptionKey),
      phoneEncrypted: encryptField('79997654321', config.encryptionKey),
    });
    await receiveAvitoMessage(event, config, manual.db);
    expect(manual.tx.lead.update.mock.calls[0][0].data.phoneEncrypted).toBeUndefined();
  });
  it('ignores a verified non-rental ad when rental gating is enabled', async () => {
    const { tx, db } = fixture();
    await receiveAvitoMessage({ ...input, rentalAllowed: false }, config, db);
    expect(tx.lead.create).not.toHaveBeenCalled();
  });
  it('includes the missing fields as an internal manager prompt, without claiming an automatic message was sent', async () => {
    const { tx, db } = fixture();
    await receiveAvitoMessage(input, config, db);
    const comment = decryptField(
      tx.lead.create.mock.calls[0][0].data.commentEncrypted,
      config.encryptionKey,
    );
    expect(comment).toContain('Уточнить у клиента:');
    expect(comment).toContain('Какой общий пробег');
  });
  it('queues the existing manager notification in the same transaction on first lead only', async () => {
    const { tx, db } = fixture();
    tx.telegramGroupBinding.findUnique.mockResolvedValueOnce({
      telegramChatId: '-100123',
      boundByUserId: 'operator',
    });
    await receiveAvitoMessage(input, config, db);
    expect(tx.botNotificationJob.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            template: 'LEAD_CREATED',
            chatId: '-100123',
            companyId: 'company',
          }),
        ],
      }),
    );
  });
  it('creates encrypted lead without inventing phone and records completion', async () => {
    const { tx, db } = fixture();
    await receiveAvitoMessage(input, config, db);
    const data = tx.lead.create.mock.calls[0][0].data;
    expect(data.source).toBe('Авито');
    expect(decryptField(data.phoneEncrypted, config.encryptionKey)).toBe('');
    expect(decryptField(data.commentEncrypted, config.encryptionKey)).toContain(
      'Нужна Camry на 5 дней',
    );
    expect(tx.avitoInboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'DONE' }) }),
    );
  });
  it('preserves manager status and original comment on later messages', async () => {
    const { tx, db } = fixture({
      id: 'lead',
      companyId: 'company',
      commentEncrypted: encryptField('Ручная заметка', config.encryptionKey),
    });
    await receiveAvitoMessage(input, config, db);
    const data = tx.lead.update.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(['commentEncrypted']);
    expect(decryptField(data.commentEncrypted, config.encryptionKey)).toContain('Ручная заметка');
    expect(tx.telegramGroupBinding.findUnique).not.toHaveBeenCalled();
  });
  it('does nothing on duplicate delivery', async () => {
    const { tx, db } = fixture();
    tx.avitoInboxEvent.findUnique.mockResolvedValueOnce({ state: 'DONE' });
    await receiveAvitoMessage(input, config, db);
    expect(tx.lead.create).not.toHaveBeenCalled();
  });
  it('ignores historical messages', async () => {
    const { tx, db } = fixture();
    await receiveAvitoMessage({ ...input, message: { ...input.message, created: 1 } }, config, db);
    expect(tx.lead.create).not.toHaveBeenCalled();
  });
  it('rejects mismatched queue tenant before writing any lead', async () => {
    const { tx, db } = fixture();
    tx.avitoInboxEvent.findUnique.mockResolvedValueOnce({ state: 'PENDING', companyId: 'other' });
    await expect(receiveAvitoMessage(input, config, db)).rejects.toThrow('AVITO_SCOPE');
    expect(tx.lead.create).not.toHaveBeenCalled();
  });
});
