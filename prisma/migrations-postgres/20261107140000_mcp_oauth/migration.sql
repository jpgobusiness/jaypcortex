-- OAuth 2.0 client_credentials para o MCP (Amazon Quick).
-- Postgres-only. Não toca SQLite / dev.db.

CREATE TABLE IF NOT EXISTS "McpOAuthClient" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "clientId" text NOT NULL,
  "clientSecretHash" text NOT NULL,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthClient_clientId_key" ON "McpOAuthClient" ("clientId");

CREATE TABLE IF NOT EXISTS "McpOAuthAccessToken" (
  "id" text PRIMARY KEY,
  "tokenHash" text NOT NULL,
  "clientId" text NOT NULL,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "McpOAuthAccessToken_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthAccessToken_tokenHash_key" ON "McpOAuthAccessToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "McpOAuthAccessToken_clientId_idx" ON "McpOAuthAccessToken" ("clientId");
CREATE INDEX IF NOT EXISTS "McpOAuthAccessToken_expiresAt_idx" ON "McpOAuthAccessToken" ("expiresAt");

GRANT ALL ON TABLE "McpOAuthClient", "McpOAuthAccessToken" TO service_role, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['McpOAuthClient', 'McpOAuthAccessToken']
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
