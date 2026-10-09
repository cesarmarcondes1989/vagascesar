import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { rejectionLessons } from "@/lib/ai";
import { getApplicationWithJob, getProfile, todaySP } from "@/lib/server-data";
import { STAGES, stageLabel } from "@/lib/constants";
import type { AppEvent } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await ctx.params;
  const body = (await req.json()) as { stage: string; customStage?: string; date?: string; note?: string; reason?: string };

  if (!STAGES.some((s) => s.id === body.stage)) return NextResponse.json({ error: "Fase inválida" }, { status: 400 });
  const found = await getApplicationWithJob(supabase, id);
  if (!found) return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });

  const custom = body.stage === "outra" ? body.customStage?.trim() || "Fase X" : null;
  let lessons: string[] | null = null;

  if (body.stage === "reprovado") {
    try {
      const profile = await getProfile(supabase, user.id);
      const { data: evs } = await supabase.from("application_events").select("*").eq("application_id", id).order("event_date");
      const timeline = ((evs ?? []) as AppEvent[])
        .map((e) => `${e.event_date} · ${stageLabel(e.stage, e.custom_stage)} · ${e.note ?? ""}`)
        .join("\n");
      lessons = await rejectionLessons(profile ?? {}, found.job, body.reason ?? "", timeline);
    } catch {
      lessons = null; // Still save the event if the AI call fails.
    }
  }

  const { data: ev, error } = await supabase
    .from("application_events")
    .insert({
      user_id: user.id,
      application_id: id,
      stage: body.stage,
      custom_stage: custom,
      event_date: body.date || todaySP(),
      note: body.note?.trim() || null,
      reason: body.stage === "reprovado" ? body.reason?.trim() || null : null,
      lessons,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase
    .from("applications")
    .update({ stage: body.stage, custom_stage: custom, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ event: ev });
}
