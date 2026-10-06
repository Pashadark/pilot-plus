import { prisma } from '@/database/prisma/client';
import { acceptCallback } from '@/modules/leads/avito/receiver';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  return acceptCallback(
    request,
    secret,
    {
      secret: process.env.AVITO_WEBHOOK_SECRET || '',
      companyId: process.env.AVITO_COMPANY_ID || '',
      accountId: process.env.AVITO_ACCOUNT_ID || '',
    },
    prisma,
  );
}
