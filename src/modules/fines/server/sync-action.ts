'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireFineManageAccess } from '../access';
import { syncCompanyFines } from '../sync/sync-company-fines.server';

export async function syncFinesAction(formData: FormData): Promise<void> {
  const companyId = formData.get('companyId');
  if (typeof companyId !== 'string' || companyId.length < 1 || companyId.length > 128) return;

  let outcome = 'success';
  try {
    await requireFineManageAccess(companyId);
    await syncCompanyFines(companyId);
    revalidatePath('/fines');
  } catch {
    outcome = 'error';
  }
  redirect(`/fines?companyId=${encodeURIComponent(companyId)}&sync=${outcome}`);
}
