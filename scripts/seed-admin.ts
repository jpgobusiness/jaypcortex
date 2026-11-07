/**
 * Cria o usuário admin no Auth (sem senha no código).
 * A senha é definida no painel do Supabase.
 *
 * Uso: npx tsx scripts/seed-admin.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ausente no .env`);
  return v;
}

async function main() {
  const email = requireEnv("ADMIN_EMAIL").trim().toLowerCase();
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;

  let user = (list.users ?? []).find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    await supabase.from("signup_allowlist").upsert({ email }, { onConflict: "email" });
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: "Admin" },
    });
    if (error) {
      await supabase.from("signup_allowlist").delete().eq("email", email);
      throw error;
    }
    user = data.user;
    console.log("admin criado no Auth (defina a senha no painel)");
  } else {
    console.log("admin já existia no Auth");
  }
  if (!user) throw new Error("falha ao obter o usuário admin");

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      display_name: "Admin",
      role: "admin",
      active: true,
    },
    { onConflict: "id" }
  );
  if (upsertError) throw upsertError;

  console.log(`profile admin ok: ${email}`);
  console.log("próximo: Authentication → Users → o usuário → Set password");
  console.log("e Authentication → Providers → Email → desligar Sign ups");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
