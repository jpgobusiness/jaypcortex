-- Anexos podem ficar no espaço (folderId nulo) ou na pasta.
-- workspaceId preenchido a partir da pasta nas linhas já existentes.

ALTER TABLE "FolderAsset" ADD COLUMN IF NOT EXISTS "workspaceId" text;

UPDATE "FolderAsset" AS fa
SET "workspaceId" = wf."workspaceId"
FROM "WorkspaceFolder" AS wf
WHERE wf.id = fa."folderId"
  AND fa."workspaceId" IS NULL;

DELETE FROM "FolderAsset" WHERE "workspaceId" IS NULL;

ALTER TABLE "FolderAsset" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "FolderAsset" ALTER COLUMN "folderId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FolderAsset_workspaceId_fkey'
  ) THEN
    ALTER TABLE "FolderAsset"
      ADD CONSTRAINT "FolderAsset_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "FolderAsset_workspaceId_createdAt_idx"
  ON "FolderAsset" ("workspaceId", "createdAt");
