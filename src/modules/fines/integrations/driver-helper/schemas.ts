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
