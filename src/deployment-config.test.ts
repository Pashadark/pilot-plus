import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import nextConfig from '../next.config';

describe('Next deployment versioning', () => {
  it('enables deployment skew protection for Server Actions', () => {
    expect(Object.hasOwn(nextConfig, 'deploymentId')).toBe(true);
  });

  it('installs a daily safe release-retention job', () => {
    const pruneScript = readFileSync(join(process.cwd(), 'deploy/prune-releases.sh'), 'utf8');
    const service = readFileSync(
      join(process.cwd(), 'deploy/pilot-plus-prune-releases.service'),
      'utf8',
    );
    const timer = readFileSync(
      join(process.cwd(), 'deploy/pilot-plus-prune-releases.timer'),
      'utf8',
    );

    expect(pruneScript).toContain('PILOT_PLUS_KEEP_RELEASES:-5');
    expect(pruneScript).toContain('readlink -f "$current_link"');
    expect(pruneScript).toContain('rm -rf -- "$resolved"');
    expect(service).toContain('ExecStart=/usr/local/sbin/pilot-plus-prune-releases');
    expect(timer).toContain('OnCalendar=*-*-* 03:30:00 Europe/Moscow');
    expect(timer).toContain('Persistent=true');
  });
});
