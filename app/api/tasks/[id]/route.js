import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// نفس الأنواع اللي يقبلها القيد بالقاعدة (tasks_type_check) — بخلاف مسار
// الإضافة اليدوية، «درس» مسموح هنا لأن التعديل يصحّح مهام موجودة أصلاً
// (بما فيها المستخرجة من صورة بنوع «درس») لا يمنع إنشاءها.
const TASK_TYPES = new Set(["واجب", "حفظ", "اختبار", "مشروع", "درس"]);

async function verifyOwnership(sb, taskId, motherId) {
  const { data } = await sb.from("tasks").select("id, children(mother_id)").eq("id", taskId).single();
  return !!data && data.children?.mother_id === motherId;
}

export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  // تحديث جزئي: تعدّل الأم التاريخ فقط أحياناً (من TaskModal القديم) أو
  // المادة/النوع/التفاصيل كذلك (تعديل كامل) — كل حقل يُحدَّث فقط لو انبعث.
  const update = {};
  if ("dueDate" in body) update.due_date = body.dueDate || null;
  if ("subject" in body) {
    if (!body.subject?.trim()) return NextResponse.json({ error: "المادة مطلوبة" }, { status: 400 });
    update.subject = body.subject.trim();
  }
  if ("type" in body) {
    if (!TASK_TYPES.has(body.type)) return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
    update.type = body.type;
  }
  if ("details" in body) update.details = body.details?.trim() || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "لا يوجد شيء للتحديث" }, { status: 400 });

  const { error } = await sb.from("tasks").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, req.headers.get("x-mother-id")))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
