import { timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@/database/generated/prisma';
import { avitoId, parseCallback } from './message';

export async function acceptCallback(
  request: Request,
  supplied: string,
  config: { secret: string; companyId: string; accountId: string },
  db: Pick<PrismaClient, '$transaction'>,
) {
  const reply = (status: number) =>
    Response.json({ ok: status === 200 }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (config.secret.length < 32 || !config.companyId || !config.accountId) return reply(503);
  if (
    Buffer.byteLength(supplied) !== Buffer.byteLength(config.secret) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(config.secret))
  )
    return reply(404);
  if (Number(request.headers.get('content-length')) > 16384) return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        return reply(413);
      }
      chunks.push(chunk.value);
    }
    let callback;
    try {
      callback = parseCallback(
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
        config.accountId,
      );
    } catch {
      return reply(400);
    }
    if (!callback) return reply(200);
    await db.$transaction(
      async (tx) => {
        const pending = await tx.avitoInboxEvent.count({
          where: { companyId: config.companyId, state: 'PENDING' },
        });
        if (pending >= 1000) throw Error('QUEUE_FULL');
        await tx.avitoInboxEvent.createMany({
          data: [
            {
              id: avitoId(config.companyId, config.accountId, callback.chatId, callback.messageId),
              companyId: config.companyId,
              accountId: config.accountId,
              ...callback,
            },
          ],
          skipDuplicates: true,
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return reply(200);
  } catch {
    return reply(503);
  } finally {
    reader.releaseLock();
  }
}
