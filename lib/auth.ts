import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export type ProfileRole = "admin" | "member";

export type AppProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: ProfileRole;
  active: boolean;
};

export async function getSessionUser() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getSessionProfile(): Promise<AppProfile | null> {
  const supabase = await createSupabaseServer();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error || !data || data.active === false) return null;
  return data as AppProfile;
}

export async function requireApiUser() {
  const profile = await getSessionProfile();
  if (!profile) {
    return {
      profile: null as AppProfile | null,
      error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }
  return { profile, error: null };
}

export async function requireApiAdmin() {
  const { profile, error } = await requireApiUser();
  if (error) return { profile: null, error };
  if (profile?.role !== "admin") {
    return {
      profile: null,
      error: NextResponse.json({ error: "Só admin" }, { status: 403 }),
    };
  }
  return { profile, error: null };
}
