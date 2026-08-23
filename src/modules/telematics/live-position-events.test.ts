import { describe, expect, it, vi } from 'vitest';

import { livePositionChannel, publishLivePositionEvent } from './live-position-events';

describe('события живой GPS-карты', () => {
  it('публикует только компактное tenant-событие', async () => {
    const publish = vi.fn().mockResolvedValue(1);

    await publishLivePositionEvent(
      {
        companyId: 'company-a',
        vehicleIds: ['vehicle-2', 'vehicle-1', 'vehicle-1'],
        emittedAt: '2026-08-23T06:00:00.000Z',
      },
      { publish },
    );

    expect(publish).toHaveBeenCalledWith(
      livePositionChannel('company-a'),
      JSON.stringify({
        companyId: 'company-a',
        vehicleIds: ['vehicle-1', 'vehicle-2'],
        emittedAt: '2026-08-23T06:00:00.000Z',
      }),
    );
  });

  it('отклоняет небезопасные идентификаторы до публикации', async () => {
    const publish = vi.fn();
    await expect(
      publishLivePositionEvent(
        { companyId: '../other', vehicleIds: ['vehicle-1'], emittedAt: new Date().toISOString() },
        { publish },
      ),
    ).rejects.toThrow('INVALID_LIVE_POSITION_EVENT');
    expect(publish).not.toHaveBeenCalled();
  });
});
