-- CreateTable
CREATE TABLE "OvertimeMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthKey" TEXT NOT NULL,
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    "goalHours" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OvertimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OvertimeEntry_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "OvertimeMonth" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OvertimeAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OvertimeAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "OvertimeEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeMonth_monthKey_key" ON "OvertimeMonth"("monthKey");

-- CreateIndex
CREATE INDEX "OvertimeEntry_monthId_idx" ON "OvertimeEntry"("monthId");

-- CreateIndex
CREATE INDEX "OvertimeAttachment_entryId_idx" ON "OvertimeAttachment"("entryId");
