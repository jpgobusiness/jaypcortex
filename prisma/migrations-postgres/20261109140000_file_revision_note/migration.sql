-- Nota opcional na revisão (ex.: nome da seção do upsert_section).
ALTER TABLE "FileRevision"
  ADD COLUMN IF NOT EXISTS "note" text;
