import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { rowInFamily } from "@/lib/family";

// نفس القيد بالقاعدة (memorization_kind_check)
const KIND_VALUES = new Set(["آية", "حديث"]);

async function verifyOwnership(sb, id, motherId) {
  return rowInFamily(sb, "memorization", id, motherId);
}

export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const update = {};
  if ("kind" in body) {
    if (!KIND_VALUES.has(body.kind)) return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
    update.kind = body.kind;
  }
  if ("reference" in body) {
    if (!body.reference?.trim()) return NextResponse.json({ error: "المرجع مطلوب" }, { status: 400 });
    update.reference = body.reference.trim();
  }
  if ("details" in body) update.details = body.details?.trim() || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "لا يوجد شيء للتحديث" }, { status: 400 });
  // تعديل الأم يتقدّم على إعادة القراءة (lib/planApply.js).
  update.edited_by_user = true;

  const { error } = await sb.from("memorization").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (!(await rowInFamily(sb, "memorization", params.id, req.headers.get("x-mother-id")))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("memorization").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
