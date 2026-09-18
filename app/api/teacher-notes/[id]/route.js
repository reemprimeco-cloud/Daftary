import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { rowInFamily } from "@/lib/family";

export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (!(await rowInFamily(sb, "teacher_notes", params.id, req.headers.get("x-mother-id")))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const update = {};
  if ("subject" in body) {
    if (!body.subject?.trim()) return NextResponse.json({ error: "المادة مطلوبة" }, { status: 400 });
    update.subject = body.subject.trim();
  }
  if ("note" in body) {
    if (!body.note?.trim()) return NextResponse.json({ error: "الملاحظة مطلوبة" }, { status: 400 });
    update.note = body.note.trim();
  }
  if ("term" in body) update.term = body.term?.trim() || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "لا يوجد شيء للتحديث" }, { status: 400 });

  const { error } = await sb.from("teacher_notes").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const sb = supabaseAdmin();

  if (!(await rowInFamily(sb, "teacher_notes", params.id, req.headers.get("x-mother-id")))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("teacher_notes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
