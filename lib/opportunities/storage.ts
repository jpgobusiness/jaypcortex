import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const OPPORTUNITY_FILES_BUCKET = "opportunity-files";
export const SIGNED_URL_SECONDS = 300;

export function slugify(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "arquivo";
}

export async function uploadOpportunityObject(opts: {
  path: string;
  bytes: Uint8Array;
  mimeType: string;
}) {
  const admin = createSupabaseAdmin();
  const { error } = await admin.storage.from(OPPORTUNITY_FILES_BUCKET).upload(opts.path, opts.bytes, {
    contentType: opts.mimeType,
    upsert: false,
  });
  if (error) throw error;
}

export async function signedOpportunityUrl(path: string, expires = SIGNED_URL_SECONDS) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage.from(OPPORTUNITY_FILES_BUCKET).createSignedUrl(path, expires);
  if (error || !data?.signedUrl) throw error ?? new Error("Falha ao assinar URL");
  return {
    url: data.signedUrl,
    expires_at: new Date(Date.now() + expires * 1000).toISOString(),
  };
}

export async function removeOpportunityObject(path: string) {
  const admin = createSupabaseAdmin();
  await admin.storage.from(OPPORTUNITY_FILES_BUCKET).remove([path]);
}
