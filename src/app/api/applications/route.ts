import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { todaySP } from "@/lib/server-data";
import type { StructuredJob } from "@/lib/types";

/** Saves a job from the search and starts its application (stage = salva). */
export async function POST(req: Request) {
  const auth = await requireUser();
  const { supabase, user } = auth;
  const { job } = (await req.json()) as { job: StructuredJob };

  // Only known columns go to the DB. Older saved searches carry an `id` (SerpAPI's job id),
  // which must never land in the uuid primary key.
  const row = {
    external_id: job.external_id,
    title: job.title,
    company: job.company,
    city: job.city,
    region: job.region,
    mode: job.mode,
    source: job.source,
    posted: job.posted,
    salary: job.salary,
    url: job.url,
    match: job.match,
    summary: job.summary,
    resp: job.resp ?? [],
    req: job.req ?? [],
    dif: job.dif ?? [],
    benef: job.benef ?? [],
    keywords: job.keywords ?? [],
    strengths: job.strengths ?? [],
    gaps: job.gaps ?? [],
  };
  if (!row.external_id || !row.title) return NextResponse.json({ error: "Vaga sem identificação" }, { status: 400 });
  const { data: jobRow, error: jobErr } = await supabase
    .from("jobs")
    .upsert({ ...row, user_id: user.id }, { onConflict: "user_id,external_id" })
    .select("id")
    .single();
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 400 });

  const { data: existing } = await supabase.from("applications").select("id").eq("job_id", jobRow.id).maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id });

  const { data: app, error: appErr } = await supabase
    .from("applications")
    .insert({ user_id: user.id, job_id: jobRow.id, stage: "salva" })
    .select("id")
    .single();
  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 400 });

  await supabase.from("application_events").insert({
    user_id: user.id,
    application_id: app.id,
    stage: "salva",
    event_date: todaySP(),
    note: `Encontrada via ${job.source}.`,
  });
  return NextResponse.json({ id: app.id });
}
