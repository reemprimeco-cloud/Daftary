import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// حذف الحساب نهائياً مع كل البيانات المرتبطة به.
// مطلوب من آبل لأي تطبيق يسمح بإنشاء حساب (App Store Review Guideline 5.1.1(v)).
// نمسح الأبناء وكل بياناتهم أولاً، ثم اشتراكات الإشعارات وسجل التذكيرات، وأخيراً حساب ولي الأمر.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { motherId, phone } = body;
  if (!motherId || !phone) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();

  // نتحقق من تطابق رقم الجوال مع الحساب قبل الحذف — طبقة أمان إضافية
  // حتى لا يُحذف حساب بمجرد معرفة معرّفه.
  const { data: mother, error: mErr } = await sb
    .from("mothers")
    .select("id, phone")
    .eq("id", motherId)
    .single();
  if (mErr || !mother) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });

  const normalize = (v) => (v || "").replace(/[^0-9]/g, "").slice(-8);
  if (normalize(mother.phone) !== normalize(phone)) {
    return NextResponse.json({ error: "رقم الجوال غير مطابق للحساب" }, { status: 403 });
  }

  const { data: children } = await sb.from("children").select("id").eq("mother_id", motherId);
  const childIds = (children || []).map((c) => c.id);

  if (childIds.length) {
    for (const table of ["tasks", "requirements", "class_schedule", "memorization", "exam_grades", "ai_messages"]) {
      const { error } = await sb.from(table).delete().in("child_id", childIds);
      if (error) return NextResponse.json({ error: `فشل حذف ${table}: ${error.message}` }, { status: 400 });
    }
    const { error: chErr } = await sb.from("children").delete().eq("mother_id", motherId);
    if (chErr) return NextResponse.json({ error: `فشل حذف الأبناء: ${chErr.message}` }, { status: 400 });
  }

  for (const table of ["push_subscriptions", "reminder_log"]) {
    const { error } = await sb.from(table).delete().eq("mother_id", motherId);
    if (error) return NextResponse.json({ error: `فشل حذف ${table}: ${error.message}` }, { status: 400 });
  }

  const { error: delErr } = await sb.from("mothers").delete().eq("id", motherId);
  if (delErr) return NextResponse.json({ error: `فشل حذف الحساب: ${delErr.message}` }, { status: 400 });

  return NextResponse.json({ ok: true });
}
