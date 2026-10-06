CREATE TYPE "OperationsTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OperationsTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

CREATE TABLE "OperationsTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "priority" "OperationsTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "OperationsTaskStatus" NOT NULL DEFAULT 'OPEN',
    "href" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperationsTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationsTask_companyId_status_dueAt_idx" ON "OperationsTask"("companyId", "status", "dueAt");
CREATE INDEX "OperationsTask_assignedToUserId_status_dueAt_idx" ON "OperationsTask"("assignedToUserId", "status", "dueAt");

ALTER TABLE "OperationsTask" ADD CONSTRAINT "OperationsTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationsTask" ADD CONSTRAINT "OperationsTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationsTask" ADD CONSTRAINT "OperationsTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationsTask" ADD CONSTRAINT "OperationsTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
