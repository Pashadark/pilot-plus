CREATE TABLE "AvitoDialogue" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "accountId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "contentEncrypted" TEXT NOT NULL,
  "reminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("companyId", "accountId", "chatId")
);
CREATE INDEX "AvitoDialogue_companyId_reminderAt_idx" ON "AvitoDialogue"("companyId", "reminderAt");
CREATE TABLE "AvitoOutgoing" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "accountId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "incomingId" TEXT NOT NULL,
  "textEncrypted" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','SENDING','SENT','UNKNOWN','CANCELLED')),
  "providerId" TEXT,
  "sentAt" TIMESTAMP(3),
  "attemptedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("companyId", "accountId", "chatId", "incomingId")
);
CREATE INDEX "AvitoOutgoing_companyId_state_createdAt_idx" ON "AvitoOutgoing"("companyId", "state", "createdAt");
