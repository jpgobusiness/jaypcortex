-- Espaço Oportunidades: Workspace.key + pasta ligada ao funil.
-- Postgres-only. Aditivo. Não apaga dados.

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_key_key" ON "Workspace" ("key");

ALTER TABLE "WorkspaceFolder"
  ADD COLUMN IF NOT EXISTS "opportunityId" text;

CREATE INDEX IF NOT EXISTS "WorkspaceFolder_opportunityId_idx" ON "WorkspaceFolder" ("opportunityId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceFolder_opportunityId_fkey'
  ) THEN
    ALTER TABLE "WorkspaceFolder"
      ADD CONSTRAINT "WorkspaceFolder_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
