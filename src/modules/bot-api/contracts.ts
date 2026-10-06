import { z } from 'zod';

export const linkIdentitySchema = z.object({
  inviteToken: z.string().min(16).max(512).optional(),
  telegramUserId: z.string().regex(/^[1-9]\d{0,19}$/u),
  contactUserId: z
    .string()
    .regex(/^[1-9]\d{0,19}$/u)
    .optional(),
  phoneNumber: z.string().min(7).max(40).optional(),
});

export type LinkIdentityInput = z.infer<typeof linkIdentitySchema>;

export interface BotProfile {
  kind: 'CLIENT' | 'STAFF';
  companyId: string;
  clientId: string | null;
  userId: string | null;
  displayName: string;
}
