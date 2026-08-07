import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();
  const { data: existing, error: e1 } = await sb
    .from("requirements")
    .select("bought, children(mother_id)")
    .eq("id", params.id)
    .single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
  if (existing.children?.mother_id !== body.motherId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("requirements").update({ bought: !existing.bought }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
