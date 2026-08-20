import { z } from 'zod';

export const linkIdentitySchema = z.object({
  inviteToken: z.string().min(16).max(512),
  telegramUserId: z.string().regex(/^[1-9]\d{0,19}$/u),
});

export type LinkIdentityInput = z.infer<typeof linkIdentitySchema>;

export interface BotProfile {
  kind: 'CLIENT' | 'STAFF';
  companyId: string;
  clientId: string | null;
  userId: string | null;
  displayName: string;
}
