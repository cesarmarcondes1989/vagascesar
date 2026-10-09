import { checkSetup } from "@/lib/health";

/** Shown on every screen while the setup has problems (missing env, migration not run, wrong key). */
export async function SetupBanner() {
  let problems: string[] = [];
  try {
    problems = await checkSetup();
  } catch (e) {
    problems = [`Não consegui checar a configuração: ${(e as Error).message}`];
  }
  if (problems.length === 0) return null;
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 md:px-6">
      <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-warn bg-warn-paper p-5 text-warn-ink">
        <strong className="font-display text-lg">Configuração incompleta: nada vai ser salvo até corrigir</strong>
        <ul className="m-0 flex flex-col gap-1 pl-5 text-[15px]">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
