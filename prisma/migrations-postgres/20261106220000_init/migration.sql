-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "probability" INTEGER,
    "stageId" TEXT NOT NULL,
    "commercialId" TEXT,
    "quarter" TEXT,
    "year" INTEGER,
    "expectedClose" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "owner" TEXT,
    "source" TEXT,
    "description" TEXT,
    "monthlyValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "setupValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contractMonths" INTEGER,
    "product" TEXT,
    "subOffer" TEXT,
    "recurrenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commercial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityStatus" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "typeId" TEXT,
    "opportunityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "queueOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationContact" (
    "id" TEXT NOT NULL,
    "automationKey" TEXT NOT NULL DEFAULT 'whatsapp_message',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MindMapGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MindMapGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MindMap" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MindMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityMapNode" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityMapNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MindMapShape" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'rectangle',
    "label" TEXT,
    "iconName" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 160,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "color" TEXT NOT NULL DEFAULT '#dbeafe',
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MindMapShape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MindMapConnection" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "fromSide" TEXT NOT NULL DEFAULT 'right',
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "toSide" TEXT NOT NULL DEFAULT 'left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MindMapConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'circle',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeDay" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "water" BOOLEAN NOT NULL DEFAULT false,
    "tea" BOOLEAN NOT NULL DEFAULT false,
    "breakfast" BOOLEAN NOT NULL DEFAULT false,
    "lunch" BOOLEAN NOT NULL DEFAULT false,
    "snack" BOOLEAN NOT NULL DEFAULT false,
    "dinner" BOOLEAN NOT NULL DEFAULT false,
    "drankBeer" BOOLEAN NOT NULL DEFAULT false,
    "beerAbstained" BOOLEAN NOT NULL DEFAULT false,
    "beerCans" INTEGER NOT NULL DEFAULT 0,
    "workoutStatus" TEXT NOT NULL DEFAULT 'not_done',
    "workoutType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeDayCheck" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeDayCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeMonth" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "goalScore" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeMonth" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeEntry" (
    "id" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "clickupRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeAttachment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarterGoal" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuarterGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyHabit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyHabit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "day" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyHabitCheck" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DailyHabitCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7b68ee',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceFolder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Sem título',
    "content" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKnowledge" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stage_order_idx" ON "Stage"("order");

-- CreateIndex
CREATE INDEX "Opportunity_stageId_idx" ON "Opportunity"("stageId");

-- CreateIndex
CREATE INDEX "Opportunity_commercialId_idx" ON "Opportunity"("commercialId");

