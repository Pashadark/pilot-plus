import { z } from 'zod';

import { prisma } from '@/database/prisma/client';
import {
  loginOwner,
  OwnerAuthError,
  type OwnerAuthRepository,
} from '@/modules/supa-car/auth/service';

const HEADERS = { 'Cache-Control': 'private, no-store' };
const loginSchema = z.object({
  phone: z.string().trim().min(3).max(32),
  password: z.string().min(1).max(256),
  deviceName: z.string().trim().min(1).max(120).optional(),
});

const repository = {
  findByPhone(phoneE164) {
    return prisma.ownerProfile.findUnique({
      where: { phoneE164 },
      select: {
        id: true,
        displayName: true,
        phoneE164: true,
        passwordHash: true,
        status: true,
      },
    });
  },
  createSession(input) {
    return prisma.ownerSession.create({ data: input, select: { id: true } });
  },
} satisfies OwnerAuthRepository;

export async function POST(request: Request): Promise<Response> {
  try {
    const length = Number(request.headers.get('content-length') ?? '0');
    if (!Number.isFinite(length) || length > 4096) {
      return Response.json(
        { error: { code: 'INVALID_REQUEST' } },
        { status: 400, headers: HEADERS },
      );
    }

    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'INVALID_REQUEST' } },
        { status: 400, headers: HEADERS },
      );
    }

    const secret = process.env.SUPA_CAR_AUTH_SECRET;
    if (!secret) throw new Error('SUPA_CAR_AUTH_SECRET is not configured.');
    const result = await loginOwner(parsed.data, repository, secret);
    return Response.json(result, { headers: HEADERS });
  } catch (error) {
    if (error instanceof OwnerAuthError) {
      return Response.json(
        { error: { code: error.code } },
        { status: error.status, headers: HEADERS },
      );
    }
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: { code: 'INVALID_REQUEST' } },
        { status: 400, headers: HEADERS },
      );
    }
    return Response.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500, headers: HEADERS });
  }
}
