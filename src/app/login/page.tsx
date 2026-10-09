"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ email }) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao enviar o link");
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-12">
      <span className="font-display text-[40px] font-bold tracking-tight">
        RADAR<span className="text-warn">.</span>
      </span>
      <p className="text-lg text-muted">Pare de mandar currículo no escuro.</p>
      {!configured && (
        <div className="rounded-xl border border-warn bg-warn-paper p-4 text-sm text-warn-ink">
          Variáveis do Supabase não configuradas. Veja o README: seção “Variáveis de ambiente”.
        </div>
      )}
      {state === "sent" ? (
        <div className="card">
          <p className="m-0 text-[15px]">
            Link enviado para <strong>{email}</strong>. Abra no mesmo navegador.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="card flex flex-col gap-4">
          <label htmlFor="email" className="lbl">
            Seu e-mail
          </label>
          <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="m-0 text-sm text-warn-ink">{error}</p>}
          <button className="btn" disabled={state === "sending" || !configured}>
            {state === "sending" ? "Enviando…" : "Receber link de acesso"}
          </button>
        </form>
      )}
    </div>
  );
}
