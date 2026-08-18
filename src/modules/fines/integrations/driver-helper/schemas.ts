import { z } from 'zod';

export const driverHelperCarSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string().default(''),
    regnum: z.string().nullish(),
    stsnum: z.string().nullish(),
  })
  .passthrough();

export const driverHelperFineSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    post_mum: z.string().nullish(),
    post_num: z.string().nullish(),
    fine_date: z.string(),
    suma: z.union([z.string(), z.number()]),
    total_suma: z.union([z.string(), z.number()]),
    post_date: z.string().nullish(),
    discount_size: z.coerce.number().int().min(0).max(100).nullish(),
    discount_date: z.string().nullish(),
    koap_code: z.string().nullish(),
    koap_text: z.string().nullish(),
    address: z.string().nullish(),
    paid: z.coerce.boolean().default(false),
    cancelled: z.coerce.boolean().default(false),
    to_bailiff: z.coerce.boolean().default(false),
    photo_urls: z.array(z.string()).nullish(),
    car: driverHelperCarSchema.nullish(),
  })
  .passthrough();

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z
    .object({
      totalCount: z.coerce.number().int().min(0),
      current: z.coerce.number().int().min(1),
      last: z.coerce.number().int().min(1),
      items: z.array(item),
    })
    .passthrough();
}

export const driverHelperCarsPageSchema = paginatedSchema(driverHelperCarSchema);
export const driverHelperFinesPageSchema = paginatedSchema(driverHelperFineSchema);

export const driverHelperFinePhotosSchema = z.object({
  status: z.enum(['photo_exists', 'photo_no', 'photo_in_process']),
  photos: z.array(z.string()).default([]),
});

const invoiceMoneySchema = z.string().regex(/^(?:0|[1-9]\d{0,14})(?:[.,]\d{1,2})?$/u);

const invoiceAmountsSchema = z
  .object({
    amount_fines: z.unknown().optional(),
    amount_commission: z.unknown().optional(),
    amount_total: z.unknown().optional(),
    fine_amount: z.unknown().optional(),
    commission_amount: z.unknown().optional(),
    total_amount: z.unknown().optional(),
    'Сумма штрафов': z.unknown().optional(),
    Комиссия: z.unknown().optional(),
    Итого: z.unknown().optional(),
  })
  .passthrough()
  .transform((value, context) => {
    const amount = (
      names: readonly string[],
      field: 'fineAmount' | 'commissionAmount' | 'totalAmount',
    ) => {
      const candidate = names.map((name) => value[name]).find((entry) => entry !== undefined);
      const parsed = invoiceMoneySchema.safeParse(candidate);
      if (parsed.success) return parsed.data;
      context.addIssue({ code: 'custom', message: `Invalid ${field}` });
      return z.NEVER;
    };

    return {
      fineAmount: amount(['amount_fines', 'fine_amount', 'Сумма штрафов'], 'fineAmount'),
      commissionAmount: amount(
        ['amount_commission', 'commission_amount', 'Комиссия'],
        'commissionAmount',
      ),
      totalAmount: amount(['amount_total', 'total_amount', 'Итого'], 'totalAmount'),
    };
  });

export const driverHelperInvoiceCheckSchema = invoiceAmountsSchema;

export const driverHelperInvoiceCreateSchema = invoiceAmountsSchema
  .and(
    z
      .object({
        invoice_id: z.string().trim().min(1).max(191).optional(),
        id: z.string().trim().min(1).max(191).optional(),
        pay_url: z.string().min(1).optional(),
        payment_url: z.string().min(1).optional(),
      })
      .passthrough(),
  )
  .transform((value, context) => {
    const providerInvoiceId = value.invoice_id ?? value.id;
    const paymentUrl = value.pay_url ?? value.payment_url;
    if (!providerInvoiceId) context.addIssue({ code: 'custom', message: 'Missing invoice ID' });
    if (!paymentUrl) context.addIssue({ code: 'custom', message: 'Missing payment URL' });
    return { ...value, providerInvoiceId: providerInvoiceId ?? '', paymentUrl: paymentUrl ?? '' };
  });

export function driverHelperMoneyToMinor(value: string): string {
  const [rubles, kopecks = ''] = value.replace(',', '.').split('.');
  return (BigInt(rubles) * BigInt(100) + BigInt(kopecks.padEnd(2, '0'))).toString();
}
