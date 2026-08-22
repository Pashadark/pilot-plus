CREATE TYPE "ClientCommentProblemStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TYPE "ClientRatingEventSource" AS ENUM ('AUTOMATIC', 'MANUAL');

CREATE TYPE "ClientRatingEventType" AS ENUM (
  'CLEAN_RENTAL',
  'ON_TIME_RETURN',
  'CLEAN_RENTAL_STREAK',
  'LATE_RETURN',
  'UNPAID_CONFIRMED_FINE',
  'DAMAGE',
  'CONTRACT_VIOLATION',
  'MANUAL_POSITIVE',
  'MANUAL_NEGATIVE'
);

CREATE TYPE "ClientRatingEventReason" AS ENUM (
  'CLEAN_RENTAL_COMPLETED',
  'ON_TIME_RETURN_COMPLETED',
  'CLEAN_RENTAL_STREAK_COMPLETED',
  'LATE_RETURN_CONFIRMED',
  'UNPAID_CONFIRMED_FINE',
  'DAMAGE_CONFIRMED',
  'CONTRACT_VIOLATION_CONFIRMED',
  'MANUAL_COMMENT'
);

ALTER TABLE "ClientComment"
  ADD COLUMN "problemStatus" "ClientCommentProblemStatus",
  ADD COLUMN "resolvedAt" TIMESTAMPTZ(3),
  ADD COLUMN "resolvedByUserId" TEXT,
  ADD COLUMN "affectsRating" BOOLEAN,
  ADD COLUMN "ratingDelta" INTEGER;

ALTER TABLE "ClientComment"
  ADD CONSTRAINT "ClientComment_companyId_id_key" UNIQUE ("companyId", "id"),
  ADD CONSTRAINT "ClientComment_companyId_resolvedByUserId_fkey"
    FOREIGN KEY ("companyId", "resolvedByUserId") REFERENCES "CompanyMember"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClientRatingEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "source" "ClientRatingEventSource" NOT NULL,
  "type" "ClientRatingEventType" NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "ClientRatingEventReason" NOT NULL,
  "idempotencyKey" TEXT,
  "rentalId" TEXT,
  "fineId" TEXT,
  "vehicleId" TEXT,
  "commentId" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientRatingEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientRatingEvent_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "ClientRatingEvent_commentId_key" UNIQUE ("commentId"),
  CONSTRAINT "ClientRatingEvent_companyId_commentId_key" UNIQUE ("companyId", "commentId"),
  CONSTRAINT "ClientRatingEvent_delta_range_check" CHECK ("delta" BETWEEN -50 AND 10),
  CONSTRAINT "ClientRatingEvent_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientRatingEvent_companyId_clientId_fkey"
    FOREIGN KEY ("companyId", "clientId") REFERENCES "Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientRatingEvent_companyId_rentalId_fkey"
    FOREIGN KEY ("companyId", "rentalId") REFERENCES "Rental"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientRatingEvent_companyId_fineId_fkey"
    FOREIGN KEY ("companyId", "fineId") REFERENCES "Fine"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientRatingEvent_companyId_vehicleId_fkey"
    FOREIGN KEY ("companyId", "vehicleId") REFERENCES "Vehicle"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientRatingEvent_companyId_commentId_fkey"
    FOREIGN KEY ("companyId", "commentId") REFERENCES "ClientComment"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientRatingEvent_companyId_actorUserId_fkey"
    FOREIGN KEY ("companyId", "actorUserId") REFERENCES "CompanyMember"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ClientRatingEvent_companyId_clientId_createdAt_idx"
ON "ClientRatingEvent"("companyId", "clientId", "createdAt");

CREATE FUNCTION "prevent_client_rating_event_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ClientRatingEvent is append-only';
END;
$$;

CREATE TRIGGER "ClientRatingEvent_prevent_mutation"
BEFORE UPDATE OR DELETE ON "ClientRatingEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_client_rating_event_mutation"();
