-- CreateTable
CREATE TABLE "OfficeRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7b68ee',
    "x" INTEGER NOT NULL DEFAULT 0,
    "z" INTEGER NOT NULL DEFAULT 0,
    "w" INTEGER NOT NULL DEFAULT 4,
    "d" INTEGER NOT NULL DEFAULT 4,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OfficeWall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "x" INTEGER NOT NULL,
    "z" INTEGER NOT NULL,
    "axis" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OfficePlacement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'desk',
    "activityId" TEXT,
    "x" INTEGER NOT NULL DEFAULT 0,
    "z" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OfficePlacement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "OfficeRoom" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficePlacement_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OfficeRoom_x_z_idx" ON "OfficeRoom"("x", "z");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeWall_x_z_axis_key" ON "OfficeWall"("x", "z", "axis");

-- CreateIndex
CREATE INDEX "OfficePlacement_roomId_idx" ON "OfficePlacement"("roomId");

-- CreateIndex
CREATE INDEX "OfficePlacement_activityId_idx" ON "OfficePlacement"("activityId");

-- CreateIndex
CREATE INDEX "OfficePlacement_x_z_idx" ON "OfficePlacement"("x", "z");
