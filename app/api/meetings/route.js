import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily, familyChildIds } from "@/lib/family";

export const runtime = "nodejs";

// اجتماع أولياء الأمور (طلبها ٢٤ أكتوبر): موعد واحد جارٍ لكل طالب/ة،
// يُعرض جنبه بالرئيسية ويأخذ تذكيراً مسائياً قبله بيوم.
//
// الكتابة دائماً **بفعل صريح من الأم**: تكتب الموعد بنفسها، أو تستخرجه
// من صورة ثم تضغط حفظ. مسار الاستخراج (`/extract`) ما يحفظ شيئاً —
// يرجّع القراءة للنموذج وهي تعتمدها. فقاعدة «المرفوع يبقى كما هو» محفوظة:
// ما فيه كتابة صامتة عن موعد خمّنه البرنامج.

export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sb = supabaseAdmin();
  const childIds = await familyChildIds(sb, motherId);
  if (!childIds.length) return NextResponse.json({ meetings: [] });

  const { data, error } = await sb
    .from("parent_meetings")
    .select("id, child_id, meet_on, meet_time, note, source_text, source_id")
    .in("child_id", childIds)
    .order("meet_on");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meetings: data || [] });
}

export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  const { childId, meetOn, meetTime, note, sourceText, sourceId, fromImage } = await req.json().catch(() => ({}));
  if (!motherId || !childId || !meetOn) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetOn)) {
    return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  if (!(await childInFamily(sb, childId, motherId))) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  // صف واحد لكل طالب/ة — الموعد الجديد يحل محل السابق.
  // `edited_by_user` يرتفع لما تكتبه الأم بنفسها (لا استخراجاً من صورة)،
  // بنفس منطق `tasks`/`requirements`: تعديلها يتقدّم على أي قراءة آلية.
  const row = {
    child_id: childId,
    mother_id: motherId,
    meet_on: meetOn,
    meet_time: meetTime?.trim() || null,
    note: note?.trim() || null,
    source_text: sourceText?.trim() || null,
    source_id: sourceId || null,
    edited_by_user: !fromImage,
  };
  const { data, error } = await sb
    .from("parent_meetings")
    .upsert(row, { onConflict: "child_id" })
    .select("id, child_id, meet_on, meet_time, note, source_text, source_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meeting: data });
}

export async function DELETE(req) {
  const motherId = req.headers.get("x-mother-id");
  const childId = new URL(req.url).searchParams.get("childId");
  if (!motherId || !childId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  if (!(await childInFamily(sb, childId, motherId))) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { error } = await sb.from("parent_meetings").delete().eq("child_id", childId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
