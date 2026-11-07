-- CreateTable
CREATE TABLE "DailyHabit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "day" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyHabitCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DailyHabitCheck_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "DailyDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyHabitCheck_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "DailyHabit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
CREATE INDEX "DailyTask_date_idx" ON "DailyTask"("date");

-- CreateIndex
CREATE INDEX "DailyTask_status_idx" ON "DailyTask"("status");
