"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MODES, REGIONS, SOURCES } from "@/lib/constants";
import type { LastSearch, SearchMeta, SearchPrefs, StructuredJob, SuggestedRole } from "@/lib/types";

type Props = { roles: SuggestedRole[]; prefs: SearchPrefs | null; last: LastSearch | null; savedMap: Record<string, string> };

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function BuscarClient({ roles: initialRoles, prefs, last, savedMap }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState<SuggestedRole[]>(initialRoles);
  const [checked, setChecked] = useState<string[]>(prefs?.roles?.length ? prefs.roles : initialRoles.slice(0, 3).map((r) => r.title));
  const [customRole, setCustomRole] = useState("");
  const [regions, setRegions] = useState<string[]>(prefs?.regions ?? ["campinas", "sorocaba", "vale"]);
  const [cities, setCities] = useState<string[]>(prefs?.cities ?? []);
  const [cityDraft, setCityDraft] = useState("");
  const [sources, setSources] = useState<string[]>(prefs?.sources?.length ? prefs.sources : [...SOURCES]);
  const [modes, setModes] = useState<string[]>(prefs?.modes?.length ? prefs.modes : [...MODES]);

  const [jobs, setJobs] = useState<StructuredJob[] | null>(last?.jobs ?? null);
  const [meta, setMeta] = useState<SearchMeta | null>(last?.meta ?? null);
  const [searchedAt, setSearchedAt] = useState<string | null>(last?.at ?? null);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState<"" | "search" | "save">("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(savedMap);

  const sel = useMemo(() => jobs?.find((j) => j.external_id === selected) ?? jobs?.[0], [jobs, selected]);

  const addRole = () => {
    const t = customRole.trim();
    if (!t) return;
    setRoles((r) => [...r, { title: t, match: null, why: "Adicionado por você.", wild: false }]);
    setChecked((c) => [...c, t]);
    setCustomRole("");
  };
  const addCity = () => {
    const c = cityDraft.trim();
    if (c && !cities.some((x) => x.toLowerCase() === c.toLowerCase())) setCities([...cities, c]);
    setCityDraft("");
  };

  async function search() {
    setError("");
    setBusy("search");
    const res = await fetch("/api/jobs/search", {
      method: "POST",
      body: JSON.stringify({ roles: checked, regions, cities, sources, modes } satisfies SearchPrefs),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setError(data.error ?? "Falha na busca");
    setJobs(data.jobs);
    setMeta({ demo: data.demo, queries: data.queries, found: data.found, broadened: data.broadened, afterSource: data.afterSource });
    setSelected(data.jobs[0]?.external_id ?? "");
    setSearchedAt(new Date().toISOString());
  }

  async function save(job: StructuredJob) {
    setBusy("save");
    const res = await fetch("/api/applications", { method: "POST", body: JSON.stringify({ job }) });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setError(data.error ?? "Falha ao salvar");
    setSaved((s) => ({ ...s, [job.external_id]: data.id }));
    router.push(`/candidatura/${data.id}`);
  }

  const nPlaces = regions.length + cities.length;

  if (roles.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <h1 className="font-display m-0 text-3xl">Primeiro, o perfil.</h1>
        <p className="m-0 text-muted">A IA precisa ler seu CV ou sua descrição para sugerir os cargos.</p>
        <Link href="/perfil" className="btn">
          Ir para o perfil
        </Link>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex max-w-[780px] flex-col gap-2.5">
        <span className="eyebrow">ETAPA 2 · O QUE E ONDE</span>
        <h1 className="h1 m-0">A IA leu você. Agora escolha onde apostar.</h1>
        <p className="m-0 text-[17px] leading-relaxed text-muted">Marque quantos cargos quiser. O percentual é aderência ao seu perfil, não promessa de vaga.</p>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display m-0 text-[22px]">Cargos sugeridos</h2>
          <Link href="/perfil" className="text-sm">
            Refazer sugestões no perfil
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {roles.map((r) => {
            const on = checked.includes(r.title);
            return (
              <label
                key={r.title}
                className={`flex flex-[1_1_300px] cursor-pointer items-start gap-3.5 rounded-[14px] border bg-white p-[18px] ${
                  on ? "border-brand bg-soft shadow-[inset_0_0_0_1px_var(--color-brand)]" : "border-line hover:border-brand"
                }`}
              >
                <input type="checkbox" className="mt-0.5 size-5 accent-brand" checked={on} onChange={() => setChecked(toggle(checked, r.title))} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-base leading-snug font-semibold">{r.title}</span>
                    <span className="font-mono text-[13px] whitespace-nowrap text-brand">{r.match != null ? `${r.match}%` : "seu"}</span>
                  </span>
                  <span className="text-sm leading-relaxed text-muted">{r.why}</span>
                  {r.wild && <span className="self-start rounded-md bg-warn-soft px-2 py-1 font-mono text-[11px] tracking-wider text-warn-ink">APOSTA OUSADA</span>}
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex max-w-[640px] flex-wrap items-center gap-2.5">
          <input
            className="field flex-[1_1_280px]"
            aria-label="Sugerir outro cargo"
            placeholder="Faltou algum? Ex.: Head de Inovação"
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRole())}
          />
          <button type="button" className="btn-ghost" onClick={addRole}>
            Adicionar cargo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="card flex flex-[999_1_560px] flex-col gap-3.5">
          <h2 className="font-display m-0 text-xl">Regiões do estado de SP</h2>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((g) => (
              <button key={g.id} type="button" aria-pressed={regions.includes(g.id)} className={`chip ${regions.includes(g.id) ? "chip-on" : ""}`} onClick={() => setRegions(toggle(regions, g.id))}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card flex flex-[1_1_340px] flex-col gap-3.5">
          <h2 className="font-display m-0 text-xl">Ou por cidade</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="field flex-[1_1_180px]"
              aria-label="Cidade"
              placeholder="Ex.: Jundiaí"
              value={cityDraft}
              onChange={(e) => setCityDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCity())}
            />
            <button type="button" className="btn-ghost" onClick={addCity}>
              Incluir
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <button key={c} type="button" className="chip chip-on" aria-label={`Remover ${c}`} onClick={() => setCities(cities.filter((x) => x !== c))}>
                {c} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="card flex flex-[999_1_560px] flex-col gap-3.5">
          <h2 className="font-display m-0 text-xl">Fontes</h2>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button key={s} type="button" aria-pressed={sources.includes(s)} className={`chip ${sources.includes(s) ? "chip-on" : ""}`} onClick={() => setSources(toggle(sources, s))}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="card flex flex-[1_1_340px] flex-col gap-3.5">
          <h2 className="font-display m-0 text-xl">Modelo de trabalho</h2>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button key={m} type="button" aria-pressed={modes.includes(m)} className={`chip ${modes.includes(m) ? "chip-on" : ""}`} onClick={() => setModes(toggle(modes, m))}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-deep px-5 py-[18px] text-ground">
        <span className="font-mono text-sm">
          {checked.length} cargos · {nPlaces} locais · {sources.length} fontes · {modes.join(" / ") || "nenhum modelo"}
        </span>
        <button type="button" className="btn border-ground bg-ground text-ink hover:border-white hover:bg-white" disabled={busy === "search"} onClick={search}>
          {busy === "search" ? "Varrendo as fontes e lendo as vagas…" : "Buscar vagas →"}
        </button>
      </div>

      {error && <p className="m-0 rounded-xl bg-warn-paper p-3.5 text-sm text-warn-ink">{error}</p>}

      {jobs && (
        <div className="flex flex-col gap-5" id="resultados">
          <div className="flex max-w-[780px] flex-col gap-2.5">
            <span className="eyebrow">
              ETAPA 3 · VAGAS
              {searchedAt ? ` · BUSCA DE ${new Date(searchedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
            <h2 className="h1 m-0">{jobs.length === 1 ? "1 vaga bate com o que você marcou." : `${jobs.length} vagas batem com o que você marcou.`}</h2>
            <p className="m-0 text-base text-muted">
              {meta?.demo
                ? "Modo demo: SERPAPI_KEY não configurada, então estas são vagas de exemplo. A IA estruturou e avaliou de verdade."
                : `${meta?.found ?? 0} anúncios encontrados em ${meta?.queries} consultas${meta?.broadened ? " (ampliei os termos: a busca exata não trouxe nada)" : ""}${
                    meta && meta.found > meta.afterSource ? ` · ${meta.found - meta.afterSource} descartados pelo filtro de fontes` : ""
                  }. Ordenadas por aderência.`}
            </p>
          </div>

          {jobs.length === 0 ? (
            <div className="card">
              <p className="m-0 text-muted">Nada com esses filtros. Abra mais regiões, inclua uma cidade ou marque outro cargo.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex flex-[1_1_360px] flex-col gap-2.5">
                {jobs.map((j) => (
                  <button
                    key={j.external_id}
                    type="button"
                    onClick={() => setSelected(j.external_id)}
                    className={`flex w-full items-start gap-3.5 rounded-[14px] border bg-white p-4 text-left ${
                      sel?.external_id === j.external_id ? "border-brand shadow-[inset_0_0_0_1px_var(--color-brand)]" : "border-line hover:border-brand"
                    }`}
                  >
                    <span className="flex size-[52px] flex-none items-center justify-center rounded-xl bg-chip font-mono text-[15px] font-medium text-brand-deep">{j.match}%</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[15px] font-semibold">{j.title}</span>
                      <span className="text-sm text-muted">
                        {j.company} · {j.city}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        {j.source} · {j.mode} {j.posted ? `· ${j.posted}` : ""}
                      </span>
                      {saved[j.external_id] && <span className="mt-1 self-start rounded-md bg-brand px-2 py-1 font-mono text-[11px] tracking-wider text-white">NO PIPELINE</span>}
                    </span>
                  </button>
                ))}
              </div>
              {sel && <JobDetail job={sel} appId={saved[sel.external_id]} saving={busy === "save"} onSave={() => save(sel)} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-[1_1_260px] flex-col gap-2">
      <h3 className="lbl m-0 text-base">{title}</h3>
      <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px] leading-relaxed">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function JobDetail({ job, appId, saving, onSave }: { job: StructuredJob; appId?: string; saving: boolean; onSave: () => void }) {
  const region = REGIONS.find((r) => r.id === job.region)?.label;
  return (
    <article className="card flex min-w-0 flex-[999_1_560px] flex-col gap-[22px] p-7">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs tracking-wider text-brand">VIA {job.source.toUpperCase()} · ESTRUTURADA PELA IA</span>
        <h2 className="font-display m-0 text-[32px] leading-[1.1] tracking-tight">{job.title}</h2>
        <p className="m-0 text-base">
          {job.company} · {job.city}
          {region ? ` (${region})` : ""} · {job.mode}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="rounded-lg bg-panel px-2.5 py-1.5 font-mono text-xs">Salário: {job.salary || "não divulgado"}</span>
          {job.posted && <span className="rounded-lg bg-panel px-2.5 py-1.5 font-mono text-xs">Publicada {job.posted}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="lbl">Aderência ao seu perfil</span>
          <span className="font-mono">{job.match}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F2]">
          <div className="h-2 rounded-full bg-brand" style={{ width: `${job.match}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {appId ? (
          <Link href={`/candidatura/${appId}`} className="btn">
            Abrir candidatura
          </Link>
        ) : (
          <button type="button" className="btn" disabled={saving} onClick={onSave}>
            {saving ? "Salvando…" : "Salvar e iniciar candidatura"}
          </button>
        )}
        {job.url && (
          <a className="btn-ghost" href={job.url} target="_blank" rel="noopener noreferrer">
            Ver vaga original ↗
          </a>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="lbl m-0 text-base">Resumo</h3>
        <p className="m-0 text-[15px] leading-relaxed">{job.summary}</p>
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-[22px]">
        <List title="Responsabilidades" items={job.resp} />
        <List title="Requisitos" items={job.req} />
        <List title="Diferenciais" items={job.dif} />
        <List title="Benefícios" items={job.benef} />
      </div>
      <div className="flex flex-wrap gap-4 rounded-[14px] border border-soft-line bg-soft p-5">
        <div className="flex flex-[1_1_240px] flex-col gap-2">
          <span className="font-mono text-xs tracking-wider text-brand-deep">LEITURA DA IA · ONDE VOCÊ BRILHA</span>
          <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px]">{job.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div className="flex flex-[1_1_240px] flex-col gap-2">
          <span className="font-mono text-xs tracking-wider text-warn-ink">ONDE VÃO TE APERTAR</span>
          <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px]">{job.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      </div>
    </article>
  );
}
