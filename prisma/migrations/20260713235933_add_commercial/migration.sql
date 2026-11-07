-- CreateTable
CREATE TABLE "Commercial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "value" REAL NOT NULL DEFAULT 0,
    "probability" INTEGER,
    "stageId" TEXT NOT NULL,
    "commercialId" TEXT,
    "quarter" TEXT,
    "year" INTEGER,
    "expectedClose" DATETIME,
    "closedAt" DATETIME,
    "owner" TEXT,
    "source" TEXT,
    "description" TEXT,
    "monthlyValue" REAL NOT NULL DEFAULT 0,
    "setupValue" REAL NOT NULL DEFAULT 0,
    "contractMonths" INTEGER,
    "product" TEXT,
    "subOffer" TEXT,
    "recurrenceType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Opportunity" ("client", "closedAt", "contact", "contractMonths", "createdAt", "description", "email", "expectedClose", "id", "monthlyValue", "name", "owner", "phone", "probability", "product", "quarter", "recurrenceType", "setupValue", "source", "stageId", "subOffer", "updatedAt", "value", "year") SELECT "client", "closedAt", "contact", "contractMonths", "createdAt", "description", "email", "expectedClose", "id", "monthlyValue", "name", "owner", "phone", "probability", "product", "quarter", "recurrenceType", "setupValue", "source", "stageId", "subOffer", "updatedAt", "value", "year" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE INDEX "Opportunity_stageId_idx" ON "Opportunity"("stageId");
CREATE INDEX "Opportunity_commercialId_idx" ON "Opportunity"("commercialId");
CREATE INDEX "Opportunity_quarter_year_idx" ON "Opportunity"("quarter", "year");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
