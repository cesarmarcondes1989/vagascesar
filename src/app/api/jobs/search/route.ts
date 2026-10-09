import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { structureJobs } from "@/lib/ai";
import { searchJobs } from "@/lib/jobs-source";
import { getProfile } from "@/lib/server-data";
import type { SearchPrefs, StructuredJob } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await requireUser();
  const { supabase, user } = auth;
  const prefs = (await req.json()) as SearchPrefs;

  if (!prefs.roles?.length) return NextResponse.json({ error: "Marque ao menos um cargo." }, { status: 400 });
  if (!prefs.regions?.length && !prefs.cities?.length) return NextResponse.json({ error: "Escolha uma região ou cidade." }, { status: 400 });

  await supabase.from("profiles").upsert({ user_id: user.id, search_prefs: prefs, updated_at: new Date().toISOString() });

  try {
    const profile = await getProfile(supabase, user.id);
    const { jobs: raws, demo, queries } = await searchJobs(prefs.roles, prefs.regions, prefs.cities);

    // Source filter happens before the (paid) AI step.
    const bySource = raws.filter((r) => !prefs.sources?.length || prefs.sources.includes(r.source));
    const structured = await structureJobs(profile ?? {}, bySource.slice(0, 30));
    const rawById = new Map(bySource.map((r) => [r.externalId, r]));

    const jobs: StructuredJob[] = structured
      .map((s) => {
        const raw = rawById.get(s.id);
        if (!raw) return null;
        return {
          ...s,
          external_id: raw.externalId,
          source: raw.source === "Outras" && raw.via ? raw.via : raw.source,
          url: raw.url,
          region: raw.region,
          posted: s.posted || raw.posted || null,
          salary: s.salary || raw.salary || "não divulgado",
          demo,
        } satisfies StructuredJob;
      })
      .filter((j): j is NonNullable<typeof j> => j !== null)
      .filter((j) => !prefs.modes?.length || prefs.modes.includes(j.mode))
      .sort((a, b) => b.match - a.match);

    return NextResponse.json({ jobs, demo, queries, found: raws.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
