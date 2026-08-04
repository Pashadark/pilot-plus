-- Реквизиты остаются необязательными, чтобы не затрагивать существующие компании.
ALTER TABLE "public"."Company"
ADD COLUMN "inn" TEXT,
ADD COLUMN "kpp" TEXT,
ADD COLUMN "ogrn" TEXT,
ADD COLUMN "directorName" TEXT,
ADD COLUMN "legalAddress" TEXT,
ADD COLUMN "actualAddress" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
