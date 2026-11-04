import { prisma } from '@/database/prisma/client';

import { authenticateOwnerRequest, type OwnerAccessRepository } from './access';

const repository = {
  async findActiveSession({ sessionId, ownerProfileId, now }) {
    const session = await prisma.ownerSession.findFirst({
      where: {
        id: sessionId,
        ownerProfileId,
        revokedAt: null,
        expiresAt: { gt: now },
        ownerProfile: { status: 'ACTIVE' },
      },
      select: {
        ownerProfile: {
          select: {
            id: true,
            companyId: true,
            displayName: true,
            phoneE164: true,
          },
        },
      },
    });

    return session?.ownerProfile ?? null;
  },
} satisfies OwnerAccessRepository;

export async function authenticateSupaCarOwner(request: Request) {
  const secret = process.env.SUPA_CAR_AUTH_SECRET;
  if (!secret) throw new Error('SUPA_CAR_AUTH_SECRET is not configured.');

  return authenticateOwnerRequest(request, repository, secret);
}
