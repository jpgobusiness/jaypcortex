-- Pastas e mapas mentais separados.
CREATE TABLE "MindMapGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "MindMapGroup_order_idx" ON "MindMapGroup"("order");

CREATE TABLE "MindMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "groupId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MindMap_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MindMapGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MindMap_groupId_order_idx" ON "MindMap"("groupId", "order");

INSERT INTO "MindMap" ("id", "name", "order", "createdAt", "updatedAt")
VALUES ('default-mind-map', 'Mapa 1', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE "new_ActivityMapNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "x" REAL NOT NULL DEFAULT 0,
    "y" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityMapNode_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MindMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityMapNode_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ActivityMapNode" ("id", "mapId", "activityId", "x", "y", "createdAt", "updatedAt")
SELECT "id", 'default-mind-map', "activityId", "x", "y", "createdAt", "updatedAt"
FROM "ActivityMapNode";

DROP TABLE "ActivityMapNode";
ALTER TABLE "new_ActivityMapNode" RENAME TO "ActivityMapNode";
CREATE UNIQUE INDEX "ActivityMapNode_mapId_activityId_key" ON "ActivityMapNode"("mapId", "activityId");
CREATE INDEX "ActivityMapNode_mapId_idx" ON "ActivityMapNode"("mapId");

CREATE TABLE "new_ActivityMapEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "fromActivityId" TEXT NOT NULL,
    "toActivityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityMapEdge_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MindMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityMapEdge_fromActivityId_fkey" FOREIGN KEY ("fromActivityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityMapEdge_toActivityId_fkey" FOREIGN KEY ("toActivityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ActivityMapEdge" ("id", "mapId", "fromActivityId", "toActivityId", "createdAt")
SELECT "id", 'default-mind-map', "fromActivityId", "toActivityId", "createdAt"
FROM "ActivityMapEdge";

DROP TABLE "ActivityMapEdge";
ALTER TABLE "new_ActivityMapEdge" RENAME TO "ActivityMapEdge";
CREATE UNIQUE INDEX "ActivityMapEdge_mapId_fromActivityId_toActivityId_key" ON "ActivityMapEdge"("mapId", "fromActivityId", "toActivityId");
CREATE INDEX "ActivityMapEdge_mapId_idx" ON "ActivityMapEdge"("mapId");
