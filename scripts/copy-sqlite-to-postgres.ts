/**
 * Copia dados do SQLite local para o Postgres do Supabase, mantendo os cuid.
 * Não copia OvertimeAttachment (anexos antigos ficam só no backup).
 *
 * Uso: npx tsx scripts/copy-sqlite-to-postgres.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import pg from "pg";

const SKIP = new Set(["OvertimeAttachment", "_prisma_migrations"]);

const TABLE_ORDER = [
  "Stage",
  "Commercial",
  "ActivityStatus",
  "ActivityType",
  "Opportunity",
  "Activity",
  "AutomationContact",
  "MindMapGroup",
  "MindMap",
  "ActivityMapNode",
  "MindMapShape",
  "MindMapConnection",
  "ChallengeItem",
  "ChallengeDay",
  "ChallengeDayCheck",
  "ChallengeMonth",
  "OvertimeMonth",
  "OvertimeEntry",
  "QuarterGoal",
  "DailyHabit",
  "DailyDay",
  "DailyHabitCheck",
  "Workspace",
  "WorkspaceFolder",
  "WorkspaceFile",
  "Agent",
  "AgentKnowledge",
];

function sqlitePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = url.startsWith("file:") ? url.slice("file:".length) : url;
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    throw new Error(`SQLite não encontrado: ${resolved}`);
  }
  return resolved;
}

function pgConfig() {
  const url = process.env.POSTGRES_DATABASE_URL;
  if (!url) throw new Error("POSTGRES_DATABASE_URL ausente no .env");
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false } as const,
  };
}

function convert(value: unknown, dataType: string): unknown {
  if (value === null || value === undefined) return null;
  if (dataType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "bigint") return value !== 0n;
    const s = String(value).toLowerCase();
    return s === "true" || s === "1" || s === "t";
  }
  if (dataType.startsWith("timestamp") || dataType === "date") {
    return value;
  }
  if (typeof value === "bigint") return Number(value);
  return value;
}

async function main() {
  const sqlite = new Database(sqlitePath(), { readonly: true, fileMustExist: true });
  const client = new pg.Client(pgConfig());
  await client.connect();

  const typeRows = await client.query<{ table_name: string; column_name: string; data_type: string }>(
    `select table_name, column_name, data_type
     from information_schema.columns
     where table_schema = 'public'`
  );
  const types = new Map<string, string>();
  for (const row of typeRows.rows) {
    types.set(`${row.table_name}.${row.column_name}`, row.data_type);
  }

  const sqliteCounts: Record<string, number> = {};
  const pgCounts: Record<string, number> = {};

  await client.query("begin");
  try {
    const quoted = TABLE_ORDER.map((t) => `"${t}"`).join(", ");
    await client.query(`truncate table ${quoted} restart identity cascade`);

    for (const table of TABLE_ORDER) {
      const rows = sqlite.prepare(`select * from "${table}"`).all() as Record<string, unknown>[];
      sqliteCounts[table] = rows.length;
      if (rows.length === 0) {
        pgCounts[table] = 0;
        continue;
      }
      const columns = Object.keys(rows[0]);
      const colSql = columns.map((c) => `"${c}"`).join(", ");
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const insert = `insert into "${table}" (${colSql}) values (${placeholders})`;
      for (const row of rows) {
        const values = columns.map((col) =>
          convert(row[col], types.get(`${table}.${col}`) ?? "text")
        );
        await client.query(insert, values);
      }
      pgCounts[table] = rows.length;
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }

  const skipped = sqlite.prepare(`select count(*) as n from "OvertimeAttachment"`).get() as { n: number };
  sqliteCounts.OvertimeAttachment = Number(skipped.n);
  const pgAtt = await client.query(`select count(*)::int as n from "OvertimeAttachment"`);
  pgCounts.OvertimeAttachment = pgAtt.rows[0].n;

  console.log("tabela\t\tsqlite\tpostgres");
  const names = [...TABLE_ORDER, "OvertimeAttachment"];
  let ok = true;
  for (const table of names) {
    const a = sqliteCounts[table] ?? 0;
    const b = pgCounts[table] ?? 0;
    const mark = table === "OvertimeAttachment" ? "(não copia)" : a === b ? "ok" : "DIFF";
    if (table !== "OvertimeAttachment" && a !== b) ok = false;
    console.log(`${table}\t${a}\t${b}\t${mark}`);
  }

  sqlite.close();
  await client.end();
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
