import { describe, expect, it } from 'vitest';

import { buildLeadNotificationRows } from './notification-jobs';

describe('lead notification jobs', () => {
  it('creates id-only jobs for the work group and the binding owner', () => {
    const now = new Date('2026-09-07T08:00:00.000Z');
    const rows = buildLeadNotificationRows(
      {
        companyId: 'company-1',
        leadId: 'lead-1',
        auditId: 'audit-1',
        template: 'LEAD_CREATED',
      },
      { groupChatId: '-100777', personalIdentityId: 'identity-owner' },
      now,
    );

    expect(rows).toEqual([
      expect.objectContaining({
        companyId: 'company-1',
        template: 'LEAD_CREATED',
        chatId: '-100777',
        eventKey: 'lead-created:lead-1:group',
        payload: { leadId: 'lead-1', auditId: 'audit-1' },
        availableAt: now,
      }),
      expect.objectContaining({
        companyId: 'company-1',
        template: 'LEAD_CREATED',
        identityId: 'identity-owner',
        eventKey: 'lead-created:lead-1:staff:identity-owner',
        payload: { leadId: 'lead-1', auditId: 'audit-1' },
        availableAt: now,
      }),
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/phone|comment|firstName|lastName/iu);
  });

  it('uses the audit event as the stable key for a status change', () => {
    const rows = buildLeadNotificationRows(
      {
        companyId: 'company-1',
        leadId: 'lead-1',
        auditId: 'audit-status-1',
        template: 'LEAD_STATUS_CHANGED',
      },
      { groupChatId: '-100777', personalIdentityId: null },
      new Date('2026-09-07T08:00:00.000Z'),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventKey: 'lead-status:audit-status-1:group',
      payload: { leadId: 'lead-1', auditId: 'audit-status-1' },
    });
  });
});
