-- Gestão de tempo: colunas em Activity, sessões, eventos, lembretes, capacidade.
-- Postgres-only. Aditivo. Não apaga dados.

ALTER TABLE "ActivityStatus"
  ADD COLUMN IF NOT EXISTS "isInProgress" boolean NOT NULL DEFAULT false;

UPDATE "ActivityStatus" SET "isInProgress" = true WHERE "key" = 'in_progress';

ALTER TABLE "Activity"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "startedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "estimatedMinutes" integer,
  ADD COLUMN IF NOT EXISTS "spentMinutes" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "scheduledStart" timestamptz,
  ADD COLUMN IF NOT EXISTS "scheduledEnd" timestamptz,
  ADD COLUMN IF NOT EXISTS "importance" integer,
  ADD COLUMN IF NOT EXISTS "urgency" integer,
  ADD COLUMN IF NOT EXISTS "energy" text,
  ADD COLUMN IF NOT EXISTS "context" text,
  ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "area" text,
  ADD COLUMN IF NOT EXISTS "waitingOn" text,
  ADD COLUMN IF NOT EXISTS "parentId" text,
  ADD COLUMN IF NOT EXISTS "recurrenceRule" text,
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'ui',
  ADD COLUMN IF NOT EXISTS "externalRef" text,
  ADD COLUMN IF NOT EXISTS "clientKey" text,
  ADD COLUMN IF NOT EXISTS "createdBy" uuid,
  ADD COLUMN IF NOT EXISTS "updatedBy" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Activity_parentId_fkey'
  ) THEN
    ALTER TABLE "Activity"
      ADD CONSTRAINT "Activity_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Activity_clientKey_key" ON "Activity" ("clientKey");
CREATE INDEX IF NOT EXISTS "Activity_deletedAt_idx" ON "Activity" ("deletedAt");
CREATE INDEX IF NOT EXISTS "Activity_dueDate_idx" ON "Activity" ("dueDate");
CREATE INDEX IF NOT EXISTS "Activity_scheduledStart_idx" ON "Activity" ("scheduledStart");
CREATE INDEX IF NOT EXISTS "Activity_parentId_idx" ON "Activity" ("parentId");
CREATE INDEX IF NOT EXISTS "Activity_tags_idx" ON "Activity" USING GIN ("tags");

ALTER TABLE "Activity" DROP COLUMN IF EXISTS "searchTsv";
ALTER TABLE "Activity"
  ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'portuguese',
      public.immutable_unaccent(
        coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("notes", '')
      )
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS "Activity_searchTsv_idx" ON "Activity" USING GIN ("searchTsv");

CREATE TABLE IF NOT EXISTS "ActivityEvent" (
  "id" text PRIMARY KEY,
  "activityId" text NOT NULL,
  "type" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "actorId" text,
  "source" text NOT NULL DEFAULT 'ui',
  "at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ActivityEvent_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ActivityEvent_activityId_at_idx" ON "ActivityEvent" ("activityId", "at");
CREATE INDEX IF NOT EXISTS "ActivityEvent_actorId_at_idx" ON "ActivityEvent" ("actorId", "at");

CREATE TABLE IF NOT EXISTS "ActivitySession" (
  "id" text PRIMARY KEY,
  "activityId" text NOT NULL,
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "endedAt" timestamptz,
  "minutes" integer,
  "note" text,
  CONSTRAINT "ActivitySession_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ActivitySession_activityId_startedAt_idx" ON "ActivitySession" ("activityId", "startedAt");

CREATE TABLE IF NOT EXISTS "ActivityReminder" (
  "id" text PRIMARY KEY,
  "activityId" text NOT NULL,
  "remindAt" timestamptz NOT NULL,
  "channel" text NOT NULL DEFAULT 'briefing',
  "message" text NOT NULL DEFAULT '',
  "firedAt" timestamptz,
  "dismissedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ActivityReminder_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ActivityReminder_activityId_remindAt_idx" ON "ActivityReminder" ("activityId", "remindAt");
CREATE INDEX IF NOT EXISTS "ActivityReminder_remindAt_idx" ON "ActivityReminder" ("remindAt");

CREATE TABLE IF NOT EXISTS "TimeCapacity" (
  "id" text PRIMARY KEY,
  "weekday" integer NOT NULL UNIQUE,
  "workMinutes" integer NOT NULL DEFAULT 0,
  "focusStart" text NOT NULL DEFAULT '09:00',
  "focusEnd" text NOT NULL DEFAULT '18:00'
);

INSERT INTO "TimeCapacity" ("id", "weekday", "workMinutes", "focusStart", "focusEnd")
VALUES
  ('tcap-0', 0, 0, '09:00', '18:00'),
  ('tcap-1', 1, 480, '09:00', '18:00'),
  ('tcap-2', 2, 480, '09:00', '18:00'),
  ('tcap-3', 3, 480, '09:00', '18:00'),
  ('tcap-4', 4, 480, '09:00', '18:00'),
  ('tcap-5', 5, 480, '09:00', '18:00'),
  ('tcap-6', 6, 0, '09:00', '18:00')
ON CONFLICT ("weekday") DO NOTHING;

GRANT ALL ON TABLE "ActivityEvent", "ActivitySession", "ActivityReminder", "TimeCapacity"
  TO service_role, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ActivityEvent', 'ActivitySession', 'ActivityReminder', 'TimeCapacity']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_active_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_active_all ON public.%I
       FOR ALL TO authenticated
       USING (public.is_active_user())
       WITH CHECK (public.is_active_user())',
      t
    );
  END LOOP;
END $$;
