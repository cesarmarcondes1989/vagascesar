"use client";

import { useEffect, useState } from "react";

export type ProgressStep = { pct: number; step: string; detail: string };

/** Live progress panel: % bar, current step, elapsed time and the steps already done. */
export function SearchProgress({ current, history, startedAt }: { current: ProgressStep | null; history: ProgressStep[]; startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pct = current?.pct ?? 0;
  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));
  const sinceLast = current ? null : elapsed;

  // Keep only the last state of each step name, so the list shows stages, not every tick.
  const stages: ProgressStep[] = [];
  for (const h of history) {
    const name = h.step.replace(/\s*\(\d+\/\d+.*\)$/, "");
    const prev = stages.findIndex((s) => s.step.replace(/\s*\(\d+\/\d+.*\)$/, "") === name);
    if (prev >= 0) stages[prev] = h;
    else stages.push(h);
  }

  return (
    <div role="status" aria-live="polite" className="card flex flex-col gap-4 border-brand">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-display text-xl font-bold">{current?.step ?? "Começando…"}</span>
        <span className="font-mono text-sm text-muted">
          {pct}% · {elapsed}s
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#E2E8F2]" aria-hidden="true">
        <div className="relative h-3 rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${Math.max(pct, 3)}%` }}>
          <span className="absolute inset-0 animate-pulse rounded-full bg-white/25" />
        </div>
      </div>
      {current?.detail && <span className="text-sm text-muted">{current.detail}</span>}
      {sinceLast !== null && sinceLast > 5 && <span className="text-sm text-muted">Conectando ao servidor…</span>}
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              {isLast ? (
                <span className="mt-1 size-3 flex-none animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />
              ) : (
                <span className="mt-0.5 flex size-4 flex-none items-center justify-center rounded-full bg-brand text-[10px] text-white" aria-hidden="true">
                  ✓
                </span>
              )}
              <span className={isLast ? "text-ink" : "text-muted"}>{s.step.replace(/\s*\(\d+\/\d+.*\)$/, "")}</span>
            </li>
          );
        })}
      </ol>
      <span className="font-mono text-xs text-muted">A leitura da IA é a parte mais demorada: cerca de 20 a 60 segundos, dependendo de quantas vagas vierem.</span>
    </div>
  );
}
