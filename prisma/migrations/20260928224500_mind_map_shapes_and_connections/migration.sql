CREATE TABLE "MindMapShape" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'rectangle',
    "label" TEXT,
    "iconName" TEXT,
    "x" REAL NOT NULL DEFAULT 0,
    "y" REAL NOT NULL DEFAULT 0,
    "width" REAL NOT NULL DEFAULT 160,
    "height" REAL NOT NULL DEFAULT 90,
    "color" TEXT NOT NULL DEFAULT '#dbeafe',
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MindMapShape_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MindMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MindMapConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "fromSide" TEXT NOT NULL DEFAULT 'right',
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "toSide" TEXT NOT NULL DEFAULT 'left',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MindMapConnection_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MindMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "MindMapConnection" (
    "id", "mapId", "fromType", "fromId", "fromSide", "toType", "toId", "toSide", "createdAt"
)
SELECT
    "id", "mapId", 'activity', "fromActivityId", 'right', 'activity', "toActivityId", 'left', "createdAt"
FROM "ActivityMapEdge";

DROP TABLE "ActivityMapEdge";

CREATE INDEX "MindMapShape_mapId_idx" ON "MindMapShape"("mapId");
CREATE UNIQUE INDEX "MindMapConnection_mapId_fromType_fromId_toType_toId_key"
ON "MindMapConnection"("mapId", "fromType", "fromId", "toType", "toId");
CREATE INDEX "MindMapConnection_mapId_idx" ON "MindMapConnection"("mapId");
CREATE INDEX "MindMapConnection_fromType_fromId_idx" ON "MindMapConnection"("fromType", "fromId");
CREATE INDEX "MindMapConnection_toType_toId_idx" ON "MindMapConnection"("toType", "toId");
