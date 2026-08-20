CREATE TABLE "TelegramGroupBinding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "title" TEXT,
    "boundByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TelegramGroupBinding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TelegramGroupBinding_telegramChatId_check" CHECK ("telegramChatId" ~ '^-?[1-9][0-9]{0,19}$')
);

CREATE UNIQUE INDEX "TelegramGroupBinding_companyId_key" ON "TelegramGroupBinding"("companyId");
CREATE UNIQUE INDEX "TelegramGroupBinding_telegramChatId_key" ON "TelegramGroupBinding"("telegramChatId");

ALTER TABLE "TelegramGroupBinding"
ADD CONSTRAINT "TelegramGroupBinding_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelegramGroupBinding"
ADD CONSTRAINT "TelegramGroupBinding_boundByUserId_fkey"
FOREIGN KEY ("boundByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
