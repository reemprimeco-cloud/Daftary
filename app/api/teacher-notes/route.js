import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily } from "@/lib/family";

// ملاحظات المعلم للطالب من اجتماع أولياء الأمور. كلها بكتابة الأم يدوياً —
// ما فيه صورة تُقرأ هنا، فقاعدة «المرفوع يبقى كما هو» ما تنطبق (نفس حال
// الإضافة اليدوية للواجبات).

export async function GET(req) {
  const childId = req.nextUrl.searchParams.get("childId");
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!childId || !motherId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId, "id");
  if (!child) return NextResponse.json({ error: "الطالب/ة غير موجود" }, { status: 400 });

  const { data, error } = await sb
    .from("teacher_notes")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id") || body.motherId;
  const childId = body.childId;
  if (!motherId || !childId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const subject = body.subject?.trim();
  const note = body.note?.trim();
  if (!subject) return NextResponse.json({ error: "اختاري المادة" }, { status: 400 });
  if (!note) return NextResponse.json({ error: "اكتبي الملاحظة" }, { status: 400 });

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId, "id");
  if (!child) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { data, error } = await sb
    .from("teacher_notes")
    .insert({ child_id: childId, subject, note, term: body.term?.trim() || null })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}
