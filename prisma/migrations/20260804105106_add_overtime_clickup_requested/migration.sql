-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OvertimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "clickupRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OvertimeEntry_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "OvertimeMonth" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OvertimeEntry" ("createdAt", "date", "description", "hours", "id", "monthId", "updatedAt") SELECT "createdAt", "date", "description", "hours", "id", "monthId", "updatedAt" FROM "OvertimeEntry";
DROP TABLE "OvertimeEntry";
ALTER TABLE "new_OvertimeEntry" RENAME TO "OvertimeEntry";
CREATE INDEX "OvertimeEntry_monthId_idx" ON "OvertimeEntry"("monthId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
