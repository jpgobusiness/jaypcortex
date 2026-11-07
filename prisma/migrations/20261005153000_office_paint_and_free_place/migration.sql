-- AlterTable
ALTER TABLE "OfficeRoom" ADD COLUMN "wallColor" TEXT NOT NULL DEFAULT '#475569';

-- AlterTable
ALTER TABLE "OfficeWall" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#475569';

-- RedefineTable
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OfficePlacement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'desk',
    "activityId" TEXT,
    "x" REAL NOT NULL DEFAULT 0,
    "z" REAL NOT NULL DEFAULT 0,
    "rot" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OfficePlacement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "OfficeRoom" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficePlacement_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OfficePlacement" ("id", "roomId", "kind", "activityId", "x", "z", "createdAt", "updatedAt")
SELECT "id", "roomId", "kind", "activityId", "x", "z", "createdAt", "updatedAt" FROM "OfficePlacement";
DROP TABLE "OfficePlacement";
ALTER TABLE "new_OfficePlacement" RENAME TO "OfficePlacement";
CREATE INDEX "OfficePlacement_roomId_idx" ON "OfficePlacement"("roomId");
CREATE INDEX "OfficePlacement_activityId_idx" ON "OfficePlacement"("activityId");
CREATE INDEX "OfficePlacement_x_z_idx" ON "OfficePlacement"("x", "z");
PRAGMA foreign_keys=ON;
