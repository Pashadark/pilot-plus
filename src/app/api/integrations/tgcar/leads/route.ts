import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/database/prisma/client';
import { receiveWebsiteLead } from '@/modules/leads/website-intake';
export const runtime = 'nodejs';
const response = (value: unknown, status: number) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  const secret = process.env.TGCAR_LEAD_SECRET;
  if (!secret || secret.length < 32) return response({ error: 'Приём заявок не настроен' }, 503);
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (
    Buffer.byteLength(supplied) !== Buffer.byteLength(secret) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))
  )
    return response({ error: 'Нет доступа' }, 401);
  const length = Number(request.headers.get('content-length'));
  if (!length || length > 8192) return response({ error: 'Некорректный размер запроса' }, 413);
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8192) return response({ error: 'Слишком большой запрос' }, 413);
    const config = {
      companyId: process.env.TGCAR_LEAD_COMPANY_ID || '',
      userId: process.env.TGCAR_LEAD_USER_ID || '',
      encryptionKey: process.env.CLIENT_DATA_ENCRYPTION_KEY || '',
      searchKey: process.env.CLIENT_SEARCH_KEY || '',
    };
    const result = await receiveWebsiteLead(JSON.parse(raw), config, prisma);
    return response({ id: result.id, status: 'NEW' }, result.duplicate ? 200 : 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status =
      code === 'RATE'
        ? 429
        : code === 'CONFLICT'
          ? 409
          : code === 'INVALID' || code === 'VEHICLE'
            ? 400
            : 503;
    return response(
      {
        error:
          status === 429
            ? 'Слишком много заявок. Попробуйте позже.'
            : status === 409
              ? 'Данные заявки изменились. Создайте новую попытку.'
              : status === 400
                ? 'Проверьте данные заявки.'
                : 'Не удалось сохранить заявку. Повторите попытку.',
      },
      status,
    );
  }
}
