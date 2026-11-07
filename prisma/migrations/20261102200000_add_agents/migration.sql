-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "isOrchestrator" BOOLEAN NOT NULL DEFAULT false,
    "deskIndex" INTEGER,
    "skinTone" TEXT NOT NULL DEFAULT '#c68a62',
    "hairStyle" TEXT NOT NULL DEFAULT 'short',
    "hairColor" TEXT NOT NULL DEFAULT '#2a1b14',
    "shirtColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "accessory" TEXT NOT NULL DEFAULT 'none',
    "workspaceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentKnowledge_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentKnowledge_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "WorkspaceFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_deskIndex_key" ON "Agent"("deskIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_workspaceId_key" ON "Agent"("workspaceId");

-- CreateIndex
CREATE INDEX "AgentKnowledge_fileId_idx" ON "AgentKnowledge"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentKnowledge_agentId_fileId_key" ON "AgentKnowledge"("agentId", "fileId");
