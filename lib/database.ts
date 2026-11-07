/**
 * Qual banco o processo usa.
 * sqlite = app local até o corte. postgres = Supabase (scripts, Vercel).
 */
export type DatabaseProvider = "sqlite" | "postgres";

export function getDatabaseProvider(): DatabaseProvider {
  return process.env.DATABASE_PROVIDER === "postgres" ? "postgres" : "sqlite";
}

export function getSqliteDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "file:./dev.db";
}

/** Connection string direta (porta 5432) — migrations. */
export function getPostgresDirectUrl(): string | undefined {
  return process.env.POSTGRES_DATABASE_URL;
}

/** Pooler do Supabase — app na Vercel. */
export function getPostgresPoolerUrl(): string | undefined {
  return process.env.POSTGRES_POOLER_URL ?? process.env.POSTGRES_DATABASE_URL;
}

export function getPostgresUrlForAdapter(): string {
  const url = getPostgresPoolerUrl();
  if (!url) {
    throw new Error(
      "POSTGRES_POOLER_URL ou POSTGRES_DATABASE_URL ausente. Defina no .env (não commitar)."
    );
  }
  return url;
}
