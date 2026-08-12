-- Non-transactional rolling index wave. Execute this migration with a PostgreSQL migration
-- runner that does not wrap the script in BEGIN/COMMIT: CREATE INDEX CONCURRENTLY is rejected
-- inside a transaction block. It follows 20260813090000's committed structural/backfill guards.
--
-- Existing valid indexes are skipped on a retry. If PostgreSQL leaves an INVALID index after an
-- interrupted concurrent build, this script fails with its name; an operator must explicitly
-- run DROP INDEX CONCURRENTLY for that named invalid index, then retry. No data is changed.
SET lock_timeout = '5s';
SET statement_timeout = '10min';

DO $$
DECLARE
  invalid_index TEXT;
BEGIN
  SELECT indexrelid::regclass::TEXT
  INTO invalid_index
  FROM pg_index
  WHERE NOT indisvalid
    AND indexrelid::regclass::TEXT IN (
      '"Vehicle_companyId_id_key"',
      '"Vehicle_companyId_registrationNumberNormalized_key"',
      '"Vehicle_companyId_vinNormalized_key"',
      '"Vehicle_companyId_archivedAt_idx"',
      '"ClientDocument_companyId_clientId_id_key"',
      '"ClientDocumentVersion_documentId_id_key"',
      '"ContractTemplateVersion_companyId_version_key"',
      '"ContractTemplateVersion_companyId_id_key"',
      '"ContractTemplateVersion_companyId_isPublished_publishedAt_idx"',
      '"Rental_companyId_id_key"',
      '"Rental_companyId_clientId_id_key"',
      '"Rental_companyId_contractNumber_key"',
      '"Rental_companyId_status_startsAt_idx"',
      '"Rental_companyId_vehicleId_startsAt_idx"',
      '"Rental_companyId_clientId_startsAt_idx"',
      '"RentalDriver_rentalId_sortOrder_key"',
      '"RentalDriver_companyId_clientId_idx"',
      '"RentalDocumentVersion_rentalId_version_format_key"',
      '"RentalDocumentVersion_companyId_clientId_rentalId_idx"'
    )
  LIMIT 1;

  IF invalid_index IS NOT NULL THEN
    RAISE EXCEPTION 'Interrupted concurrent index build left % invalid. Run DROP INDEX CONCURRENTLY on that index, then retry this migration.', invalid_index;
  END IF;
END;
$$;

-- VIN123 / vin123 / leading-or-trailing spaces normalize identically before this unique index.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Vehicle_companyId_id_key" ON "public"."Vehicle"("companyId", "id");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Vehicle_companyId_registrationNumberNormalized_key" ON "public"."Vehicle"("companyId", "registrationNumberNormalized");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Vehicle_companyId_vinNormalized_key" ON "public"."Vehicle"("companyId", "vinNormalized");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Vehicle_companyId_archivedAt_idx" ON "public"."Vehicle"("companyId", "archivedAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "ClientDocument_companyId_clientId_id_key" ON "public"."ClientDocument"("companyId", "clientId", "id");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "ClientDocumentVersion_documentId_id_key" ON "public"."ClientDocumentVersion"("documentId", "id");

-- All remaining tables were just created by the structural wave, yet are included here for one
-- operational shape and to keep the foreign-key installation after every supporting key exists.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "ContractTemplateVersion_companyId_version_key" ON "public"."ContractTemplateVersion"("companyId", "version");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "ContractTemplateVersion_companyId_id_key" ON "public"."ContractTemplateVersion"("companyId", "id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ContractTemplateVersion_companyId_isPublished_publishedAt_idx" ON "public"."ContractTemplateVersion"("companyId", "isPublished", "publishedAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Rental_companyId_id_key" ON "public"."Rental"("companyId", "id");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Rental_companyId_clientId_id_key" ON "public"."Rental"("companyId", "clientId", "id");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Rental_companyId_contractNumber_key" ON "public"."Rental"("companyId", "contractNumber");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Rental_companyId_status_startsAt_idx" ON "public"."Rental"("companyId", "status", "startsAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Rental_companyId_vehicleId_startsAt_idx" ON "public"."Rental"("companyId", "vehicleId", "startsAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Rental_companyId_clientId_startsAt_idx" ON "public"."Rental"("companyId", "clientId", "startsAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "RentalDriver_rentalId_sortOrder_key" ON "public"."RentalDriver"("rentalId", "sortOrder");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RentalDriver_companyId_clientId_idx" ON "public"."RentalDriver"("companyId", "clientId");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "RentalDocumentVersion_rentalId_version_format_key" ON "public"."RentalDocumentVersion"("rentalId", "version", "format");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RentalDocumentVersion_companyId_clientId_rentalId_idx" ON "public"."RentalDocumentVersion"("companyId", "clientId", "rentalId");

-- Foreign keys follow their supporting keys. Constraint creation can still take an ACCESS
-- EXCLUSIVE lock, so the session lock_timeout deliberately makes contention fail fast. Each
-- guard is restart-safe after a partial non-transactional index wave.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vehicle_archivedByUserId_fkey') THEN
    ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContractTemplateVersion_companyId_fkey') THEN
    ALTER TABLE "public"."ContractTemplateVersion" ADD CONSTRAINT "ContractTemplateVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContractTemplateVersion_createdByUserId_fkey') THEN
    ALTER TABLE "public"."ContractTemplateVersion" ADD CONSTRAINT "ContractTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rental_companyId_fkey') THEN
    ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rental_companyId_clientId_fkey') THEN
    ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rental_companyId_vehicleId_fkey') THEN
    ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_vehicleId_fkey" FOREIGN KEY ("companyId", "vehicleId") REFERENCES "public"."Vehicle"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rental_companyId_templateVersionId_fkey') THEN
    ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_templateVersionId_fkey" FOREIGN KEY ("companyId", "templateVersionId") REFERENCES "public"."ContractTemplateVersion"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rental_createdByUserId_fkey') THEN
    ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalDriver_companyId_fkey') THEN
    ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalDriver_companyId_rentalId_fkey') THEN
    ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalDriver_companyId_clientId_fkey') THEN
    ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalDocumentVersion_companyId_fkey') THEN
    ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalDocumentVersion_companyId_clientId_rentalId_fkey') THEN
    ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_clientId_rentalId_fkey" FOREIGN KEY ("companyId", "clientId", "rentalId") REFERENCES "public"."Rental"("companyId", "clientId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalDocumentVersion_companyId_clientId_clientDocumentId_fkey') THEN
    ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_clientId_clientDocumentId_fkey" FOREIGN KEY ("companyId", "clientId", "clientDocumentId") REFERENCES "public"."ClientDocument"("companyId", "clientId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_fkey') THEN
    ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_fkey" FOREIGN KEY ("clientDocumentId", "clientDocumentVersionId") REFERENCES "public"."ClientDocumentVersion"("documentId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;
