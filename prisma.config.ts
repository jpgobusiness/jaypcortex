import "dotenv/config";
import { defineConfig } from "prisma/config";

const isPostgres = process.env.DATABASE_PROVIDER === "postgres";

export default defineConfig({
  schema: isPostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma",
  migrations: {
    path: isPostgres ? "prisma/migrations-postgres" : "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: isPostgres
      ? (process.env.POSTGRES_DATABASE_URL ?? process.env.DATABASE_URL)
      : process.env.DATABASE_URL,
  },
});
