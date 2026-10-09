import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getApplicationWithJob } from "@/lib/server-data";
import type { AppEvent, ChatMessage, CvVersion } from "@/lib/types";
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

  return (
    <CandidaturaClient
      app={found.app}
      job={found.job}
      events={(events ?? []) as AppEvent[]}
      chat={(chat ?? []) as ChatMessage[]}
      cv={((cv ?? [])[0] as CvVersion | undefined) ?? null}
    />
  );
}
