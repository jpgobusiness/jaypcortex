-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "queueOrder" INTEGER;

-- CreateIndex
CREATE INDEX "Activity_queueOrder_idx" ON "Activity"("queueOrder");
