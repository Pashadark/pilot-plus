import { spawn } from 'node:child_process';

import { freshMigrationDatabaseUrl } from '../src/database/prisma/fresh-migration-verification';

async function main() {
  const databaseUrl = freshMigrationDatabaseUrl(process.env);
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(command, ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
}

main().catch(() => {
  console.error('Fresh migration deploy не выполнен. Проверьте одноразовую БД и конфигурацию.');
  process.exitCode = 1;
});
