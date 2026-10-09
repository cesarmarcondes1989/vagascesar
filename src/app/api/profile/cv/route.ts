import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { extractCv } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um PDF" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "O arquivo precisa ser PDF" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF acima de 10 MB" }, { status: 400 });

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const { cv_text, skills } = await extractCv(base64);
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      cv_file_name: file.name,
      cv_text,
      extracted_skills: skills,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ fileName: file.name, skills });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
