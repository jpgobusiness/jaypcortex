import "dotenv/config";
import { reindexAll } from "../lib/knowledge/indexer";

async function main() {
  const limit = Number(process.argv[2] ?? 400);
  const results = await reindexAll(limit);
  const counts = results.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ total: results.length, counts }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
