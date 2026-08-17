import { z } from 'zod';

const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu;

const schema = z.object({
  clientId: z.string().trim().min(1).max(128),
  rentalId: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().min(1).max(128).nullable().default(null),
  ),
  category: z
    .enum(['GENERAL', 'POSITIVE', 'PROBLEM', 'DAMAGE', 'PAYMENT', 'VIOLATION'])
    .default('GENERAL'),
  severity: z.enum(['INFO', 'WARNING', 'DANGER']).default('INFO'),
  text: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .transform((value) => value.replace(controlCharacters, '')),
});

export function parseClientCommentInput(input: unknown) {
  const parsed = schema.safeParse(input);
  if (parsed.success && parsed.data.text.length > 0)
    return { ok: true as const, data: parsed.data };
  return { ok: false as const, message: 'Проверьте текст и параметры комментария.' };
}
