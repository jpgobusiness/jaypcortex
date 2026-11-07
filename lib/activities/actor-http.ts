import { createSupabaseServer } from "@/lib/supabase/server";
import type { Actor } from "./service";

export async function requestActor(): Promise<Actor> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { actorId: user?.id ?? null, source: "ui" };
  } catch {
    return { actorId: null, source: "ui" };
  }
}
