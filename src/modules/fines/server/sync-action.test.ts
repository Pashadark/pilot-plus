import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAccess = vi.hoisted(() => vi.fn());
const sync = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock('../access', () => ({ requireFineManageAccess: requireAccess }));
vi.mock('../sync/sync-company-fines.server', () => ({ syncCompanyFines: sync }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

import { syncFinesAction } from './sync-action';

describe('syncFinesAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('authorizes the exact company before synchronization', async () => {
    const form = new FormData();
    form.set('companyId', 'company-a');

    await syncFinesAction(form);

    expect(requireAccess).toHaveBeenCalledWith('company-a');
    expect(sync).toHaveBeenCalledWith('company-a');
    expect(revalidatePath).toHaveBeenCalledWith('/fines');
    expect(redirect).toHaveBeenCalledWith('/fines?companyId=company-a&sync=success');
  });
});
