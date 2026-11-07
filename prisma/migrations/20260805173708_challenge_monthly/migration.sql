-- ChallengeDay passa a ser por mês (monthKey + day).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ChallengeDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthKey" TEXT NOT NULL,
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

-- Migra dados existentes: monthKey derivado da data (fallback pelo dia se date inválida).
INSERT INTO "new_ChallengeDay" (
  "id", "monthKey", "day", "date",
  "water", "tea", "breakfast", "lunch", "snack", "dinner",
  "drankBeer", "beerCans", "workoutStatus", "workoutType",
  "createdAt", "updatedAt"
)
SELECT
  "id",
  COALESCE(strftime('%Y-%m', "date"), '2026-08'),
  "day",
  "date",
  "water", "tea", "breakfast", "lunch", "snack", "dinner",
  "drankBeer", "beerCans", "workoutStatus", "workoutType",
  "createdAt", "updatedAt"
FROM "ChallengeDay";

DROP TABLE "ChallengeDay";
ALTER TABLE "new_ChallengeDay" RENAME TO "ChallengeDay";
CREATE INDEX "ChallengeDay_monthKey_idx" ON "ChallengeDay"("monthKey");
CREATE UNIQUE INDEX "ChallengeDay_monthKey_day_key" ON "ChallengeDay"("monthKey", "day");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
