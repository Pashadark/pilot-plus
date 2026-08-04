-- Replace single ADMIN roles without deleting existing users or memberships.
CREATE TYPE "public"."UserRole_new" AS ENUM ('SUPER_ADMIN', 'MEMBER');

ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User"
ALTER COLUMN "role" TYPE "public"."UserRole_new"
USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'SUPER_ADMIN'
  END
)::"public"."UserRole_new";
ALTER TYPE "public"."UserRole" RENAME TO "UserRole_old";
ALTER TYPE "public"."UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

CREATE TYPE "public"."CompanyRole_new" AS ENUM ('COMPANY_ADMIN', 'DISPATCHER', 'DRIVER', 'VIEWER');

ALTER TABLE "public"."CompanyMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."CompanyMember"
ALTER COLUMN "role" TYPE "public"."CompanyRole_new"
USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'COMPANY_ADMIN'
  END
)::"public"."CompanyRole_new";
ALTER TYPE "public"."CompanyRole" RENAME TO "CompanyRole_old";
ALTER TYPE "public"."CompanyRole_new" RENAME TO "CompanyRole";
DROP TYPE "public"."CompanyRole_old";
ALTER TABLE "public"."CompanyMember" ALTER COLUMN "role" SET DEFAULT 'VIEWER';

CREATE TYPE "public"."CompanyPermission" AS ENUM (
  'MANAGE_USERS',
  'MANAGE_ROLES',
  'MANAGE_VEHICLES',
  'MANAGE_DEVICES',
  'MANAGE_DOCUMENTS',
  'MANAGE_MAINTENANCE',
  'MANAGE_WASH',
  'VIEW_REPORTS',
  'VIEW_AUDIT'
);

CREATE TYPE "public"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'ASSIGN', 'BLOCK', 'ARCHIVE', 'DELETE');

CREATE TYPE "public"."AuditEntityType" AS ENUM (
  'COMPANY',
  'USER',
  'ROLE',
  'VEHICLE',
  'DEVICE',
  'DOCUMENT',
  'SYSTEM'
);

ALTER TABLE "public"."CompanyMember"
ADD COLUMN "additionalPermissions" "public"."CompanyPermission"[] NOT NULL DEFAULT ARRAY[]::"public"."CompanyPermission"[];

CREATE TABLE "public"."AuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "actorUserId" TEXT,
  "actorEmailSnapshot" TEXT NOT NULL,
  "action" "public"."AuditAction" NOT NULL,
  "entityType" "public"."AuditEntityType" NOT NULL,
  "entityId" TEXT,
  "entityLabel" TEXT,
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "public"."AuditLog"("companyId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "public"."AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "public"."AuditLog"("entityType", "entityId", "createdAt");

ALTER TABLE "public"."AuditLog"
ADD CONSTRAINT "AuditLog_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."AuditLog"
ADD CONSTRAINT "AuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
