-- CreateTable
CREATE TABLE "AutomationContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automationKey" TEXT NOT NULL DEFAULT 'whatsapp_message',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationContact_automationKey_phone_key"
ON "AutomationContact"("automationKey", "phone");

-- CreateIndex
CREATE INDEX "AutomationContact_automationKey_name_idx"
ON "AutomationContact"("automationKey", "name");
