import { expect, it, vi } from 'vitest';
import { activeRentalIds, readHumanReplies } from './assistant-runtime';
it('requires explicit rental category and approved ID in active inventory', () => {
  expect([
    ...activeRentalIds({
      resources: [
        { id: 8252873021, title: 'Аренда Toyota Camry', category: { id: 114 } },
        { id: 7837710475, title: 'Комплект колёс', category: { id: 10 } },
        { id: 999, title: 'Аренда', category: { id: 114 } },
      ],
    }),
  ]).toEqual(['8252873021']);
});
it('reads authoritative history, excluding own bot messages from human replies', async () => {
  const api = {
    messages: vi.fn().mockResolvedValue({
      messages: [
        { id: 'h1', created: 100, author_id: 11, direction: 'out', type: 'text' },
        { id: 'b1', created: 101, author_id: 11, direction: 'out', type: 'text' },
        { id: 'c1', created: 102, author_id: 22, direction: 'in', type: 'text' },
      ],
      meta: { has_more: false },
    }),
  };
  const result = await readHumanReplies(api, '11', 'chat', new Date(90000), new Set(['b1']));
  expect(result.map((m) => m.id)).toEqual(['h1']);
});
it('does not treat an incomplete provider response as no human reply', async () => {
  await expect(
    readHumanReplies(
      { messages: async () => ({ messages: [] }) },
      '11',
      'chat',
      new Date(),
      new Set(),
    ),
  ).rejects.toThrow('AVITO_FORMAT');
});
