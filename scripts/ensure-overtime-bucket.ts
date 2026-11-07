/**
 * Garante o bucket privado overtime-attachments (vazio; anexos antigos não sobem).
 * Uso: npx tsx scripts/ensure-overtime-bucket.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "overtime-attachments";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ausente no .env`);
  return v;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  const exists = (buckets ?? []).some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "20MB",
    });
    if (error) throw error;
    console.log(`bucket criado: ${BUCKET} (privado)`);
  } else {
    console.log(`bucket já existia: ${BUCKET}`);
  }

  const { data: files, error: filesError } = await supabase.storage.from(BUCKET).list();
  if (filesError) throw filesError;
  console.log(`objetos no bucket: ${(files ?? []).length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
