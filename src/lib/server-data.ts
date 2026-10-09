import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application, JobRow, Profile } from "./types";

export function todaySP() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function getApplicationWithJob(supabase: SupabaseClient, id: string) {
  const { data: app } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
  if (!app) return null;
  const { data: job } = await supabase.from("jobs").select("*").eq("id", app.job_id).single();
  return { app: app as Application, job: job as JobRow };
}
