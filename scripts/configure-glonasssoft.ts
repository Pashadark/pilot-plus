import { prisma } from '../src/database/prisma/client';
import { encryptField } from '../src/services/security/field-encryption';

async function main() {
  const companyId = process.env.GLONASSSOFT_COMPANY_ID;
  const username = process.env.GLONASSSOFT_USERNAME;
  const password = process.env.GLONASSSOFT_PASSWORD;
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!companyId || !username || !password || !encryptionKey) {
    throw new Error('Параметры настройки GLONASSSoft не заданы.');
  }
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw new Error('Компания не найдена.');
  await prisma.telematicsIntegration.upsert({
    where: { companyId },
    create: {
      companyId,
      provider: 'GLONASSSOFT',
      baseUrl: 'https://gs.sputnik.vision/api/v3',
      usernameEncrypted: encryptField(username, encryptionKey),
      passwordEncrypted: encryptField(password, encryptionKey),
      enabled: true,
    },
    update: {
      baseUrl: 'https://gs.sputnik.vision/api/v3',
      usernameEncrypted: encryptField(username, encryptionKey),
      passwordEncrypted: encryptField(password, encryptionKey),
      enabled: true,
      lastErrorCode: null,
    },
  });
  console.log('GLONASSSOFT_CONFIGURED');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'GLONASSSOFT_CONFIGURATION_FAILED');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
