import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function verifyOwnership(sb, id, motherId) {
  const { data } = await sb.from("class_schedule").select("id, children(mother_id)").eq("id", id).single();
  return !!data && data.children?.mother_id === motherId;
}

// اليوم ورقم الحصة يحددان موقع الخانة بالجدول (قيد UNIQUE)، فما يُعدَّلان
// هنا — التعديل يقتصر على مادة/معلّم/وقت نفس الخانة. تغيير موقعها فعلياً
// حذف وإضافة من جديد.
export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const update = {};
  if ("subject" in body) {
    if (!body.subject?.trim()) return NextResponse.json({ error: "المادة مطلوبة" }, { status: 400 });
    update.subject = body.subject.trim();
  }
  if ("teacher" in body) update.teacher = body.teacher?.trim() || null;
  if ("startTime" in body) update.start_time = body.startTime?.trim() || null;
  if ("endTime" in body) update.end_time = body.endTime?.trim() || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "لا يوجد شيء للتحديث" }, { status: 400 });

  const { error } = await sb.from("class_schedule").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("class_schedule").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
