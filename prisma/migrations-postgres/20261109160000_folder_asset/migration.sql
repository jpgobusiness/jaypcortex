-- Fase C: metadados de arquivos no Storage (HTML de entrega, anexo, áudio).
-- Binário não entra no Postgres. RLS igual às demais tabelas de negócio.

CREATE TABLE IF NOT EXISTS "FolderAsset" (
  "id" text PRIMARY KEY,
  "folderId" text NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "mimeType" text NOT NULL,
  "size" integer NOT NULL,
  "path" text NOT NULL,
  "createdBy" uuid,
  "source" text NOT NULL DEFAULT 'ui',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "FolderAsset_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "WorkspaceFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FolderAsset_folderId_createdAt_idx" ON "FolderAsset" ("folderId", "createdAt");
CREATE INDEX IF NOT EXISTS "FolderAsset_kind_idx" ON "FolderAsset" ("kind");

GRANT ALL ON TABLE "FolderAsset" TO service_role, authenticated;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public."FolderAsset" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS authenticated_active_all ON public."FolderAsset"';
  EXECUTE
    'CREATE POLICY authenticated_active_all ON public."FolderAsset"
     FOR ALL TO authenticated
     USING (public.is_active_user())
     WITH CHECK (public.is_active_user())';
END $$;
