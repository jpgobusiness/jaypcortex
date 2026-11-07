-- OAuth authorization_code + PKCE + refresh. Não toca SQLite / dev.db.

ALTER TABLE "McpOAuthClient"
  ADD COLUMN IF NOT EXISTS "redirectUris" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "publicClient" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "grantTypes" text[] NOT NULL DEFAULT '{client_credentials}';

ALTER TABLE "McpOAuthAccessToken"
  ADD COLUMN IF NOT EXISTS "profileId" uuid,
  ADD COLUMN IF NOT EXISTS "grantType" text NOT NULL DEFAULT 'client_credentials';

CREATE INDEX IF NOT EXISTS "McpOAuthAccessToken_profileId_idx" ON "McpOAuthAccessToken" ("profileId");

CREATE TABLE IF NOT EXISTS "McpOAuthAuthorizationCode" (
  "id" text PRIMARY KEY,
  "codeHash" text NOT NULL,
  "clientId" text NOT NULL,
  "profileId" uuid NOT NULL,
  "redirectUri" text NOT NULL,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "codeChallenge" text NOT NULL,
  "codeChallengeMethod" text NOT NULL DEFAULT 'S256',
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "McpOAuthAuthorizationCode_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_codeHash_key" ON "McpOAuthAuthorizationCode" ("codeHash");
CREATE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_clientId_idx" ON "McpOAuthAuthorizationCode" ("clientId");
CREATE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_expiresAt_idx" ON "McpOAuthAuthorizationCode" ("expiresAt");

CREATE TABLE IF NOT EXISTS "McpOAuthRefreshToken" (
  "id" text PRIMARY KEY,
  "tokenHash" text NOT NULL,
  "clientId" text NOT NULL,
  "profileId" uuid NOT NULL,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "McpOAuthRefreshToken_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthRefreshToken_tokenHash_key" ON "McpOAuthRefreshToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "McpOAuthRefreshToken_clientId_idx" ON "McpOAuthRefreshToken" ("clientId");
CREATE INDEX IF NOT EXISTS "McpOAuthRefreshToken_profileId_idx" ON "McpOAuthRefreshToken" ("profileId");
CREATE INDEX IF NOT EXISTS "McpOAuthRefreshToken_expiresAt_idx" ON "McpOAuthRefreshToken" ("expiresAt");

GRANT ALL ON TABLE "McpOAuthAuthorizationCode", "McpOAuthRefreshToken" TO service_role, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['McpOAuthAuthorizationCode', 'McpOAuthRefreshToken']
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
