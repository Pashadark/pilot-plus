import { z } from 'zod';

import {
  RENTAL_PAYMENT_KINDS,
  RENTAL_PAYMENT_METHODS,
  RENTAL_SIGNATURE_PARTIES,
  RENTAL_SIGNATURE_STATUSES,
} from './types';

const requiredId = z.string().trim().min(1, 'Не указан договор.');
const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((value) => value || undefined)
  .optional();

export const paymentCommandSchema = z.object({
  rentalId: requiredId,
  kind: z.enum(RENTAL_PAYMENT_KINDS),
  status: z
    .enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
    .default('CONFIRMED'),
  amountMinor: z
    .union([z.string(), z.bigint(), z.number().int()])
    .transform((value, context) => {
      try {
        return BigInt(value);
      } catch {
        context.addIssue({ code: 'custom', message: 'Укажите корректную сумму.' });
        return z.NEVER;
      }
    })
    .pipe(z.bigint().positive('Сумма должна быть больше нуля.')),
  method: z.enum(RENTAL_PAYMENT_METHODS),
  reference: optionalText,
  comment: optionalText,
  idempotencyKey: z.string().trim().min(8).max(191),
});

export const signatureCommandSchema = z
  .object({
    rentalId: requiredId,
    party: z.enum(RENTAL_SIGNATURE_PARTIES),
    status: z.enum(RENTAL_SIGNATURE_STATUSES),
    signedByName: z.string().trim().max(200).optional(),
    comment: optionalText,
  })
  .superRefine((value, context) => {
    if (value.status === 'SIGNED' && !value.signedByName) {
      context.addIssue({
        code: 'custom',
        path: ['signedByName'],
        message: 'Укажите, кто подписал договор.',
      });
    }
  });

export type PaymentCommand = z.infer<typeof paymentCommandSchema>;
export type SignatureCommand = z.infer<typeof signatureCommandSchema>;
