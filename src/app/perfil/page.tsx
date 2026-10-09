import { OWNER_ID, supabaseServer } from "@/lib/supabase/server";
import { getProfile } from "@/lib/server-data";
import { PerfilClient } from "./PerfilClient";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = await supabaseServer();
  const profile = await getProfile(supabase, OWNER_ID);
  return <PerfilClient profile={profile} />;
}
