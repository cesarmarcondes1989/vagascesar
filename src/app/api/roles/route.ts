import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { suggestRoles } from "@/lib/ai";
import { getProfile } from "@/lib/server-data";

export const maxDuration = 60;

export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;

  const profile = await getProfile(supabase, user.id);
  if (!profile || (!profile.description && !profile.cv_text)) {
    return NextResponse.json({ error: "Suba o CV ou escreva sua descrição primeiro." }, { status: 400 });
  }
  try {
    const roles = await suggestRoles(profile);
    await supabase.from("profiles").update({ suggested_roles: roles, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return NextResponse.json({ roles });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
