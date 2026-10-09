"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", n: "★", label: "Minhas vagas" },
  { href: "/perfil", n: "1", label: "Perfil" },
  { href: "/buscar", n: "2", label: "Buscar vagas" },
];

export function Header({ gated }: { gated: boolean }) {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/candidatura") : path.startsWith(href));

  return (
    <header className="bg-brand-deep text-ground">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-7 gap-y-3 px-4 py-4 md:px-6">
        <Link href="/" className="flex flex-wrap items-baseline gap-3.5 text-ground no-underline">
          <span className="font-display text-[28px] font-bold tracking-tight">
            RADAR<span className="text-[#FF7A45]">.</span>
          </span>
          <span className="text-sm text-[#C9D6F2]">Pare de mandar currículo no escuro.</span>
        </Link>
        <nav aria-label="Navegação" className="flex flex-1 flex-wrap gap-1.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
                active(n.href) ? "border-ground bg-ground text-ink" : "border-[#4B6BC0] text-[#DCE6FA] hover:border-[#DCE6FA]"
              }`}
            >
              <span className="font-mono text-xs opacity-80">{n.n}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        {gated && (
          <button
            type="button"
            className="font-mono text-xs text-[#C9D6F2] underline-offset-4 hover:underline"
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              window.location.href = "/login";
            }}
          >
            sair
          </button>
        )}
      </div>
    </header>
  );
}
