"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FLOW, QUICK_PROMPTS, STAGES, fmtDate, stageLabel } from "@/lib/constants";
import type { AppEvent, Application, ChatMessage, CvVersion, JobRow } from "@/lib/types";
import { normalizeCv } from "@/lib/normalize";

type Props = { app: Application; job: JobRow; events: AppEvent[]; chat: ChatMessage[]; cv: CvVersion | null };
type Tab = "cv" | "chat" | "status";

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function CandidaturaClient({ app: initialApp, job, events: initialEvents, chat: initialChat, cv: initialCv }: Props) {
  const router = useRouter();
  const [app, setApp] = useState(initialApp);
  const [events, setEvents] = useState(initialEvents);
  const [tab, setTab] = useState<Tab>(initialCv ? "cv" : "cv");
  const [error, setError] = useState("");

  const isRejected = app.stage === "reprovado";
  const reach = events.reduce((m, e) => Math.max(m, e.stage === "outra" ? 5 : FLOW.indexOf(e.stage as (typeof FLOW)[number])), -1);

  async function addEvent(body: { stage: string; customStage?: string; date?: string; note?: string; reason?: string }) {
    setError("");
    const res = await fetch(`/api/applications/${app.id}/events`, { method: "POST", body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Falha ao registrar");
      return false;
    }
    setEvents((e) => [...e, data.event]);
    setApp((a) => ({ ...a, stage: body.stage, custom_stage: data.event.custom_stage }));
    router.refresh();
    return true;
  }

  return (
    <section className="flex flex-col gap-[22px]">
      <div className="card flex flex-col gap-[18px] p-7 no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="eyebrow">CANDIDATURA</span>
            <h1 className="font-display m-0 text-4xl leading-[1.08] font-bold tracking-tight">{job.title}</h1>
            <p className="m-0 text-base">
              {job.company} · {job.city} · via {job.source} · aderência {job.match}%
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-brand px-3 py-2 font-mono text-[13px] text-white">{stageLabel(app.stage, app.custom_stage)}</span>
            {job.url && (
              <a className="btn" href={job.url} target="_blank" rel="noopener noreferrer">
                Me cadastrar na vaga ↗
              </a>
            )}
            {app.stage === "salva" && (
              <button type="button" className="btn-ghost" onClick={() => addEvent({ stage: "aplicada", date: today(), note: "Cadastro feito no site da vaga." })}>
                Já me cadastrei
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FLOW.map((id, i) => {
            const cls =
              i < reach
                ? "border-solid border-brand bg-soft text-brand"
                : i === reach
                  ? isRejected
                    ? "border-solid border-[#B5400A] bg-warn-soft text-warn-ink"
                    : "border-solid border-brand bg-brand text-white"
                  : "border-dashed border-[#AEBBD1] text-[#56647F]";
            return (
              <span key={id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium whitespace-nowrap ${cls}`}>
                <span className="font-mono text-[11px]">{String(i + 1).padStart(2, "0")}</span>
                {stageLabel(id)}
              </span>
            );
          })}
        </div>
        {isRejected && (
          <div className="rounded-xl bg-warn-soft px-4 py-3.5 text-[15px] text-warn-ink">
            Encerrada como reprovada. Os aprendizados estão em Status &amp; histórico.
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Seções da candidatura" className="flex flex-wrap gap-1 border-b border-line no-print">
        {(
          [
            ["cv", "CV sob medida"],
            ["chat", "Copiloto"],
            ["status", "Status & histórico"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 border-b-[3px] px-[18px] text-[15px] font-semibold ${tab === id ? "border-warn text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="m-0 rounded-xl bg-warn-paper p-3.5 text-sm text-warn-ink">{error}</p>}

      {tab === "cv" && <CvTab app={app} job={job} initial={initialCv} goChat={() => setTab("chat")} />}
      {tab === "chat" && <ChatTab app={app} job={job} initial={initialChat} onCvExtra={(extras) => setApp((a) => ({ ...a, cv_extras: extras }))} />}
      {tab === "status" && <StatusTab events={events} onAdd={addEvent} />}
    </section>
  );
}

/* ---------------- CV ---------------- */
function CvTab({ app, job, initial, goChat }: { app: Application; job: JobRow; initial: CvVersion | null; goChat: () => void }) {
  const [cv, setCv] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/applications/${app.id}/cv`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Falha ao gerar o CV");
    setCv({ ...data.version, content: normalizeCv(data.version.content) });
  }

  if (!cv) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <h2 className="font-display m-0 text-2xl">CV sob medida para {job.company}</h2>
        <p className="m-0 text-muted">A IA reescreve seu CV na linguagem desta vaga, com as palavras-chave que o ATS procura. Números que ela não sabe viram [colchetes].</p>
        {error && <p className="m-0 text-sm text-warn-ink">{error}</p>}
        <button type="button" className="btn" disabled={busy} onClick={generate}>
          {busy ? "Montando o CV…" : "Gerar CV sob medida"}
        </button>
      </div>
    );
  }

  const c = cv.content;
  const covered = c.keywords.filter((k) => k.inCv).length;
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="print-only-sheet flex min-w-0 flex-[999_1_600px] flex-col gap-[22px] rounded-md border border-line bg-white px-12 py-11">
        <div className="flex flex-col gap-1.5 border-b-2 border-brand pb-4">
          <span className="font-display text-[30px] font-bold">[Seu nome]</span>
          <span className="text-base font-semibold text-brand">{c.headline}</span>
          <span className="font-mono text-xs text-muted">[cidade] · [e-mail] · [linkedin]</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.08em]">RESUMO</span>
          <p className="m-0 text-[15px] leading-relaxed">{c.summary}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.08em]">COMPETÊNCIAS-CHAVE</span>
          <p className="m-0 text-[15px] leading-relaxed">{c.keywords.map((k) => k.t).join(" · ")}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-xs tracking-[0.08em]">CONQUISTAS PARA ESTA VAGA</span>
          <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px] leading-relaxed">
            {c.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
      <aside className="flex flex-[1_1_320px] flex-col gap-4 no-print">
        <div className="card flex flex-col gap-2.5">
          <span className="lbl">Cobertura de palavras-chave</span>
          <span className="font-display text-5xl leading-none font-bold">
            {covered}/{c.keywords.length}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {c.keywords.map((k) => (
              <span key={k.t} className={`kw ${k.inCv ? "" : "kw-ia"}`}>
                {k.t}
              </span>
            ))}
          </div>
          <span className="text-[13px] text-muted">Azul: já estava no seu CV. Laranja: a IA incluiu.</span>
        </div>
        <div className="card flex flex-col gap-2.5">
          <span className="lbl">O que só você preenche</span>
          <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-sm leading-relaxed text-muted">
            {c.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <span className="font-mono text-xs text-muted">{app.cv_extras.length} respostas do copiloto entram na próxima versão</span>
          {error && <p className="m-0 text-sm text-warn-ink">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={goChat}>
              Abrir copiloto
            </button>
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={generate}>
              {busy ? "Gerando…" : "Gerar nova versão"}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- Copiloto ---------------- */
function ChatTab({ app, job, initial, onCvExtra }: { app: Application; job: JobRow; initial: ChatMessage[]; onCvExtra: (e: string[]) => void }) {
  const [msgs, setMsgs] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extras, setExtras] = useState(app.cv_extras);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError("");
    setBusy(true);
    setDraft("");
    const res = await fetch(`/api/applications/${app.id}/chat`, { method: "POST", body: JSON.stringify({ message: t }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setDraft(t);
      return setError(data.error ?? "Falha no copiloto");
    }
    setMsgs((m) => [...m, ...data.messages]);
  }

  async function choose(m: ChatMessage, idx: number) {
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, chosen: idx } : x)));
    await fetch(`/api/applications/${app.id}/chat`, { method: "PATCH", body: JSON.stringify({ messageId: m.id, chosen: idx }) });
  }

  async function toCv(text: string) {
    const res = await fetch(`/api/applications/${app.id}/cv`, { method: "PATCH", body: JSON.stringify({ text }) });
    const data = await res.json();
    if (res.ok) {
      setExtras(data.extras);
      onCvExtra(data.extras);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="card flex min-w-0 flex-[999_1_600px] flex-col gap-4 p-5">
        <div className="flex max-h-[620px] flex-col gap-3.5 overflow-y-auto p-1">
          <div className="flex max-w-[92%] flex-col gap-2.5 self-start">
            <span className="font-mono text-[11px] tracking-[0.08em] text-brand">COPILOTO</span>
            <div className="rounded-[4px_16px_16px_16px] bg-panel px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">
              {`Bora preparar a candidatura pra ${job.company}. Eles vão cavar em “${job.req[0] ?? job.title}”.\nMe conta um resultado seu nessa linha, com número se tiver, ou cola uma pergunta do recrutador. Eu devolvo 3 versões.`}
            </div>
          </div>
          {msgs.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="max-w-[80%] self-end rounded-[16px_16px_4px_16px] bg-brand px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-white">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[92%] flex-col gap-2.5 self-start">
                <span className="font-mono text-[11px] tracking-[0.08em] text-brand">COPILOTO</span>
                <div className="rounded-[4px_16px_16px_16px] bg-panel px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">{m.content}</div>
                {(m.options ?? []).map((o, i) => {
                  const chosen = m.chosen === i;
                  const inCv = extras.includes(o.text);
                  return (
                    <div key={i} className={`flex flex-col gap-2.5 rounded-xl border p-3.5 ${chosen ? "border-brand bg-soft shadow-[inset_0_0_0_1px_var(--color-brand)]" : "border-line bg-[#FAFBFD]"}`}>
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="font-mono text-xs tracking-wider">{o.label}</span>
                        {chosen && <span className="font-mono text-[11px] text-brand-deep">ESCOLHIDA</span>}
                      </div>
                      <p className="m-0 text-[15px] leading-relaxed">{o.text}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-ghost btn-sm" onClick={() => choose(m, i)}>
                          Essa é a minha
                        </button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(o.text)}>
                          Copiar
                        </button>
                        {o.cv && (
                          <button type="button" className="btn-ghost btn-sm" disabled={inCv} onClick={() => toCv(o.text)}>
                            {inCv ? "Já está no CV" : "Mandar pro CV"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ),
          )}
          {busy && <span className="font-mono text-xs text-muted">copiloto pensando…</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((q) => (
            <button key={q} type="button" className="chip" disabled={busy} onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
        {error && <p className="m-0 text-sm text-warn-ink">{error}</p>}
        <div className="flex flex-wrap gap-2.5">
          <input
            className="field flex-[1_1_320px]"
            aria-label="Mensagem para o copiloto"
            placeholder="Conta um resultado, cola uma pergunta do recrutador…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), send(draft))}
          />
          <button type="button" className="btn" disabled={busy} onClick={() => send(draft)}>
            Enviar
          </button>
        </div>
      </div>
      <aside className="card flex flex-[1_1_300px] flex-col gap-3.5">
        <span className="lbl">O que o copiloto está levando em conta</span>
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs tracking-wider text-brand">REQUISITOS DA VAGA</span>
          <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-sm">{job.req.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs tracking-wider text-warn-ink">ONDE VÃO TE APERTAR</span>
          <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-sm">{job.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <span className="font-mono text-xs text-muted">+ seu CV · + fase da candidatura · {extras.length} respostas já no CV</span>
      </aside>
    </div>
  );
}

/* ---------------- Status ---------------- */
function StatusTab({ events, onAdd }: { events: AppEvent[]; onAdd: (b: { stage: string; customStage?: string; date?: string; note?: string; reason?: string }) => Promise<boolean> }) {
  const [stage, setStage] = useState<string>("triagem");
  const [customStage, setCustomStage] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const ok = await onAdd({ stage, customStage, date, note, reason });
    setBusy(false);
    if (ok) {
      setNote("");
      setReason("");
      setCustomStage("");
    }
  }

  const timeline = [...events].reverse();
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="card flex flex-[1_1_400px] flex-col gap-[18px]">
        <h2 className="font-display m-0 text-[22px]">Registrar atualização</h2>
        <div className="flex flex-col gap-2.5">
          <span className="lbl">Fase</span>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button key={s.id} type="button" aria-pressed={stage === s.id} className={`chip ${stage === s.id ? "chip-on" : ""}`} onClick={() => setStage(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {stage === "outra" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="customStage" className="lbl">
              Nome da fase
            </label>
            <input id="customStage" className="field" placeholder="Ex.: Fase 3 · dinâmica com diretores" value={customStage} onChange={(e) => setCustomStage(e.target.value)} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="dt" className="lbl">
            Data
          </label>
          <input id="dt" type="date" className="field max-w-[220px]" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="note" className="lbl">
            O que aconteceu?
          </label>
          <textarea id="note" rows={3} className="field" placeholder="Quem estava, o que perguntaram, como você saiu." value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {stage === "reprovado" && (
          <div className="flex flex-col gap-2 rounded-xl border border-[#F5C7AE] bg-warn-paper p-4">
            <label htmlFor="reason" className="lbl">
              Justificativa da reprovação
            </label>
            <textarea
              id="reason"
              rows={3}
              className="field"
              placeholder="O que disseram, ou o que você acha que pesou. Seja honesto: isso é pra você."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <span className="text-[13px] text-warn-ink">A IA transforma isso em ajustes concretos para a próxima.</span>
          </div>
        )}
        <button type="button" className="btn self-start" disabled={busy} onClick={submit}>
          {busy ? (stage === "reprovado" ? "Gerando aprendizados…" : "Registrando…") : "Registrar"}
        </button>
      </div>
      <div className="card flex min-w-0 flex-[999_1_520px] flex-col gap-[18px]">
        <h2 className="font-display m-0 text-[22px]">Histórico</h2>
        {timeline.map((t) => (
          <div key={t.id} className="flex items-start gap-3.5 border-b border-[#E2E8F2] pb-4">
            <span className={`mt-[5px] size-3 flex-none rounded-full ${t.stage === "reprovado" ? "bg-warn" : t.stage === "aprovado" ? "bg-brand-deep" : "bg-brand"}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[15px]">
                <span className="font-mono text-[13px] text-muted">{fmtDate(t.event_date)}</span> · <strong>{stageLabel(t.stage, t.custom_stage)}</strong>
              </span>
              {t.note && <span className="text-sm leading-relaxed text-muted">{t.note}</span>}
              {t.reason && (
                <div className="rounded-[10px] bg-warn-paper px-3.5 py-3 text-sm leading-relaxed">
                  <span className="block font-mono text-[11px] tracking-wider text-warn-ink">JUSTIFICATIVA</span>
                  {t.reason}
                </div>
              )}
              {t.lessons && t.lessons.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-[10px] bg-soft px-3.5 py-3">
                  <span className="font-mono text-[11px] tracking-wider text-brand-deep">APRENDIZADOS DA IA PRA PRÓXIMA</span>
                  <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-sm">
                    {t.lessons.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
