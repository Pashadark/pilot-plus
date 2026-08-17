CREATE TYPE "ClientCommentCategory" AS ENUM (
  'GENERAL', 'POSITIVE', 'PROBLEM', 'DAMAGE', 'PAYMENT', 'VIOLATION'
);

CREATE TYPE "ClientCommentSeverity" AS ENUM ('INFO', 'WARNING', 'DANGER');

CREATE TABLE "ClientComment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "rentalId" TEXT,
  "authorUserId" TEXT NOT NULL,
  "category" "ClientCommentCategory" NOT NULL DEFAULT 'GENERAL',
  "severity" "ClientCommentSeverity" NOT NULL DEFAULT 'INFO',
  "text" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "hiddenAt" TIMESTAMP(3),
  "hiddenByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientComment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClientComment_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "Client"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClientComment_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "Rental"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientComment_hiddenByUserId_fkey" FOREIGN KEY ("hiddenByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ClientComment_companyId_clientId_isPinned_createdAt_idx"
ON "ClientComment"("companyId", "clientId", "isPinned", "createdAt");

CREATE INDEX "ClientComment_companyId_rentalId_createdAt_idx"
ON "ClientComment"("companyId", "rentalId", "createdAt");
