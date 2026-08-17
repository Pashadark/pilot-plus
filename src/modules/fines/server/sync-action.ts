'use server';

import { revalidatePath } from 'next/cache';

import { requireFineManageAccess } from '../access';
import { syncCompanyFines } from '../sync/sync-company-fines.server';

export async function syncFinesAction(formData: FormData): Promise<void> {
  const companyId = formData.get('companyId');
  if (typeof companyId !== 'string' || companyId.length < 1 || companyId.length > 128) return;

  await requireFineManageAccess(companyId);
  await syncCompanyFines(companyId);
  revalidatePath('/fines');
}
