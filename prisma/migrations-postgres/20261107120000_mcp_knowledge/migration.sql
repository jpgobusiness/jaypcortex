-- MCP + base vetorizada + prompt em camadas + propostas + tokens.
-- Postgres-only. Não toca SQLite / dev.db.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- WorkspaceFile: metadados de indexação
ALTER TABLE "WorkspaceFile"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'contexto',
  ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "searchText" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "contentHash" text,
  ADD COLUMN IF NOT EXISTS "indexedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "indexStatus" text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "updatedBy" uuid,
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'ui';

ALTER TABLE "WorkspaceFile" DROP COLUMN IF EXISTS "searchTsv";
ALTER TABLE "WorkspaceFile"
  ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce("title", '') || ' ' || coalesce("searchText", '')))
  ) STORED;

CREATE INDEX IF NOT EXISTS "WorkspaceFile_searchTsv_idx" ON "WorkspaceFile" USING GIN ("searchTsv");
CREATE INDEX IF NOT EXISTS "WorkspaceFile_tags_idx" ON "WorkspaceFile" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "WorkspaceFile_kind_idx" ON "WorkspaceFile" ("kind");

-- Agent: slug e config profissional
ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "slug" text,
  ADD COLUMN IF NOT EXISTS "model" text NOT NULL DEFAULT 'claude-sonnet',
  ADD COLUMN IF NOT EXISTS "temperature" double precision NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "activePromptVersionId" text,
  ADD COLUMN IF NOT EXISTS "retrievalConfig" jsonb NOT NULL DEFAULT '{"topK":8,"minScore":0.25,"hybridWeight":0.6,"kinds":[]}',
  ADD COLUMN IF NOT EXISTS "capabilities" jsonb NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS "Agent_slug_key" ON "Agent" ("slug") WHERE "slug" IS NOT NULL;

-- KnowledgeChunk
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" text PRIMARY KEY,
  "fileId" text NOT NULL,
  "chunkIndex" integer NOT NULL,
  "headingPath" text NOT NULL DEFAULT '',
  "content" text NOT NULL,
  "tokenCount" integer NOT NULL DEFAULT 0,
  "embedding" vector(1536),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "KnowledgeChunk_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "KnowledgeChunk" DROP COLUMN IF EXISTS "tsv";
ALTER TABLE "KnowledgeChunk"
  ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', public.immutable_unaccent(coalesce("content", '')))
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_fileId_chunkIndex_key" ON "KnowledgeChunk" ("fileId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_fileId_idx" ON "KnowledgeChunk" ("fileId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_tsv_idx" ON "KnowledgeChunk" USING GIN ("tsv");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'KnowledgeChunk_embedding_hnsw_idx'
  ) THEN
    CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
      ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
  END IF;
END $$;

