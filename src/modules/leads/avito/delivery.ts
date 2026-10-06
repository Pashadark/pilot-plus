import { record } from './message';

/** Reservation must be durable; a process crash leaves SENDING, never a retryable job. */
export async function sendReservedQuestion(io: {
  reserve: () => Promise<boolean>;
  send: () => Promise<unknown>;
  finish: (state: 'SENT' | 'UNKNOWN', providerId: string | null) => Promise<unknown>;
}) {
  if (!(await io.reserve())) return;
  let providerId: string | null = null;
  try {
    const response = record(await io.send());
    if (typeof response.id === 'string' && /^[\w:-]{1,150}$/.test(response.id))
      providerId = response.id;
  } catch {
    // Even a timeout may mean the provider accepted the message. Never resend automatically.
  }
  await io.finish(providerId ? 'SENT' : 'UNKNOWN', providerId);
}
