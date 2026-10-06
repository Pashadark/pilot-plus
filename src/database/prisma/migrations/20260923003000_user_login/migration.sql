ALTER TABLE "User" ADD COLUMN "login" TEXT;
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");
ALTER TABLE "User" ADD CONSTRAINT "User_login_format" CHECK ("login" IS NULL OR "login" ~ '^[a-z0-9][a-z0-9_.-]{2,31}$');
