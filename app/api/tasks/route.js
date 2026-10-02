import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logFamilyAction } from "@/lib/family";
import { childInFamily } from "@/lib/family";

// نفس الأنواع اللي يقبلها القيد بالقاعدة (tasks_type_check)، بلا «درس» —
// محتوى المنهج يُستخرج من الصور فقط ولا يُضاف يدوياً.
const TASK_TYPES = new Set(["واجب", "حفظ", "اختبار", "مشروع"]);

// إضافة واجب أو اختبار يدوياً بلا رفع صورة — يدخل بنفس جدول tasks اللي
// يقرأه كرون التذكيرات (قبل الموعد بيوم ويوم الموعد) وتُرتّبه الخطة
// الأسبوعية حسب الطالب/ة وتاريخ الاستحقاق تلقائياً، بلا أي فرق عن الواجب
// المستخرج من صورة.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { childId, subject, type, dueDate, details } = body;
  const motherId = req.headers.get("x-mother-id");
  if (!motherId || !childId || !subject?.trim() || !dueDate || !TASK_TYPES.has(type)) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId, "id");
  if (!child) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { data, error } = await sb
    .from("tasks")
    .insert({
      child_id: childId,
      subject: subject.trim(),
      type,
      due_date: dueDate,
      details: details?.trim() || null,
      status: "active",
      source: "manual",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logFamilyAction(sb, motherId, "أضاف واجباً يدوياً", `${subject.trim()} (${type})`);
  return NextResponse.json({ task: data });
}
