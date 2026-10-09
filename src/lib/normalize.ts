import type { ChatOption, CvContent } from "./types";

/**
 * The model sometimes returns arrays as a JSON-encoded string ("[\"a\",\"b\"]") or as a
 * bulleted text block. Everything the AI returns goes through these before use or display.
 */
export function toStrArr(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? (Object.values(x).find((y) => typeof y === "string") ?? "") : String(x ?? "")))
      .map((s) => String(s).trim())
      .filter(Boolean);
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        return toStrArr(JSON.parse(t));
      } catch {
        /* fall through to line split */
      }
    }
    return t
      .split(/\n+|(?:^|\s)[•·▪-]\s+|;\s*/)
      .map((s) => s.replace(/^\s*(?:[-*•·▪]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

export function toStr(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v == null) return fallback;
  if (Array.isArray(v)) return toStrArr(v).join(" ");
  return String(v);
}

export function toInt(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

function toBool(v: unknown) {
  return v === true || v === "true";
}

function toObjArr(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      return toObjArr(JSON.parse(v));
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeCv(raw: unknown): CvContent {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let keywords = toObjArr(c.keywords).map((k) => ({ t: toStr(k.t ?? k.term ?? k.keyword), inCv: toBool(k.inCv ?? k.in_cv) }));
  if (!keywords.length) keywords = toStrArr(c.keywords).map((t) => ({ t, inCv: false }));
  return {
    headline: toStr(c.headline),
    summary: toStr(c.summary),
    keywords: keywords.filter((k) => k.t),
    bullets: toStrArr(c.bullets),
    notes: toStrArr(c.notes),
  };
}

export function normalizeOptions(v: unknown): ChatOption[] {
  return toObjArr(v)
    .map((o) => ({ label: toStr(o.label, "OPÇÃO"), text: toStr(o.text), cv: toBool(o.cv) }))
    .filter((o) => o.text);
}
