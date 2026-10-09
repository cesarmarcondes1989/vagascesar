import { supabaseServer } from "@/lib/supabase/server";
import { getProfile } from "@/lib/server-data";
import { PerfilClient } from "./PerfilClient";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;
  return <PerfilClient profile={profile} />;
}
