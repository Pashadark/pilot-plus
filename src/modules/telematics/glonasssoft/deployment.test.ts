import { readFile } from 'node:fs/promises';

import { expect, it } from 'vitest';

it('запускает GPS-worker как защищённый восстанавливаемый systemd-сервис', async () => {
  const unit = await readFile('deploy/pilot-plus-glonasssoft-worker.service', 'utf8');
  expect(unit).toContain('User=pilot-plus');
  expect(unit).toContain('EnvironmentFile=/etc/pilot-plus.env');
  expect(unit).toContain('ExecStart=/usr/bin/npm run telematics:live-glonasssoft');
  expect(unit).toContain('Restart=always');
  expect(unit).toContain('NoNewPrivileges=true');
  expect(unit).toContain('ProtectSystem=strict');
});
