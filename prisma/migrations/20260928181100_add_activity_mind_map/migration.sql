-- CreateTable
CREATE TABLE "ActivityMapNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "x" REAL NOT NULL DEFAULT 0,
    "y" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityMapNode_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityMapEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromActivityId" TEXT NOT NULL,
    "toActivityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityMapEdge_fromActivityId_fkey" FOREIGN KEY ("fromActivityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityMapEdge_toActivityId_fkey" FOREIGN KEY ("toActivityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityMapNode_activityId_key" ON "ActivityMapNode"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityMapEdge_fromActivityId_toActivityId_key" ON "ActivityMapEdge"("fromActivityId", "toActivityId");
