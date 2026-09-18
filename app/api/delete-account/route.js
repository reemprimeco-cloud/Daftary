import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// حذف الحساب نهائياً مع كل البيانات المرتبطة به.
// مطلوب من آبل لأي تطبيق يسمح بإنشاء حساب (App Store Review Guideline 5.1.1(v)).
// نمسح الأبناء وكل بياناتهم أولاً، ثم اشتراكات الإشعارات وسجل التذكيرات، وأخيراً حساب ولي الأمر.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { phone } = body;
  // المعرّف من الجلسة الموثوقة، مو من العميل — أخطر مسار بالتطبيق
  const motherId = req.headers.get("x-mother-id");
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

  // بعائلة فيها وليّا أمر، الحذف يختلف حسب الدور:
  // - ولي الأمر الثاني يحذف حسابه هو فقط ويطلع من العائلة؛ أبناء العائلة
  //   وبياناتهم تبقى لصاحب الاشتراك. أي طالب/ة أضافه هو يُنقل للأساسي حتى
  //   ما يضيع بحذف حسابه.
  // - ولي الأمر الأساسي يحذف بيانات العائلة كلها، ويُفصل الثاني لعائلة
  //   فاضية خاصة فيه (حسابه يبقى شغالاً بلا بيانات، وما يوصل شي بعدها).
  const { data: me } = await sb.from("mothers").select("family_id, family_role").eq("id", motherId).maybeSingle();
  const familyId = me?.family_id;
  const isSecondary = me?.family_role === "secondary";

  if (isSecondary) {
    const { data: primary } = await sb
      .from("mothers").select("id").eq("family_id", familyId).eq("family_role", "primary").maybeSingle();
    if (primary) await sb.from("children").update({ mother_id: primary.id }).eq("mother_id", motherId);
    for (const table of ["push_subscriptions", "reminder_log", "device_tokens"]) {
      await sb.from(table).delete().eq("mother_id", motherId);
    }
    const { error: leaveErr } = await sb.from("mothers").delete().eq("id", motherId);
    if (leaveErr) return NextResponse.json({ error: `فشل حذف الحساب: ${leaveErr.message}` }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { data: children } = await sb.from("children").select("id").eq("family_id", familyId || "");
  const childIds = (children || []).map((c) => c.id);

  // الثاني يخرج لعائلته الخاصة قبل ما تنحذف عائلة الأساسي — حسابه يبقى
  // لكن بلا أي بيانات، فما يوصل لبيانات ما عادت له.
  if (familyId) {
    const { data: secondary } = await sb
      .from("mothers").select("id").eq("family_id", familyId).eq("family_role", "secondary").maybeSingle();
    if (secondary) {
      const { data: fresh } = await sb.from("families").insert({}).select("id").single();
      if (fresh) await sb.from("mothers").update({ family_id: fresh.id, family_role: "primary" }).eq("id", secondary.id);
    }
  }

  if (childIds.length) {
    for (const table of ["tasks", "requirements", "class_schedule", "memorization", "exam_grades", "ai_messages"]) {
      const { error } = await sb.from(table).delete().in("child_id", childIds);
      if (error) return NextResponse.json({ error: `فشل حذف ${table}: ${error.message}` }, { status: 400 });
    }
    const { error: chErr } = await sb.from("children").delete().in("id", childIds);
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
