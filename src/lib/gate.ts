/** Optional password gate (no e-mail). Enabled only when APP_PASSWORD is set. */
export const GATE_COOKIE = "radar_gate";

export async function gateToken(password: string) {
  const data = new TextEncoder().encode(`radar:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
