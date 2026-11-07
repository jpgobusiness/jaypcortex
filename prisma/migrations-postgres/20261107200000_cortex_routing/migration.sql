-- Cortex Etapa 1: routing por agente + log de roteamento.
-- Postgres-only. Aditivo. Não apaga dados.

ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "routing" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "CortexRouteLog" (
  "id" text PRIMARY KEY,
  "request" text NOT NULL,
  "normalized" text NOT NULL DEFAULT '',
  "agentSlug" text,
  "mode" text NOT NULL,
  "intentKey" text,
  "confidence" double precision NOT NULL,
  "reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "candidates" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "actorId" text,
  "source" text NOT NULL DEFAULT 'mcp',
  "latencyMs" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CortexRouteLog_createdAt_idx" ON "CortexRouteLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "CortexRouteLog_agentSlug_createdAt_idx" ON "CortexRouteLog" ("agentSlug", "createdAt");

GRANT ALL ON TABLE "CortexRouteLog" TO service_role, authenticated;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public."CortexRouteLog" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS authenticated_active_all ON public."CortexRouteLog"';
  EXECUTE
    'CREATE POLICY authenticated_active_all ON public."CortexRouteLog"
     FOR ALL TO authenticated
     USING (public.is_active_user())
     WITH CHECK (public.is_active_user())';
END $$;
