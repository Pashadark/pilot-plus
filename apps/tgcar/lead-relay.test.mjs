import test from 'node:test';
import assert from 'node:assert/strict';
import { relayLead } from './server/lead-relay.mjs';
const config = {
  TGCAR_LEAD_URL: 'http://127.0.0.1:3000/api/integrations/tgcar/leads',
  TGCAR_LEAD_SECRET: 'x'.repeat(40),
};
test('disabled or unsafe relay configuration never sends', async () => {
  let sent = false;
  const send = async () => {
    sent = true;
  };
  await assert.rejects(() => relayLead({}, {}, send));
  await assert.rejects(() =>
    relayLead({}, { ...config, TGCAR_LEAD_URL: 'http://example.com/api' }, send),
  );
  assert.equal(sent, false);
});
test('relay requires upstream saved id and does not claim success on outage', async () => {
  await assert.rejects(() =>
    relayLead({}, config, async () => new Response('{}', { status: 503 })),
  );
  await assert.rejects(() => relayLead({}, config, async () => Response.json({ ok: true })));
  const result = await relayLead({ name: 'Test' }, config, async (url, options) => {
    assert.equal(url, config.TGCAR_LEAD_URL);
    assert.equal(options.headers.Authorization, 'Bearer ' + config.TGCAR_LEAD_SECRET);
    return Response.json({ id: 'tgcar_' + 'a'.repeat(40), status: 'NEW' });
  });
  assert.equal(result.status, 'NEW');
});
