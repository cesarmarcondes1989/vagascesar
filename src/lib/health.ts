import { createClient } from "@supabase/supabase-js";
import { OWNER_ID } from "./supabase/server";

/** Detects the usual setup mistakes and returns human-readable problems (pt-BR). */
export async function checkSetup(): Promise<string[]> {
  const problems: string[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) problems.push("Falta NEXT_PUBLIC_SUPABASE_URL na Vercel.");
  if (!key) problems.push("Falta SUPABASE_SERVICE_ROLE_KEY na Vercel (a chave secreta service_role do Supabase).");
  if (!process.env.ANTHROPIC_API_KEY) problems.push("Falta ANTHROPIC_API_KEY na Vercel: a IA não vai funcionar.");
  if (!url || !key) return problems;

  if (key.startsWith("sb_publishable_") || jwtRole(key) === "anon") {
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY está com a chave PÚBLICA (anon/publishable). Troque pela chave secreta: Supabase → Project Settings → API Keys → service_role / secret.",
    );
    return problems;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const probe = await db.from("profiles").select("user_id, last_search").limit(1);
  if (probe.error) {
    if (/last_search/.test(probe.error.message)) {
      problems.push("Rode a migration supabase/migrations/0003_salvar_tudo.sql no SQL Editor do Supabase.");
    } else if (/relation .* does not exist|Could not find the table/i.test(probe.error.message)) {
      problems.push("As tabelas não existem: rode 0001_init.sql e 0003_salvar_tudo.sql no SQL Editor do Supabase.");
    } else {
      problems.push(`Supabase recusou a leitura: ${probe.error.message}`);
    }
    return problems;
  }

  const write = await db.from("profiles").upsert({ user_id: OWNER_ID, updated_at: new Date().toISOString() });
  if (write.error) {
    if (/foreign key/i.test(write.error.message)) {
      problems.push("O banco ainda exige login: rode supabase/migrations/0003_salvar_tudo.sql no SQL Editor do Supabase.");
    } else {
      problems.push(`Supabase recusou a gravação: ${write.error.message}`);
    }
  }
  return problems;
}

function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return payload.role ?? null;
  } catch {
    return null;
  }
}
