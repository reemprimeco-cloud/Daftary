import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();
  const { data: existing, error: e1 } = await sb
    .from("memorization")
    .select("done, children(mother_id)")
    .eq("id", params.id)
    .single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
  if (existing.children?.mother_id !== req.headers.get("x-mother-id")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const done = !existing.done;
  const { error } = await sb.from("memorization").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
