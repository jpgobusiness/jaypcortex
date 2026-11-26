-- Árvore de espaços: subpastas, subarquivos, tipo e arquivamento.
-- Colunas novas nascem nulas ou com default. Sala de agente e Oportunidades continuam.

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "Workspace" AS w
SET "kind" = 'agent_room'
WHERE "kind" = 'generic'
  AND EXISTS (SELECT 1 FROM "Agent" AS a WHERE a."workspaceId" = w."id");

UPDATE "Workspace"
SET "kind" = 'opportunities'
WHERE "key" = 'opportunities';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Workspace_kind_check') THEN
    ALTER TABLE "Workspace"
      ADD CONSTRAINT "Workspace_kind_check"
      CHECK ("kind" IN ('generic', 'agent_room', 'opportunities'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Workspace_kind_idx" ON "Workspace" ("kind");
CREATE INDEX IF NOT EXISTS "Workspace_archivedAt_idx" ON "Workspace" ("archivedAt");

ALTER TABLE "WorkspaceFolder" ADD COLUMN IF NOT EXISTS "parentFolderId" TEXT;
CREATE INDEX IF NOT EXISTS "WorkspaceFolder_parentFolderId_idx" ON "WorkspaceFolder" ("parentFolderId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceFolder_parentFolderId_fkey') THEN
    ALTER TABLE "WorkspaceFolder"
      ADD CONSTRAINT "WorkspaceFolder_parentFolderId_fkey"
      FOREIGN KEY ("parentFolderId") REFERENCES "WorkspaceFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "WorkspaceFile" ADD COLUMN IF NOT EXISTS "parentFileId" TEXT;
CREATE INDEX IF NOT EXISTS "WorkspaceFile_parentFileId_idx" ON "WorkspaceFile" ("parentFileId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceFile_parentFileId_fkey') THEN
    ALTER TABLE "WorkspaceFile"
      ADD CONSTRAINT "WorkspaceFile_parentFileId_fkey"
      FOREIGN KEY ("parentFileId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Nome único só se os dados atuais não tiverem duplicata. Se tiverem, o serviço recusa o próximo conflito.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT lower(btrim("name")) AS name
      FROM "Workspace"
      WHERE "archivedAt" IS NULL
      GROUP BY 1
      HAVING count(*) > 1
    ) dup
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_active_name_uidx"
      ON "Workspace" ((lower(btrim("name"))))
      WHERE "archivedAt" IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT "workspaceId", COALESCE("parentFolderId", ''), lower(btrim("name"))
      FROM "WorkspaceFolder"
      GROUP BY 1, 2, 3
      HAVING count(*) > 1
    ) dup
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceFolder_sibling_name_uidx"
      ON "WorkspaceFolder" ("workspaceId", (COALESCE("parentFolderId", '')), (lower(btrim("name"))));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT "workspaceId", COALESCE("folderId", ''), lower(btrim("title"))
      FROM "WorkspaceFile"
      WHERE "parentFileId" IS NULL
      GROUP BY 1, 2, 3
      HAVING count(*) > 1
    ) dup
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceFile_root_title_uidx"
      ON "WorkspaceFile" ("workspaceId", (COALESCE("folderId", '')), (lower(btrim("title"))))
      WHERE "parentFileId" IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT "parentFileId", lower(btrim("title"))
      FROM "WorkspaceFile"
      WHERE "parentFileId" IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) dup
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceFile_child_title_uidx"
      ON "WorkspaceFile" ("parentFileId", (lower(btrim("title"))))
      WHERE "parentFileId" IS NOT NULL;
  END IF;
END $$;
