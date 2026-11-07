-- CreateTable
CREATE TABLE "ChallengeDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "water" BOOLEAN NOT NULL DEFAULT false,
    "tea" BOOLEAN NOT NULL DEFAULT false,
    "breakfast" BOOLEAN NOT NULL DEFAULT false,
    "lunch" BOOLEAN NOT NULL DEFAULT false,
    "snack" BOOLEAN NOT NULL DEFAULT false,
    "dinner" BOOLEAN NOT NULL DEFAULT false,
    "drankBeer" BOOLEAN NOT NULL DEFAULT false,
    "beerCans" INTEGER NOT NULL DEFAULT 0,
    "workoutStatus" TEXT NOT NULL DEFAULT 'not_done',
    "workoutType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeDay_day_key" ON "ChallengeDay"("day");
