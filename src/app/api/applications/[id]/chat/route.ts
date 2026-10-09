import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { copilot } from "@/lib/ai";
import { getApplicationWithJob, getProfile } from "@/lib/server-data";
import { stageLabel } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  const { supabase, user } = auth;
  const { id } = await ctx.params;
  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  const found = await getApplicationWithJob(supabase, id);
  if (!found) return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });

  try {
    const profile = await getProfile(supabase, user.id);
    const { data: hist } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("application_id", id)
      .order("created_at")
      .limit(30);
    const reply = await copilot(
      profile ?? {},
      found.job,
      stageLabel(found.app.stage, found.app.custom_stage),
      (hist ?? []) as { role: "user" | "assistant"; content: string }[],
      message.trim(),
    );
    // Explicit timestamps: both rows in one insert would otherwise share now() and lose their order.
    const t0 = Date.now();
    const { data, error } = await supabase
      .from("chat_messages")
      .insert([
        { user_id: user.id, application_id: id, role: "user", content: message.trim(), created_at: new Date(t0).toISOString() },
        {
          user_id: user.id, application_id: id, role: "assistant", content: reply.text, options: reply.options,
          created_at: new Date(t0 + 1).toISOString(),
        },
      ])
      .select("*");
    if (error) throw new Error(error.message);
    const sorted = (data as ChatMessage[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
    return NextResponse.json({ messages: sorted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Marks which of the 3 options the person picked. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  const { supabase } = auth;
  const { id } = await ctx.params;
  const { messageId, chosen } = (await req.json()) as { messageId: string; chosen: number };
  const { error } = await supabase.from("chat_messages").update({ chosen }).eq("id", messageId).eq("application_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
