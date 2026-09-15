import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// «تم» كانت تؤرشف الواجب فيختفي نهائياً. مع قائمة الإنجاز (الخطة الأسبوعية
// كـchecklist) صار الواجب المنجز يبقى ظاهراً بعلامة ✓ ويدخل بنسبة الإنجاز،
// ويمكن التراجع عنه — فالحالة done/active بدل الأرشفة. done: false يرجّعه.
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const done = body.done !== false;
  const sb = supabaseAdmin();

  const { data: existing } = await sb.from("tasks").select("id, children(mother_id)").eq("id", params.id).single();
  if (!existing || existing.children?.mother_id !== req.headers.get("x-mother-id")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("tasks").update({ status: done ? "done" : "active" }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, status: done ? "done" : "active" });
}
