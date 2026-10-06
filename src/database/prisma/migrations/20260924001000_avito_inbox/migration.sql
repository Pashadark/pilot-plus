CREATE TABLE "AvitoInboxEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','DONE','IGNORED','FAILED')),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leadId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AvitoInboxEvent_companyId_accountId_chatId_messageId_key" ON "AvitoInboxEvent"("companyId","accountId","chatId","messageId");
CREATE INDEX "AvitoInboxEvent_state_nextAttempt_idx" ON "AvitoInboxEvent"("state","nextAttempt");
