import { supabaseServer } from "@/lib/supabase/server";
import { getProfile } from "@/lib/server-data";
import { BuscarClient } from "./BuscarClient";

export const dynamic = "force-dynamic";

export default async function BuscarPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;

  const { data: saved } = await supabase.from("jobs").select("id, external_id");
  const { data: apps } = await supabase.from("applications").select("id, job_id");
  const appByJob = new Map((apps ?? []).map((a) => [a.job_id as string, a.id as string]));
  const savedMap: Record<string, string> = {};
  for (const j of saved ?? []) {
    const appId = appByJob.get(j.id as string);
    if (appId) savedMap[j.external_id as string] = appId;
  }

  return <BuscarClient roles={profile?.suggested_roles ?? []} prefs={profile?.search_prefs ?? null} savedMap={savedMap} />;
}
