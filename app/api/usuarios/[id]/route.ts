import { ok, badRequest, serverError, notFound } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { profile: actor, error } = await requireApiAdmin();
    if (error) return error;
    const { id } = await params;
    const body = await req.json();
    const supabase = createSupabaseAdmin();

    const { data: current, error: currentError } = await supabase
      .from("profiles")
      .select("id, email, role, active")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return notFound("Usuário não encontrado");

    if (actor && actor.id === id && body.active === false) {
      return badRequest("Você não pode desativar a si mesmo");
    }
    if (current.role === "admin" && body.role === "member") {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("active", true);
      if (countError) throw countError;
      if ((count ?? 0) <= 1) {
        return badRequest("Precisa ficar pelo menos um admin ativo");
      }
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.display_name === "string") {
      patch.display_name = body.display_name.trim() || current.email.split("@")[0];
    }
    if (body.role === "admin" || body.role === "member") patch.role = body.role;
    if (typeof body.active === "boolean") patch.active = body.active;

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) throw updateError;
    }

    const password = typeof body.password === "string" ? body.password : "";
    if (password) {
      if (password.length < 8) return badRequest("Senha com no mínimo 8 caracteres");
      const { error: pwError } = await supabase.auth.admin.updateUserById(id, {
        password,
      });
      if (pwError) return badRequest(pwError.message);
    }

    const { data: updated, error: readError } = await supabase
      .from("profiles")
      .select("id, email, display_name, role, active, created_at")
      .eq("id", id)
      .single();
    if (readError) throw readError;
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
