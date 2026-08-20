import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import {
  applyRealFleetPreview,
  createRealFleetPreview,
  type FleetDatabase,
} from '@/modules/telematics/glonasssoft/actions';
import { GlonassSoftClient } from '@/modules/telematics/glonasssoft/client.server';
import { loadExistingFleetRows } from '@/modules/telematics/glonasssoft/repository';
import { decryptField } from '@/services/security/field-encryption';

async function main() {
  const [mode, companyId, actorUserId, suppliedToken] = process.argv.slice(2);
  const apply = mode === '--apply';
  if (!['--preview', '--apply'].includes(mode ?? '') || !companyId || !actorUserId) {
    throw new Error(
      'Использование: npm run vehicles:reconcile-real -- --preview <companyId> <actorUserId> или --apply <companyId> <actorUserId> <token>',
    );
  }
  const secret = process.env.REAL_FLEET_PREVIEW_SECRET;
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!secret || !encryptionKey) throw new Error('Серверные секреты автопарка не настроены.');

  const integration = await prisma.telematicsIntegration.findUnique({ where: { companyId } });
  if (!integration?.enabled) throw new Error('Интеграция GLONASSSoft не настроена.');
  const client = new GlonassSoftClient({
    baseUrl: integration.baseUrl,
    username: decryptField(integration.usernameEncrypted, encryptionKey),
    password: decryptField(integration.passwordEncrypted, encryptionKey),
  });

  if (!apply) {
    const [existing, provider] = await Promise.all([
      loadExistingFleetRows(prisma as unknown as FleetDatabase, companyId),
      client.findVehicles(),
    ]);
    const prepared = createRealFleetPreview({
      companyId,
      userId: actorUserId,
      existing,
      provider,
      secret,
    });
    console.log(JSON.stringify({ preview: prepared.preview, token: prepared.token }, null, 2));
  } else {
    if (
      process.env.PILOT_ALLOW_REAL_FLEET_APPLY !== '1' ||
      process.env.PILOT_REAL_FLEET_DATABASE_URL_ACK !== process.env.DATABASE_URL ||
      !suppliedToken
    ) {
      throw new Error(
        'Применение запрещено: отсутствует guard, подтверждение базы или token preview.',
      );
    }
    const result = await applyRealFleetPreview({
      companyId,
      userId: actorUserId,
      token: suppliedToken,
      secret,
      transaction: (callback) =>
        prisma.$transaction((database) => callback(database as unknown as FleetDatabase), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }),
      loadExisting: (database) => loadExistingFleetRows(database, companyId),
    });
    console.log(JSON.stringify(result));
  }
}

void main().finally(() => prisma.$disconnect());
