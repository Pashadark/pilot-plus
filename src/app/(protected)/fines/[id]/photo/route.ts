import { prisma } from '@/database/prisma/client';
import { getFineAccess } from '@/modules/fines/access';
import { DriverHelperClient } from '@/modules/fines/integrations/driver-helper/client';
import { decryptField } from '@/services/security/field-encryption';

import { getFinePhotoResponse } from './photo-response';

function decodePhoto(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/u.exec(value);
  if (!match?.[1] || !match[2]) return null;
  const bytes = Uint8Array.from(Buffer.from(match[2], 'base64'));
  return { mime: match[1], bytes };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return getFinePhotoResponse(id, {
    loadAuthorizedFine: async (fineId) => {
      const access = await getFineAccess();
      if (!access) return null;
      return prisma.fine.findFirst({
        where: {
          id: fineId,
          ...(access.scope === 'COMPANY' ? { companyId: { in: [...access.companyIds] } } : {}),
        },
        select: { externalId: true, companyId: true },
      });
    },
    fetchPhoto: async (fine) => {
      const integration = await prisma.fineIntegration.findUnique({
        where: { companyId: fine.companyId },
        select: { tokenEncrypted: true, enabled: true },
      });
      const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
      if (!integration?.enabled || !key) return null;
      const client = new DriverHelperClient({
        token: decryptField(integration.tokenEncrypted, key),
      });
      const result = await client.getFinePhotos(fine.externalId);
      return result.photos[0] ? decodePhoto(result.photos[0]) : null;
    },
  });
}
