import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// يمسح بيانات العام الدراسي (واجبات، طلبات، جدول حصص، حفظ، درجات، محادثات المعلم الذكي)
// لكل أطفال ولي الأمر — يبقي ملفات الأطفال أنفسهم (الاسم، المدرسة...) لتحديثها يدوياً بالصف الجديد.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: children, error: cErr } = await sb.from("children").select("id").eq("mother_id", motherId);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
  const childIds = (children || []).map((c) => c.id);
  if (!childIds.length) return NextResponse.json({ ok: true, cleared: 0 });

  const tables = ["tasks", "requirements", "class_schedule", "memorization", "exam_grades", "ai_messages"];
  for (const table of tables) {
    const { error } = await sb.from(table).delete().in("child_id", childIds);
    if (error) return NextResponse.json({ error: `فشل مسح ${table}: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, cleared: childIds.length });
}
