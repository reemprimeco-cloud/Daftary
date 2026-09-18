import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function verifyOwnership(sb, id, motherId) {
  const { data } = await sb.from("requirements").select("id, children(mother_id)").eq("id", id).single();
  return !!data && data.children?.mother_id === motherId;
}

export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const update = {};
  if ("item" in body) {
    if (!body.item?.trim()) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    update.item = body.item.trim();
  }
  if ("dueDate" in body) update.due_date = body.dueDate || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "لا يوجد شيء للتحديث" }, { status: 400 });
  // تعديل الأم يتقدّم على إعادة القراءة (lib/planApply.js).
  update.edited_by_user = true;

  const { error } = await sb.from("requirements").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  const { data: existing } = await sb.from("requirements").select("id, children(mother_id)").eq("id", params.id).single();
  if (!existing || existing.children?.mother_id !== req.headers.get("x-mother-id")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("requirements").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
