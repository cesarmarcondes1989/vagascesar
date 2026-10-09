import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  const clean = (email ?? "").trim().toLowerCase();
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!clean) return NextResponse.json({ error: "Informe o e-mail" }, { status: 400 });
  if (allowed.length && !allowed.includes(clean)) {
    return NextResponse.json({ error: "Este e-mail não tem acesso a este app." }, { status: 403 });
  }

  const origin = new URL(req.url).origin;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
