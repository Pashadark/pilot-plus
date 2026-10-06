const HOUR_MS = 60 * 60 * 1000;
const REMINDER_MILESTONES = [
  { milestone: '24h', beforeEndMs: 24 * HOUR_MS },
  { milestone: '3h', beforeEndMs: 3 * HOUR_MS },
];

function normalizedRental(rental) {
  if (!rental || rental.status !== 'ACTIVE') return null;
  if (!rental.id || !rental.clientId || rental.revision == null) return null;
  const endsAtMs = Date.parse(rental.endsAt);
  if (!Number.isFinite(endsAtMs)) return null;
  return { ...rental, endsAtMs, endsAt: new Date(endsAtMs).toISOString() };
}

function reminderKey(rental, milestone) {
  return ['rental-end-reminder', rental.id, rental.revision, rental.endsAt, milestone].join(':');
}

export function buildReminderEvents(rental, now = Date.now()) {
  const current = normalizedRental(rental);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!current || !Number.isFinite(nowMs) || nowMs >= current.endsAtMs) return [];

  return REMINDER_MILESTONES.filter(
    ({ beforeEndMs }) => nowMs >= current.endsAtMs - beforeEndMs,
  ).map(({ milestone, beforeEndMs }) => ({
    type: 'RENTAL_END_REMINDER',
    rentalId: current.id,
    clientId: current.clientId,
    revision: current.revision,
    endsAt: current.endsAt,
    milestone,
    dueAt: new Date(current.endsAtMs - beforeEndMs).toISOString(),
    dedupeKey: reminderKey(current, milestone),
    text: `Напоминание: аренда ${current.id} завершится через ${milestone === '24h' ? '24 часа' : '3 часа'}.`,
  }));
}

export function isReminderCurrent(event, rental) {
  const current = normalizedRental(rental);
  if (!current || !event) return false;
  if (!REMINDER_MILESTONES.some(({ milestone }) => milestone === event.milestone)) {
    return false;
  }
  return (
    event.type === 'RENTAL_END_REMINDER' &&
    event.rentalId === current.id &&
    event.clientId === current.clientId &&
    event.revision === current.revision &&
    event.endsAt === current.endsAt &&
    event.dedupeKey === reminderKey(current, event.milestone)
  );
}

async function responseBody(response) {
  return await response.json();
}

function retryResult(retryAfterSeconds) {
  const result = { status: 'retry', retry: true };
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    result.retryAfterSeconds = retryAfterSeconds;
  }
  return result;
}

export async function telegramDelivery(event, config = {}, fetchImpl = fetch) {
  if (config.enabled !== true || !config.token || !config.chatId) {
    return { status: 'disabled', disabled: true };
  }

  const configuredTimeout = Number(config.timeoutMs);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, 1), 10_000)
    : 5_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(config.chatId),
        text: String(event?.text ?? ''),
      }),
      signal: controller.signal,
    });
    const body = await responseBody(response);

    if (response.status === 429) {
      return retryResult(Number(body?.parameters?.retry_after));
    }
    if (response.status >= 500) return retryResult();
    if (response.status === 403) return { status: 'permanent', permanent: true };
    if (response.ok && body?.ok === true) return { status: 'sent', sent: true };
    return { status: 'permanent', permanent: true };
  } catch {
    return retryResult();
  } finally {
    clearTimeout(timeout);
  }
}
