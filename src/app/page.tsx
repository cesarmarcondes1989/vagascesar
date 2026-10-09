import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { COLS, fmtDate, stageLabel } from "@/lib/constants";
import type { AppEvent, Application, JobRow } from "@/lib/types";
import { toStrArr } from "@/lib/normalize";

export const dynamic = "force-dynamic";

export default async function MinhasVagas() {
  const supabase = await supabaseServer();
  const [{ data: apps }, { data: jobs }, { data: events }] = await Promise.all([
    supabase.from("applications").select("*").order("updated_at", { ascending: false }),
    supabase.from("jobs").select("id,title,company,city,source,match"),
    supabase.from("application_events").select("*").order("event_date", { ascending: false }),
  ]);

  const jobById = new Map(((jobs ?? []) as JobRow[]).map((j) => [j.id, j]));
  const evs = (events ?? []) as AppEvent[];
  const lastEvent = (appId: string) => evs.find((e) => e.application_id === appId);
  const list = ((apps ?? []) as Application[]).map((a) => ({ app: a, job: jobById.get(a.job_id), last: lastEvent(a.id) }));

  const reps = list.filter((x) => x.app.stage === "reprovado");
  const alive = list.filter((x) => x.app.stage !== "reprovado" && x.app.stage !== "aprovado").length;
  const rejections = reps.map((x) => ({ ...x, ev: evs.find((e) => e.application_id === x.app.id && e.stage === "reprovado") }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="eyebrow">MINHAS VAGAS · INSCRITAS E EM ANDAMENTO</span>
          <h1 className="h1 m-0">
            {alive} {alive === 1 ? "candidatura viva" : "candidaturas vivas"} · {reps.length}{" "}
            {reps.length === 1 ? "lição registrada" : "lições registradas"}
          </h1>
        </div>
        <Link href="/buscar" className="btn">
          Buscar novas vagas →
        </Link>
      </div>

      {list.length === 0 && (
        <div className="card flex flex-col items-start gap-3">
          <h2 className="font-display m-0 text-2xl">Nenhuma vaga ainda.</h2>
          <p className="m-0 text-muted">Comece pelo perfil: suba o CV e a IA sugere os cargos para buscar.</p>
          <Link href="/perfil" className="btn">
            Montar meu perfil
          </Link>
        </div>
      )}

      {list.length > 0 && (
        <div className="overflow-x-auto pb-1.5">
          <div className="grid grid-cols-[repeat(5,minmax(220px,1fr))] gap-3">
            {COLS.map((c) => {
              const items = list.filter((x) => (c.stages as string[]).includes(x.app.stage));
              return (
                <div key={c.label} className="flex min-h-[260px] flex-col gap-2.5 rounded-[14px] bg-[#E5EBF5] p-3">
                  <div className="flex items-center justify-between px-1 pt-1 pb-1.5">
                    <span className="lbl">{c.label}</span>
                    <span className="font-mono text-[13px]">{items.length}</span>
                  </div>
                  {items.map(({ app, job, last }) => (
                    <Link
                      key={app.id}
                      href={`/candidatura/${app.id}`}
                      className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-white p-3.5 text-ink no-underline hover:border-brand"
                    >
                      <span className="text-sm font-semibold">{job?.title}</span>
                      <span className="text-[13px] text-muted">
                        {job?.company} · {job?.city}
                      </span>
                      <span className="font-mono text-xs text-brand">
                        {stageLabel(app.stage, app.custom_stage)} · {fmtDate(last?.event_date)}
                      </span>
                    </Link>
                  ))}
                  {items.length === 0 && <span className="p-1 text-[13px] text-muted">vazio</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card flex flex-col gap-4">
        <h2 className="font-display m-0 text-[22px]">O que as reprovações estão te dizendo</h2>
        <p className="m-0 max-w-[860px] text-[15px] leading-relaxed text-muted">
          {rejections.length === 0
            ? "Nenhuma reprovação registrada ainda. Quando vier, registre a justificativa: é o dado mais valioso do sistema."
            : "Cada justificativa vira aprendizado. Releia antes de aplicar em vagas parecidas."}
        </p>
        {rejections.map(({ app, job, ev }) => (
          <div key={app.id} className="flex flex-wrap gap-4 border-t border-[#E2E8F2] pt-3.5">
            <div className="flex flex-[1_1_260px] flex-col gap-1.5">
              <Link href={`/candidatura/${app.id}`} className="font-semibold text-ink">
                {job?.title} · {job?.company}
              </Link>
              <span className="text-sm leading-relaxed text-warn-ink">{ev?.reason || "Sem justificativa registrada."}</span>
            </div>
            <ul className="m-0 flex flex-[2_1_360px] flex-col gap-1.5 pl-[18px] text-sm leading-relaxed">
              {toStrArr(ev?.lessons).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
