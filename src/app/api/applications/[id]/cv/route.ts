import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { tailorCv } from "@/lib/ai";
import { getApplicationWithJob, getProfile } from "@/lib/server-data";

export const maxDuration = 60;

/** Generates a new tailored CV version. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const found = await getApplicationWithJob(supabase, id);
  if (!found) return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  try {
    const profile = await getProfile(supabase, user.id);
    const content = await tailorCv(profile ?? {}, found.job, found.app.cv_extras ?? []);
    const { data, error } = await supabase
      .from("cv_versions")
      .insert({ user_id: user.id, application_id: id, content })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ version: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Adds an answer from the copilot to the CV extras. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await ctx.params;
  const { text } = (await req.json()) as { text: string };

  const found = await getApplicationWithJob(supabase, id);
  if (!found) return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  const extras = found.app.cv_extras ?? [];
  if (!extras.includes(text)) extras.push(text);
  const { error } = await supabase.from("applications").update({ cv_extras: extras }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ extras });
}
