-- AlterTable
ALTER TABLE "ChallengeDay" ADD COLUMN "beerAbstained" BOOLEAN NOT NULL DEFAULT false;

-- Migra: quem não bebia (drankBeer=false) vira abstained=true
UPDATE "ChallengeDay" SET "beerAbstained" = NOT "drankBeer";
