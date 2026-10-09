import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function PUT(req: Request) {
  const auth = await requireUser();
  const { supabase, user } = auth;
  const body = (await req.json()) as { description?: string; levels?: string[] };

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    description: body.description ?? null,
    levels: body.levels ?? [],
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
