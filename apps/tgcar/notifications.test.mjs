import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReminderEvents, isReminderCurrent, telegramDelivery } from './notifications.mjs';

const rental = {
  id: 'rental-1',
  clientId: 'client-1',
  status: 'ACTIVE',
  endsAt: '2026-09-22T12:00:00.000Z',
  revision: 4,
};

test('builds only due reminders while an active rental has not ended', () => {
  assert.deepEqual(buildReminderEvents(rental, Date.parse('2026-09-21T11:59:59.999Z')), []);

  const at24Hours = buildReminderEvents(rental, Date.parse('2026-09-21T12:00:00.000Z'));
  assert.equal(at24Hours.length, 1);
  assert.equal(at24Hours[0].milestone, '24h');
  assert.equal(at24Hours[0].dueAt, '2026-09-21T12:00:00.000Z');
  assert.match(at24Hours[0].dedupeKey, /rental-1.*4.*2026-09-22.*24h/);

  const at3Hours = buildReminderEvents(rental, Date.parse('2026-09-22T09:00:00.000Z'));
  assert.deepEqual(
    at3Hours.map((event) => event.milestone),
    ['24h', '3h'],
  );
  assert.deepEqual(buildReminderEvents(rental, Date.parse(rental.endsAt)), []);
  assert.deepEqual(buildReminderEvents({ ...rental, status: 'CONFIRMED' }, Date.now()), []);
});

test('changed end dates and revisions make prior reminders obsolete', () => {
  const [event] = buildReminderEvents(rental, Date.parse('2026-09-21T12:00:00.000Z'));
  assert.equal(isReminderCurrent(event, rental), true);
  assert.equal(isReminderCurrent(event, { ...rental, revision: 5 }), false);
  assert.equal(isReminderCurrent(event, { ...rental, endsAt: '2026-09-23T12:00:00.000Z' }), false);
  assert.equal(isReminderCurrent(event, { ...rental, status: 'COMPLETED' }), false);

  const [changed] = buildReminderEvents(
    { ...rental, endsAt: '2026-09-23T12:00:00.000Z' },
    Date.parse('2026-09-22T12:00:00.000Z'),
  );
  assert.notEqual(changed.dedupeKey, event.dedupeKey);
});

test('Telegram delivery is disabled unless explicitly and completely configured', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error('must not send');
  };
  const event = { text: 'Возврат через 3 часа' };

  for (const config of [
    {},
    { enabled: false, token: 'secret', chatId: '1' },
    { enabled: true, chatId: '1' },
    { enabled: true, token: 'secret' },
  ]) {
    const result = await telegramDelivery(event, config, fetchImpl);
    assert.equal(result.status, 'disabled');
  }
  assert.equal(calls, 0);
});

test('Telegram delivery sends plain text only when enabled', async () => {
  let request;
  const result = await telegramDelivery(
    { text: '<b>Возврат</b> & проверка' },
    { enabled: true, token: 'secret-token', chatId: '42', timeoutMs: 250 },
    async (url, options) => {
      request = { url, options };
      return { status: 200, ok: true, json: async () => ({ ok: true }) };
    },
  );

  assert.equal(result.status, 'sent');
  assert.equal(result.sent, true);
  assert.match(request.url, /sendMessage$/);
  assert.deepEqual(JSON.parse(request.options.body), {
    chat_id: '42',
    text: '<b>Возврат</b> & проверка',
  });
  assert.equal(request.options.signal instanceof AbortSignal, true);
});

test('Telegram delivery classifies retryable and permanent failures without leaking tokens', async () => {
  const config = { enabled: true, token: 'do-not-leak', chatId: '42' };
  const event = { text: 'Напоминание' };

  const limited = await telegramDelivery(event, config, async () => ({
    status: 429,
    ok: false,
    json: async () => ({ ok: false, parameters: { retry_after: 17 } }),
  }));
  assert.deepEqual(limited, { status: 'retry', retry: true, retryAfterSeconds: 17 });

  const serverError = await telegramDelivery(event, config, async () => ({
    status: 503,
    ok: false,
    json: async () => ({ ok: false }),
  }));
  assert.equal(serverError.status, 'retry');

  const forbidden = await telegramDelivery(event, config, async () => ({
    status: 403,
    ok: false,
    json: async () => ({ ok: false, description: 'do-not-leak' }),
  }));
  assert.deepEqual(forbidden, { status: 'permanent', permanent: true });

  const network = await telegramDelivery(event, config, async () => {
    throw new Error('request for do-not-leak failed');
  });
  assert.equal(network.status, 'retry');
  assert.doesNotMatch(JSON.stringify(network), /do-not-leak/);
});

test('Telegram delivery retries when reading an HTTP response body fails', async () => {
  const result = await telegramDelivery(
    { text: 'Напоминание' },
    { enabled: true, token: 'secret', chatId: '42' },
    async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new DOMException('body stream aborted', 'AbortError');
      },
    }),
  );

  assert.deepEqual(result, { status: 'retry', retry: true });
});

test('Telegram delivery aborts a stalled request at the configured bounded timeout', async () => {
  let observedSignal;
  const startedAt = Date.now();
  const result = await telegramDelivery(
    { text: 'Напоминание' },
    { enabled: true, token: 'secret', chatId: '42', timeoutMs: 5 },
    async (_url, options) => {
      observedSignal = options.signal;
      return await new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), {
          once: true,
        });
      });
    },
  );

  assert.equal(observedSignal.aborted, true);
  assert.equal(result.status, 'retry');
  assert.ok(Date.now() - startedAt < 1_000);
});
