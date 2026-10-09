"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "Erro");
    window.location.href = "/";
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-12">
      <span className="font-display text-[40px] font-bold tracking-tight">
        RADAR<span className="text-warn">.</span>
      </span>
      <form onSubmit={submit} className="card flex flex-col gap-4">
        <label htmlFor="pw" className="lbl">
          Senha do app
        </label>
        <input id="pw" type="password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="m-0 text-sm text-warn-ink">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
