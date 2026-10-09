"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVELS } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export function PerfilClient({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cvFile, setCvFile] = useState(profile?.cv_file_name ?? "");
  const [skills, setSkills] = useState<string[]>(profile?.extracted_skills ?? []);
  const [desc, setDesc] = useState(profile?.description ?? "");
  const [levels, setLevels] = useState<string[]>(profile?.levels?.length ? profile.levels : ["Head", "Diretoria"]);
  const [busy, setBusy] = useState<"" | "cv" | "roles">("");
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; msg?: string }>(
    profile?.description ? { kind: "saved", msg: "Perfil salvo" } : { kind: "idle" },
  );
  const firstRender = useRef(true);

  // Autosave: description and seniority are saved ~1s after you stop typing.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState({ kind: "saving" });
    const t = setTimeout(async () => {
      const res = await fetch("/api/profile", { method: "PUT", body: JSON.stringify({ description: desc, levels }) });
      if (res.ok) {
        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setSaveState({ kind: "saved", msg: `Salvo às ${time}` });
      } else {
        setSaveState({ kind: "error", msg: (await res.json()).error ?? "Falha ao salvar" });
      }
    }, 900);
    return () => clearTimeout(t);
  }, [desc, levels]);

  async function upload(file: File) {
    setError("");
    setBusy("cv");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/profile/cv", { method: "POST", body: fd });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setError(data.error ?? "Falha ao ler o PDF");
    setCvFile(data.fileName);
    setSkills(data.skills);
  }

  async function generate() {
    setError("");
    setBusy("roles");
    const save = await fetch("/api/profile", { method: "PUT", body: JSON.stringify({ description: desc, levels }) });
    if (!save.ok) {
      setBusy("");
      return setError((await save.json()).error ?? "Falha ao salvar o perfil");
    }
    const res = await fetch("/api/roles", { method: "POST" });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setError(data.error ?? "Falha ao gerar cargos");
    router.push("/buscar");
  }

  const toggleLevel = (l: string) => setLevels((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  return (
    <section className="flex flex-col gap-7">
      <div className="flex max-w-[780px] flex-col gap-2.5">
        <span className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">ETAPA 1 · PERFIL</span>
          <span
            role="status"
            className={`font-mono text-xs ${saveState.kind === "error" ? "text-warn-ink" : "text-muted"}`}
          >
            {saveState.kind === "saving" ? "salvando…" : saveState.msg ?? ""}
          </span>
        </span>
        <h1 className="h1 m-0">Quem você é, numa tela só. O resto é trabalho da IA.</h1>
        <p className="m-0 text-[17px] leading-relaxed text-muted">
          Suba o CV, descreva em texto livre, ou os dois. A IA cruza tudo e propõe cargos, inclusive alguns que você não teria buscado sozinho.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-5">
        <div className="card flex flex-[1_1_340px] flex-col gap-4">
          <h2 className="font-display m-0 text-xl">CV atual (PDF)</h2>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            aria-label="Escolher PDF do CV"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          {!cvFile ? (
            <div
              className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-3.5 rounded-[14px] border-2 border-dashed border-[#AEBBD1] p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) upload(f);
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-brand" aria-hidden="true">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
                <path d="M12 17v-6" />
                <path d="M9.5 13.5 12 11l2.5 2.5" />
              </svg>
              <span className="text-[15px]">{busy === "cv" ? "A IA está lendo seu CV…" : "Arraste o PDF aqui"}</span>
              <button type="button" className="btn-ghost btn-sm" disabled={busy === "cv"} onClick={() => fileRef.current?.click()}>
                Escolher arquivo
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-soft-line bg-soft p-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-mono text-sm">{cvFile}</span>
                  <span className="text-[13px] text-muted">{busy === "cv" ? "Lendo…" : "Lido pela IA · competências abaixo"}</span>
                </div>
                <button type="button" className="btn-ghost btn-sm" disabled={busy === "cv"} onClick={() => fileRef.current?.click()}>
                  Trocar
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="lbl">O que a IA tirou do seu CV</span>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <span key={s} className="kw">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card flex flex-[999_1_560px] flex-col gap-[18px]">
          <h2 className="font-display m-0 text-xl">Em texto livre</h2>
          <div className="flex flex-col gap-2">
            <label htmlFor="desc" className="lbl">
              Descreva você, o que quer e o que não aceita mais
            </label>
            <textarea id="desc" rows={6} className="field" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <span className="text-[13px] text-muted">Dica: diga o que te cansa no cargo atual. A IA usa isso para filtrar, não só o que você sabe fazer.</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="lbl">Senioridade alvo</span>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button key={l} type="button" aria-pressed={levels.includes(l)} className={`chip ${levels.includes(l) ? "chip-on" : ""}`} onClick={() => toggleLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="m-0 rounded-xl bg-warn-paper p-3.5 text-sm text-warn-ink">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn" disabled={!!busy || (!desc.trim() && !cvFile)} onClick={generate}>
          {busy === "roles" ? "Lendo seu perfil…" : "Salvar e gerar cargos com IA →"}
        </button>
        <span className="font-mono text-[13px] text-muted">usa: CV + texto + senioridade → propõe cargos</span>
      </div>
    </section>
  );
}
