import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import nextConfig from '../next.config';

describe('Next deployment versioning', () => {
  it('enables deployment skew protection for Server Actions', () => {
    expect(Object.hasOwn(nextConfig, 'deploymentId')).toBe(true);
    const source = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
    expect(source).toContain('assetPrefix: assetDeploymentId');
    expect(source).toContain('`/assets/${assetDeploymentId}`');
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

  it('deploys the web application through a checked blue-green handoff', () => {
    const service = readFileSync(join(process.cwd(), 'deploy/supapro-web@.service'), 'utf8');
    const nginx = readFileSync(join(process.cwd(), 'deploy/supapro-nginx-site.conf'), 'utf8');
    const deploy = readFileSync(
      join(process.cwd(), 'deploy/supapro-zero-downtime-deploy.sh'),
      'utf8',
    );

    expect(service).toContain('WorkingDirectory=/opt/pilot-plus/slots/%i');
    expect(service).toContain('EnvironmentFile=/etc/supapro-web-%i.env');
    expect(service).toContain(
      'ExecStart=/usr/local/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${PORT}',
    );
    expect(service).toContain('KillSignal=SIGTERM');
    expect(service).toContain('SuccessExitStatus=143 SIGTERM');
    expect(service).toContain('TimeoutStopSec=30');

    expect(nginx).toContain('include /etc/nginx/snippets/supapro-active-upstream.conf;');
    expect(nginx).toContain('include /etc/nginx/snippets/supapro-active-assets.conf;');
    expect(nginx).toContain('proxy_pass http://supapro_backend;');
    expect(nginx).toContain('location ~ ^/assets/[A-Za-z0-9._-]+/_next/(.*)$');
    expect(nginx).toContain('rewrite ^/assets/[A-Za-z0-9._-]+/_next/(.*)$ /_next/$1 break;');
    expect(nginx).toContain("sub_filter '.css\"' '.css?dpl=$supapro_asset_version\"';");

    expect(deploy).toContain('flock -n 9');
    expect(deploy).toContain('Release path must be a real directory, not a symlink');
    expect(deploy).toContain(
      'Release must differ from current; rebuilding an active release breaks immutable assets',
    );
    expect(deploy).toContain('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY');
    expect(deploy).toContain('runtime_env="/etc/supapro-web-$target.env"');
    expect(deploy).toContain("grep -v '^NEXT_DEPLOYMENT_ID=' \"$runtime_env\"");
    expect(deploy).toContain("printf 'NEXT_DEPLOYMENT_ID=%s\\n' \"$NEXT_DEPLOYMENT_ID\"");
    expect(deploy.indexOf('runtime_env="/etc/supapro-web-$target.env"')).toBeLessThan(
      deploy.indexOf('systemctl restart "supapro-web@$target.service"'),
    );
    expect(deploy).toContain('supapro-active-assets.conf');
    expect(deploy).toContain("printf 'map $host $supapro_asset_version");
    expect(deploy).toContain('curl --fail --silent --show-error');
    expect(deploy).toContain('grep -q "data-dpl-id=\\\"$NEXT_DEPLOYMENT_ID\\\""');
    expect(deploy).toContain('New Supa Pro slot did not become ready\" >&2; false;');
    expect(deploy).toContain('SUPAPRO_SKIP_BUILD');
    expect(deploy).toContain('systemctl enable "supapro-web@$target.service"');
    expect(deploy).toContain('systemctl disable "supapro-web@$active.service"');
    expect(deploy).toContain('systemctl reload nginx');
    expect(deploy).toContain('DRAIN_SECONDS=${DRAIN_SECONDS:-130}');
    expect(deploy).toContain('rollback');
  });
});
