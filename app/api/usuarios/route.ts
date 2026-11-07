import { ok, badRequest, serverError } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { error } = await requireApiAdmin();
    if (error) return error;
    const supabase = createSupabaseAdmin();
    const { data, error: qError } = await supabase
      .from("profiles")
      .select("id, email, display_name, role, active, created_at")
      .order("created_at", { ascending: true });
    if (qError) throw qError;
    return ok(data ?? []);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { profile: actor, error } = await requireApiAdmin();
    if (error) return error;

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.display_name ?? "").trim() || email.split("@")[0];
    const role = body.role === "admin" ? "admin" : "member";

    if (!email || !email.includes("@")) return badRequest("E-mail inválido");
    if (password.length < 8) return badRequest("Senha com no mínimo 8 caracteres");

    const supabase = createSupabaseAdmin();
    const { error: allowError } = await supabase
      .from("signup_allowlist")
      .upsert({ email }, { onConflict: "email" });
    if (allowError) throw allowError;

    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (createError) {
      await supabase.from("signup_allowlist").delete().eq("email", email);
      return badRequest(createError.message);
    }
    if (!data.user) return serverError(new Error("Falha ao criar usuário"));

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email,
        display_name: displayName,
        role,
        active: true,
        created_by: actor?.id,
      },
      { onConflict: "id" }
    );
    if (upsertError) throw upsertError;

    return ok(
      {
        id: data.user.id,
        email,
        display_name: displayName,
        role,
        active: true,
      },
      201
    );
  } catch (e) {
    return serverError(e);
  }
}
