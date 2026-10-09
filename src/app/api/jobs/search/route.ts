import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { structureJobs } from "@/lib/ai";
import { searchJobs } from "@/lib/jobs-source";
import { getProfile } from "@/lib/server-data";
import type { LastSearch, SearchPrefs, StructuredJob, SuggestedRole } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await requireUser();
  const { supabase, user } = auth;
  const prefs = (await req.json()) as SearchPrefs;

  if (!prefs.roles?.length) return NextResponse.json({ error: "Marque ao menos um cargo." }, { status: 400 });
  if (!prefs.regions?.length && !prefs.cities?.length) return NextResponse.json({ error: "Escolha uma região ou cidade." }, { status: 400 });

  // Persist filters, and any role typed by hand, so the screen comes back as you left it.
  const current = await getProfile(supabase, user.id);
  const known = new Set((current?.suggested_roles ?? []).map((r) => r.title));
  const extraRoles: SuggestedRole[] = prefs.roles
    .filter((t) => !known.has(t))
    .map((title) => ({ title, match: null, why: "Adicionado por você.", wild: false }));
  const saveErr = (
    await supabase.from("profiles").upsert({
      user_id: user.id,
      search_prefs: prefs,
      ...(extraRoles.length ? { suggested_roles: [...(current?.suggested_roles ?? []), ...extraRoles] } : {}),
      updated_at: new Date().toISOString(),
    })
  ).error;
  if (saveErr) return NextResponse.json({ error: `Não consegui salvar no Supabase: ${saveErr.message}` }, { status: 500 });

  try {
    const profile = current;
    const { jobs: raws, demo, queries, errors, broadened } = await searchJobs(prefs.roles, prefs.regions, prefs.cities);
    if (raws.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: `O SerpAPI recusou a busca: ${errors[0]}` }, { status: 502 });
    }

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

    const meta = { demo, queries, found: raws.length, broadened, afterSource: bySource.length };
    const last: LastSearch = { at: new Date().toISOString(), jobs, meta };
    await supabase.from("profiles").update({ last_search: last }).eq("user_id", user.id);
    return NextResponse.json({ jobs, ...meta });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
