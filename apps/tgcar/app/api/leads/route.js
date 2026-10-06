import { relayLead } from '../../../server/lead-relay.mjs';
import { allowedOrigin } from '../../../server/request-origin.mjs';
export const runtime = 'nodejs';
const json = (data, status) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request) {
  if (!allowedOrigin(request))
    return json({ error: 'Источник запроса не разрешён' }, 403);
  const length = Number(request.headers.get('content-length'));
  if (!length || length > 8192) return json({ error: 'Слишком большой запрос' }, 413);
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8192) return json({ error: 'Слишком большой запрос' }, 413);
    const body = JSON.parse(raw);
    // Only the contact request is forwarded; no session, document, payment, or tenant fields.
    const payload = {
      requestId: body.requestId,
      name: body.name,
      phone: body.phone,
      vehicleId: body.vehicleId,
      start: body.start,
      end: body.end,
      startTime: body.startTime,
      endTime: body.endTime,
      comment: body.comment || '',
      consent: body.consent,
    };
    if (
      payload.consent !== true ||
      typeof payload.name !== 'string' ||
      typeof payload.phone !== 'string'
    )
      return json({ error: 'Заполните имя, телефон и согласие' }, 400);
    return json(await relayLead(payload), 201);
  } catch (error) {
    return json(
      {
        error: [400, 409, 429].includes(error.status)
          ? error.message
          : 'Заявка не подтверждена системой. Проверьте связь и повторите отправку. Повтор не создаст дубликат.',
      },
      [400, 409, 429].includes(error.status) ? error.status : 503,
    );
  }
}