-- Prompt layers / versions
CREATE TABLE IF NOT EXISTS "AgentPromptLayer" (
  "id" text PRIMARY KEY,
  "agentId" text NOT NULL,
  "fileId" text NOT NULL,
  "layer" text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  "enabled" boolean NOT NULL DEFAULT true,
  CONSTRAINT "AgentPromptLayer_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgentPromptLayer_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentPromptLayer_agentId_layer_key" ON "AgentPromptLayer" ("agentId", "layer");
CREATE INDEX IF NOT EXISTS "AgentPromptLayer_fileId_idx" ON "AgentPromptLayer" ("fileId");
CREATE INDEX IF NOT EXISTS "AgentPromptLayer_agentId_order_idx" ON "AgentPromptLayer" ("agentId", "order");

CREATE TABLE IF NOT EXISTS "AgentPromptVersion" (
  "id" text PRIMARY KEY,
  "agentId" text NOT NULL,
  "version" integer NOT NULL,
  "composedPrompt" text NOT NULL,
  "layersSnapshot" jsonb NOT NULL,
  "note" text,
  "createdBy" uuid,
  "source" text NOT NULL DEFAULT 'ui',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "AgentPromptVersion_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentPromptVersion_agentId_version_key" ON "AgentPromptVersion" ("agentId", "version");
CREATE INDEX IF NOT EXISTS "AgentPromptVersion_agentId_idx" ON "AgentPromptVersion" ("agentId");

-- Proposals + revisions
CREATE TABLE IF NOT EXISTS "ChangeProposal" (
  "id" text PRIMARY KEY,
  "agentId" text,
  "targetType" text NOT NULL,
  "targetId" text,
  "title" text NOT NULL,
  "rationale" text NOT NULL DEFAULT '',
  "baseHash" text,
  "proposedContent" jsonb NOT NULL,
  "proposedMeta" jsonb,
  "diffText" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'pending',
  "createdBy" uuid,
  "source" text NOT NULL DEFAULT 'mcp',
  "appliedBy" uuid,
  "appliedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ChangeProposal_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChangeProposal_agentId_status_idx" ON "ChangeProposal" ("agentId", "status");
CREATE INDEX IF NOT EXISTS "ChangeProposal_status_createdAt_idx" ON "ChangeProposal" ("status", "createdAt");

CREATE TABLE IF NOT EXISTS "FileRevision" (
  "id" text PRIMARY KEY,
  "fileId" text NOT NULL,
  "content" text NOT NULL,
  "title" text NOT NULL,
  "hash" text NOT NULL,
  "createdBy" uuid,
  "source" text NOT NULL DEFAULT 'ui',
  "proposalId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "FileRevision_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "WorkspaceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FileRevision_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FileRevision_fileId_createdAt_idx" ON "FileRevision" ("fileId", "createdAt");
CREATE INDEX IF NOT EXISTS "FileRevision_hash_idx" ON "FileRevision" ("hash");

CREATE TABLE IF NOT EXISTS "McpToken" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "tokenHash" text NOT NULL,
  "prefix" text NOT NULL,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "profileId" uuid NOT NULL,
  "lastUsedAt" timestamptz,
  "expiresAt" timestamptz,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpToken_tokenHash_key" ON "McpToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "McpToken_profileId_idx" ON "McpToken" ("profileId");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" text PRIMARY KEY,
  "actorId" text,
  "actorType" text NOT NULL DEFAULT 'user',
  "tokenId" text,
  "action" text NOT NULL,
  "entity" text NOT NULL,
  "entityId" text,
  "meta" jsonb,
  "at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "AuditLog_tokenId_fkey"
    FOREIGN KEY ("tokenId") REFERENCES "McpToken"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuditLog_at_idx" ON "AuditLog" ("at");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog" ("entity", "entityId");

-- Pasta Prompt nas salas já existentes (não apaga nada)
INSERT INTO "WorkspaceFolder" ("id", "workspaceId", "name", "order", "createdAt", "updatedAt")
SELECT
  md5(a.id || ':Prompt')::text,
  a."workspaceId",
  'Prompt',
  -1,
  now(),
  now()
FROM "Agent" a
WHERE a."workspaceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "WorkspaceFolder" f
    WHERE f."workspaceId" = a."workspaceId" AND f."name" = 'Prompt'
  );

-- Busca híbrida (RRF). embedding nulo = só FTS.
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector,
  query_text text,
  agent_id text,
  kinds text[],
  match_count int,
  hybrid_weight float
)
RETURNS TABLE (
  "fileId" text,
  title text,
  "headingPath" text,
  content text,
  score double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH files AS (
    SELECT f.id, f.title, f.kind
    FROM "WorkspaceFile" f
    WHERE (
      agent_id IS NULL
      OR f.id IN (SELECT "fileId" FROM "AgentKnowledge" WHERE "agentId" = agent_id)
      OR f."workspaceId" IN (SELECT "workspaceId" FROM "Agent" WHERE id = agent_id AND "workspaceId" IS NOT NULL)
    )
    AND (kinds IS NULL OR cardinality(kinds) = 0 OR f.kind = ANY (kinds))
  ),
  fts AS (
    SELECT
      c."fileId",
      c."headingPath",
      c.content,
      ts_rank(c.tsv, websearch_to_tsquery('portuguese', public.immutable_unaccent(coalesce(query_text, '')))) AS fts_score,
      row_number() OVER (
        ORDER BY ts_rank(c.tsv, websearch_to_tsquery('portuguese', public.immutable_unaccent(coalesce(query_text, '')))) DESC
      ) AS fts_rank
    FROM "KnowledgeChunk" c
    JOIN files f ON f.id = c."fileId"
    WHERE coalesce(query_text, '') <> ''
      AND c.tsv @@ websearch_to_tsquery('portuguese', public.immutable_unaccent(query_text))
  ),
  vec AS (
    SELECT
      c."fileId",
      c."headingPath",
      c.content,
      (1 - (c.embedding <=> query_embedding)) AS vec_score,
      row_number() OVER (ORDER BY c.embedding <=> query_embedding) AS vec_rank
    FROM "KnowledgeChunk" c
    JOIN files f ON f.id = c."fileId"
    WHERE query_embedding IS NOT NULL
      AND c.embedding IS NOT NULL
  ),
  fused AS (
    SELECT
      coalesce(v."fileId", t."fileId") AS "fileId",
      coalesce(v."headingPath", t."headingPath") AS "headingPath",
      coalesce(v.content, t.content) AS content,
      (
        coalesce(hybrid_weight, 0.6) * (1.0 / (60 + coalesce(v.vec_rank, 1000)))
        + (1.0 - coalesce(hybrid_weight, 0.6)) * (1.0 / (60 + coalesce(t.fts_rank, 1000)))
      ) AS score
    FROM vec v
    FULL OUTER JOIN fts t
      ON v."fileId" = t."fileId" AND v."headingPath" = t."headingPath" AND v.content = t.content
  )
  SELECT
    fused."fileId",
    files.title,
    fused."headingPath",
    fused.content,
    fused.score
  FROM fused
  JOIN files ON files.id = fused."fileId"
  ORDER BY fused.score DESC
  LIMIT greatest(coalesce(match_count, 8), 1);
$$;

REVOKE ALL ON FUNCTION public.match_knowledge(vector, text, text, text[], int, float) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_knowledge(vector, text, text, text[], int, float) TO authenticated, service_role;

-- RLS nas tabelas novas
GRANT ALL ON TABLE "KnowledgeChunk", "AgentPromptLayer", "AgentPromptVersion",
  "ChangeProposal", "FileRevision", "McpToken", "AuditLog" TO service_role, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'KnowledgeChunk', 'AgentPromptLayer', 'AgentPromptVersion',
    'ChangeProposal', 'FileRevision'
  ]
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

  FOREACH t IN ARRAY ARRAY['McpToken', 'AuditLog']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I
       FOR ALL TO authenticated
       USING (public.is_admin())
       WITH CHECK (public.is_admin())',
      t
    );
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.v_knowledge_catalog AS
SELECT
  f.id,
  f.title,
  f.kind,
  f.tags,
  f."indexStatus",
  f."indexedAt",
  f."workspaceId",
  w.name AS workspace_name,
  f."folderId",
  fol.name AS folder_name,
  f."updatedAt",
  f.source,
  coalesce(array_agg(DISTINCT ak."agentId") FILTER (WHERE ak."agentId" IS NOT NULL), '{}') AS agent_ids
FROM "WorkspaceFile" f
JOIN "Workspace" w ON w.id = f."workspaceId"
LEFT JOIN "WorkspaceFolder" fol ON fol.id = f."folderId"
LEFT JOIN "AgentKnowledge" ak ON ak."fileId" = f.id
GROUP BY f.id, w.name, fol.name;

CREATE OR REPLACE VIEW public.v_agent_overview AS
SELECT
  a.id,
  a.name,
  a.slug,
  a.role,
  a.status,
  a."activePromptVersionId",
  a."workspaceId",
  (SELECT count(*) FROM "AgentKnowledge" k WHERE k."agentId" = a.id) AS docs,
  (SELECT count(*) FROM "KnowledgeChunk" c
     JOIN "AgentKnowledge" k ON k."fileId" = c."fileId"
    WHERE k."agentId" = a.id) AS chunks,
  (SELECT count(*) FROM "ChangeProposal" p
    WHERE p."agentId" = a.id AND p.status = 'pending') AS pending_proposals
FROM "Agent" a;
