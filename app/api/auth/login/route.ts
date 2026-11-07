import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json(
        { error: "Informe e-mail e senha" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("active, role")
      .eq("email", email)
      .maybeSingle();
    if (!profile?.active) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Usuário desativado" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, role: profile.role });
  } catch {
    return NextResponse.json({ error: "Falha no login" }, { status: 500 });
  }
}
