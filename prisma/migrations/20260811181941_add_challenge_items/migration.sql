-- CreateTable
CREATE TABLE "ChallengeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'circle',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChallengeDayCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChallengeDayCheck_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ChallengeDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChallengeDayCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChallengeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChallengeItem_order_idx" ON "ChallengeItem"("order");

-- CreateIndex
CREATE INDEX "ChallengeDayCheck_dayId_idx" ON "ChallengeDayCheck"("dayId");

-- CreateIndex
CREATE INDEX "ChallengeDayCheck_itemId_idx" ON "ChallengeDayCheck"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeDayCheck_dayId_itemId_key" ON "ChallengeDayCheck"("dayId", "itemId");
