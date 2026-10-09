import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { structureJobs } from "@/lib/ai";
import { buildPlaces, buildQueries, searchJobs } from "@/lib/jobs-source";
import { getProfile } from "@/lib/server-data";
import type { LastSearch, SearchPrefs, StructuredJob, SuggestedRole } from "@/lib/types";

export const maxDuration = 120;

/**
 * Streams NDJSON so the screen can show real progress:
 *   {type:"progress", pct, step, detail}   (many)
 *   {type:"done", jobs, ...meta}           (once, on success)
 *   {type:"error", error}                  (once, on failure)
 */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  const prefs = (await req.json()) as SearchPrefs;

  if (!prefs.roles?.length) return NextResponse.json({ error: "Marque ao menos um cargo." }, { status: 400 });
  if (!prefs.regions?.length && !prefs.cities?.length) return NextResponse.json({ error: "Escolha uma região ou cidade." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const progress = (pct: number, step: string, detail = "") => send({ type: "progress", pct: Math.round(pct), step, detail });

      try {
        progress(2, "Salvando seus filtros");
        const current = await getProfile(supabase, user.id);
        const known = new Set((current?.suggested_roles ?? []).map((r) => r.title));
        const extraRoles: SuggestedRole[] = prefs.roles
          .filter((t) => !known.has(t))
          .map((title) => ({ title, match: null, why: "Adicionado por você.", wild: false }));
        const { error: saveErr } = await supabase.from("profiles").upsert({
          user_id: user.id,
          search_prefs: prefs,
          ...(extraRoles.length ? { suggested_roles: [...(current?.suggested_roles ?? []), ...extraRoles] } : {}),
          updated_at: new Date().toISOString(),
        });
        if (saveErr) throw new Error(`Não consegui salvar no Supabase: ${saveErr.message}`);

        const planned = buildQueries(prefs.roles, buildPlaces(prefs.regions, prefs.cities)).length;
        progress(5, "Buscando vagas no Google Jobs", `${planned} consultas (cargo × local)`);

        // 5% → 45%: SerpAPI queries
        const { jobs: raws, demo, queries, errors, broadened } = await searchJobs(prefs.roles, prefs.regions, prefs.cities, (p) => {
          const base = p.phase === "query" ? 5 : 30;
          const span = p.phase === "query" ? 25 : 15;
          progress(
            base + (p.done / p.total) * span,
            p.phase === "query"
              ? `Buscando vagas no Google Jobs (${p.done}/${p.total})`
              : `Nada na busca exata, ampliando os termos (${p.done}/${p.total})`,
            `${p.label} · ${p.found} no total até agora`,
          );
        });
        if (raws.length === 0 && errors.length > 0) throw new Error(`O SerpAPI recusou a busca: ${errors[0]}`);

        const bySource = raws.filter((r) => !prefs.sources?.length || prefs.sources.includes(r.source));
        const toRead = bySource.slice(0, 30);
        progress(
          46,
          demo ? "Modo demo: usando vagas de exemplo" : `${raws.length} anúncios encontrados`,
          `${bySource.length} das fontes que você marcou${bySource.length > 30 ? " · a IA vai ler as 30 primeiras" : ""}`,
        );

        // 50% → 95%: Claude reads and scores in parallel batches
        let structured: Awaited<ReturnType<typeof structureJobs>> = [];
        if (toRead.length) {
          progress(50, "A IA está lendo e avaliando as vagas", `${toRead.length} vagas em lotes de 6, em paralelo`);
          structured = await structureJobs(current ?? {}, toRead, (done, total, jobsDone) =>
            progress(50 + (done / total) * 45, `A IA está lendo e avaliando as vagas (${done}/${total} lotes)`, `${jobsDone} de ${toRead.length} vagas lidas`),
          );
        }

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

        progress(97, "Salvando o resultado", `${jobs.length} vagas ordenadas por aderência`);
        const meta = { demo, queries, found: raws.length, broadened, afterSource: bySource.length };
        const last: LastSearch = { at: new Date().toISOString(), jobs, meta };
        await supabase.from("profiles").update({ last_search: last }).eq("user_id", user.id);

        send({ type: "done", jobs, ...meta });
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
