-- AlterEnum
ALTER TYPE "public"."FineStatus" ADD VALUE 'ARCHIVED';

-- CreateEnum
CREATE TYPE "public"."FineArchiveReason" AS ENUM ('MISSING_FROM_PROVIDER', 'MANUAL_CONFIRMED');

-- AlterTable
ALTER TABLE "public"."Fine"
ADD COLUMN "providerMissingSince" TIMESTAMP(3) WITH TIME ZONE,
ADD COLUMN "providerMissingSyncCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "archivedAt" TIMESTAMP(3) WITH TIME ZONE,
ADD COLUMN "archiveReason" "public"."FineArchiveReason";
