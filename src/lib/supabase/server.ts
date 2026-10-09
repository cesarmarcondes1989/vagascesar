import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Single-user app, no login: every row belongs to OWNER_ID and the server talks to
 * Supabase with the service role key (bypasses RLS). The key never reaches the browser,
 * and RLS stays on, so the public anon key cannot read anything.
 */
export const OWNER_ID = process.env.OWNER_ID || "00000000-0000-0000-0000-000000000001";

let _client: SupabaseClient | null = null;

export async function supabaseServer() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.");
    _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _client;
}

/** Kept with the same shape the routes already use. */
export async function requireUser() {
  const supabase = await supabaseServer();
  return { supabase, user: { id: OWNER_ID } } as const;
}
