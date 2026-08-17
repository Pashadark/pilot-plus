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
