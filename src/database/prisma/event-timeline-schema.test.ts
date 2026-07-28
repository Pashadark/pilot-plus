import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('src/database/prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'src/database/prisma/migrations/20260727180000_add_event_timeline/migration.sql',
  'utf8',
);

describe('схема единой истории', () => {
  it.each(['ManualVehicleEvent', 'EventReadReceipt'])('содержит модель %s', (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it('делает прочтение пользователя идемпотентным', () => {
    expect(schema).toContain('@@unique([userId, eventKey])');
  });

  it('индексирует tenant и хронологию', () => {
    expect(schema).toContain('@@index([companyId, recordedAt])');
    expect(schema).toContain('@@index([companyId, userId, readAt])');
  });

  it('ограничивает координаты и длину ключа на уровне SQL', () => {
    expect(migration).toContain('ManualVehicleEvent_latitude_check');
    expect(migration).toContain('ManualVehicleEvent_longitude_check');
    expect(migration).toContain('EventReadReceipt_eventKey_length_check');
  });
});
