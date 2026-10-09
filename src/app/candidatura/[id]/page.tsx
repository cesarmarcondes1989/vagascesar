import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getApplicationWithJob } from "@/lib/server-data";
import type { AppEvent, ChatMessage, CvVersion } from "@/lib/types";
import { normalizeCv, normalizeOptions, toStrArr } from "@/lib/normalize";
import { CandidaturaClient } from "./CandidaturaClient";

export const dynamic = "force-dynamic";

export default async function CandidaturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const found = await getApplicationWithJob(supabase, id);
  if (!found) notFound();

  const [{ data: events }, { data: chat }, { data: cv }] = await Promise.all([
    supabase.from("application_events").select("*").eq("application_id", id).order("event_date").order("created_at"),
    supabase.from("chat_messages").select("*").eq("application_id", id).order("created_at"),
    supabase.from("cv_versions").select("*").eq("application_id", id).order("created_at", { ascending: false }).limit(1),
  ]);

  // Older rows may hold AI output in the wrong shape (string instead of list): fix it for display.
  const cvRow = (cv ?? [])[0] as CvVersion | undefined;
  const cvSafe = cvRow ? { ...cvRow, content: normalizeCv(cvRow.content) } : null;
  const chatSafe = ((chat ?? []) as ChatMessage[]).map((m) => ({ ...m, options: m.options ? normalizeOptions(m.options) : null }));
  const eventsSafe = ((events ?? []) as AppEvent[]).map((e) => ({ ...e, lessons: e.lessons ? toStrArr(e.lessons) : null }));
  const jobSafe = {
    ...found.job,
    resp: toStrArr(found.job.resp), req: toStrArr(found.job.req), dif: toStrArr(found.job.dif), benef: toStrArr(found.job.benef),
    keywords: toStrArr(found.job.keywords), strengths: toStrArr(found.job.strengths), gaps: toStrArr(found.job.gaps),
  };

  return (
    <CandidaturaClient
      app={found.app}
      job={jobSafe}
      events={eventsSafe}
      chat={chatSafe}
      cv={cvSafe}
    />
  );
}
