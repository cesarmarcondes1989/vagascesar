import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { structureJobs, type StructuredPart } from "@/lib/ai";
import { buildPlaces, buildQueries, searchJobs, type RawJob } from "@/lib/jobs-source";
import { getProfile } from "@/lib/server-data";
import type { LastSearch, SearchPrefs, StructuredJob, SuggestedRole } from "@/lib/types";

// Vercel caps this by plan; 300s is the max with Fluid Compute. The search also has its own
// budget below, so it always finishes cleanly (with what it has) before the platform kills it.
export const maxDuration = 300;

/** Time budget for one search. Override with SEARCH_BUDGET_SECONDS if your plan allows less/more. */
const BUDGET_MS = Number(process.env.SEARCH_BUDGET_SECONDS || 50) * 1000;

/** Max listings sent to the AI per search (cost/time guard). */
const MAX_TO_READ = 30;

/**
 * Streams NDJSON as a pipeline: each SerpAPI query that returns is shown at once
 * and sent to the AI right away, without waiting for the other queries.
 *   {type:"progress", pct, step, detail}
 *   {type:"found", items:[{external_id,title,company,city,source}]}   listings found, AI still reading
 *   {type:"jobs", jobs:[StructuredJob]}                               listings read and scored by the AI
 *   {type:"done", jobs, ...meta} | {type:"error", error}
 */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  const prefs = (await req.json()) as SearchPrefs;

  if (!prefs.roles?.length) return NextResponse.json({ error: "Marque ao menos um cargo." }, { status: 400 });
  if (!prefs.regions?.length && !prefs.cities?.length) return NextResponse.json({ error: "Escolha uma região ou cidade." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      const timeLeft = () => BUDGET_MS - (Date.now() - startedAt);
      let closed = false;
      // Late AI batches (after the time budget) must not write to a closed stream.
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          closed = true;
        }
      };

      // Progress = 40% for the queries + 55% for the AI reading, on top of 5% setup.
      let qDone = 0;
      let qTotal = 1;
      let queued = 0;
      let read = 0;
      let lastStep = "";
      const progress = (step?: string, detail = "") => {
        if (step) lastStep = step;
        const pct = 5 + 40 * (qDone / qTotal) + (queued ? 55 * (read / Math.max(queued, 1)) * Math.min(1, qDone / qTotal) : 0);
        send({ type: "progress", pct: Math.min(99, Math.round(pct)), step: lastStep, detail });
      };

      try {
        send({ type: "progress", pct: 2, step: "Salvando seus filtros", detail: "" });
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

        qTotal = buildQueries(prefs.roles, buildPlaces(prefs.regions, prefs.cities)).length || 1;
        progress("Buscando vagas no Google Jobs", `${qTotal} consultas (cargo × local) em paralelo`);

        const seen = new Set<string>();
        const rawById = new Map<string, RawJob>();
        const finalJobs: StructuredJob[] = [];
        const aiTasks: Promise<void>[] = [];
        let demoMode = false;
        let afterSource = 0;
        let lastSave = 0;
        /** Save partial results along the way, so nothing is lost if the function is cut off. */
        const savePartial = async (force = false) => {
          if (!force && Date.now() - lastSave < 4000) return;
          lastSave = Date.now();
          const sorted = [...finalJobs].sort((a, b) => b.match - a.match);
          const partial: LastSearch = {
            at: new Date(startedAt).toISOString(),
            jobs: sorted,
            meta: { demo: demoMode, queries: qTotal, found: seen.size, broadened: false, afterSource },
          };
          await supabase.from("profiles").update({ last_search: partial }).eq("user_id", user.id);
        };

        const toJob = (s: StructuredPart): StructuredJob | null => {
          const raw = rawById.get(s.id);
          if (!raw) return null;
          const job: StructuredJob = {
            ...s,
            external_id: raw.externalId,
            source: raw.source === "Outras" && raw.via ? raw.via : raw.source,
            url: raw.url,
            region: raw.region,
            posted: s.posted || raw.posted || null,
            salary: s.salary || raw.salary || "não divulgado",
            demo: demoMode,
          };
          return !prefs.modes?.length || prefs.modes.includes(job.mode) ? job : null;
        };

        /** New listings from one query: dedupe, filter by source, show them, send to the AI now. */
        const handleBatch = (batch: RawJob[]) => {
          const fresh = batch.filter((r) => {
            if (seen.has(r.externalId)) return false;
            seen.add(r.externalId);
            return !prefs.sources?.length || prefs.sources.includes(r.source);
          });
          afterSource += fresh.length;
          // Out of time: show what's ready instead of starting AI work that can't finish.
          if (timeLeft() < 15000) return;
          const room = MAX_TO_READ - queued;
          const take = fresh.slice(0, Math.max(0, room));
          if (!take.length) return;
          take.forEach((r) => rawById.set(r.externalId, r));
          queued += take.length;
          send({
            type: "found",
            items: take.map((r) => ({ external_id: r.externalId, title: r.title, company: r.company, city: r.location, source: r.source })),
          });
          let readInTask = 0;
          aiTasks.push(
            structureJobs(current ?? {}, take, (_done, _total, jobsDoneInTask, results) => {
              read += jobsDoneInTask - readInTask;
              readInTask = jobsDoneInTask;
              const jobs = results.map(toJob).filter((j): j is StructuredJob => j !== null);
              finalJobs.push(...jobs);
              // readIds lets the screen drop the "IA lendo…" card even if the AI skipped a listing.
              send({ type: "jobs", jobs, readIds: results.map((r) => r.id) });
              void savePartial();
            }).then(
              () => undefined,
              (e: Error) => progress(undefined, `Um lote falhou na IA e foi pulado: ${e.message}`),
            ),
          );
        };

        const { jobs: raws, demo, queries, errors, broadened } = await searchJobs(prefs.roles, prefs.regions, prefs.cities, (p) => {
          if (p.phase === "query") qDone = p.done;
          handleBatch(p.batch);
          progress(
            p.phase === "query" ? `Buscando vagas no Google Jobs (${p.done}/${p.total})` : `Nada na busca exata, ampliando os termos (${p.done}/${p.total})`,
            `${p.label} · ${p.found} no total · ${queued} já com a IA`,
          );
        });
        demoMode = demo;
        if (demo) handleBatch(raws); // demo mode returns everything at once
        if (raws.length === 0 && errors.length > 0) throw new Error(`O SerpAPI recusou a busca: ${errors[0]}`);
        qDone = qTotal;

        if (queued > 0) progress(`A IA está terminando de ler as vagas`, `${read} de ${queued} lidas`);
        // Report AI progress while waiting for the remaining batches.
        const ticker = setInterval(() => progress(`A IA está terminando de ler as vagas`, `${read} de ${queued} lidas`), 1500);
        let timedOut = false;
        await Promise.race([
          Promise.all(aiTasks),
          new Promise<void>((resolve) => setTimeout(() => ((timedOut = true), resolve()), Math.max(0, timeLeft() - 5000))),
        ]);
        clearInterval(ticker);
        if (timedOut) progress(`Tempo esgotado: fechando com ${finalJobs.length} vagas prontas`, `${queued - read} vagas ficaram sem leitura da IA`);

        finalJobs.sort((a, b) => b.match - a.match);
        send({ type: "progress", pct: 99, step: "Salvando o resultado", detail: `${finalJobs.length} vagas ordenadas por aderência` });
        const meta = { demo, queries, found: raws.length, broadened, afterSource, partial: timedOut };
        const last: LastSearch = { at: new Date().toISOString(), jobs: finalJobs, meta };
        await supabase.from("profiles").update({ last_search: last }).eq("user_id", user.id);

        send({ type: "done", jobs: finalJobs, ...meta });
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