-- CreateIndex
CREATE INDEX "Opportunity_quarter_year_idx" ON "Opportunity"("quarter", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityStatus_key_key" ON "ActivityStatus"("key");

-- CreateIndex
CREATE INDEX "ActivityStatus_order_idx" ON "ActivityStatus"("order");

-- CreateIndex
CREATE INDEX "Activity_opportunityId_idx" ON "Activity"("opportunityId");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_queueOrder_idx" ON "Activity"("queueOrder");

-- CreateIndex
CREATE INDEX "AutomationContact_automationKey_name_idx" ON "AutomationContact"("automationKey", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationContact_automationKey_phone_key" ON "AutomationContact"("automationKey", "phone");

-- CreateIndex
CREATE INDEX "MindMapGroup_order_idx" ON "MindMapGroup"("order");

-- CreateIndex
CREATE INDEX "MindMap_groupId_order_idx" ON "MindMap"("groupId", "order");

-- CreateIndex
CREATE INDEX "ActivityMapNode_mapId_idx" ON "ActivityMapNode"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityMapNode_mapId_activityId_key" ON "ActivityMapNode"("mapId", "activityId");

-- CreateIndex
CREATE INDEX "MindMapShape_mapId_idx" ON "MindMapShape"("mapId");

-- CreateIndex
CREATE INDEX "MindMapConnection_mapId_idx" ON "MindMapConnection"("mapId");

-- CreateIndex
CREATE INDEX "MindMapConnection_fromType_fromId_idx" ON "MindMapConnection"("fromType", "fromId");

-- CreateIndex
CREATE INDEX "MindMapConnection_toType_toId_idx" ON "MindMapConnection"("toType", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "MindMapConnection_mapId_fromType_fromId_toType_toId_key" ON "MindMapConnection"("mapId", "fromType", "fromId", "toType", "toId");

-- CreateIndex
CREATE INDEX "ChallengeItem_order_idx" ON "ChallengeItem"("order");

-- CreateIndex
CREATE INDEX "ChallengeDay_monthKey_idx" ON "ChallengeDay"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeDay_monthKey_day_key" ON "ChallengeDay"("monthKey", "day");

-- CreateIndex
CREATE INDEX "ChallengeDayCheck_dayId_idx" ON "ChallengeDayCheck"("dayId");

-- CreateIndex
CREATE INDEX "ChallengeDayCheck_itemId_idx" ON "ChallengeDayCheck"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeDayCheck_dayId_itemId_key" ON "ChallengeDayCheck"("dayId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeMonth_monthKey_key" ON "ChallengeMonth"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeMonth_monthKey_key" ON "OvertimeMonth"("monthKey");

-- CreateIndex
CREATE INDEX "OvertimeEntry_monthId_idx" ON "OvertimeEntry"("monthId");

-- CreateIndex
CREATE INDEX "OvertimeAttachment_entryId_idx" ON "OvertimeAttachment"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterGoal_year_quarter_key" ON "QuarterGoal"("year", "quarter");

-- CreateIndex
CREATE INDEX "DailyHabit_order_idx" ON "DailyHabit"("order");

-- CreateIndex
CREATE INDEX "DailyHabit_active_idx" ON "DailyHabit"("active");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDay_date_key" ON "DailyDay"("date");

-- CreateIndex
CREATE INDEX "DailyDay_monthKey_idx" ON "DailyDay"("monthKey");

-- CreateIndex
CREATE INDEX "DailyHabitCheck_habitId_idx" ON "DailyHabitCheck"("habitId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyHabitCheck_dayId_habitId_key" ON "DailyHabitCheck"("dayId", "habitId");

-- CreateIndex
CREATE INDEX "Workspace_order_idx" ON "Workspace"("order");

-- CreateIndex
CREATE INDEX "WorkspaceFolder_workspaceId_order_idx" ON "WorkspaceFolder"("workspaceId", "order");

-- CreateIndex
CREATE INDEX "WorkspaceFile_workspaceId_folderId_order_idx" ON "WorkspaceFile"("workspaceId", "folderId", "order");

-- CreateIndex
CREATE INDEX "WorkspaceFile_folderId_idx" ON "WorkspaceFile"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_deskIndex_key" ON "Agent"("deskIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_workspaceId_key" ON "Agent"("workspaceId");

-- CreateIndex
CREATE INDEX "AgentKnowledge_fileId_idx" ON "AgentKnowledge"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentKnowledge_agentId_fileId_key" ON "AgentKnowledge"("agentId", "fileId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MindMap" ADD CONSTRAINT "MindMap_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MindMapGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMapNode" ADD CONSTRAINT "ActivityMapNode_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MindMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMapNode" ADD CONSTRAINT "ActivityMapNode_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MindMapShape" ADD CONSTRAINT "MindMapShape_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MindMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MindMapConnection" ADD CONSTRAINT "MindMapConnection_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MindMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeDayCheck" ADD CONSTRAINT "ChallengeDayCheck_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ChallengeDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeDayCheck" ADD CONSTRAINT "ChallengeDayCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChallengeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "OvertimeMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeAttachment" ADD CONSTRAINT "OvertimeAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "OvertimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyHabitCheck" ADD CONSTRAINT "DailyHabitCheck_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "DailyDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyHabitCheck" ADD CONSTRAINT "DailyHabitCheck_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "DailyHabit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFolder" ADD CONSTRAINT "WorkspaceFolder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "WorkspaceFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledge" ADD CONSTRAINT "AgentKnowledge_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledge" ADD CONSTRAINT "AgentKnowledge_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
