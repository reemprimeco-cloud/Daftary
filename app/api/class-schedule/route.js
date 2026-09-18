import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// نفس قيد class_schedule.day بالقاعدة
const DAYS = new Set(["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]);

// إضافة حصة يدوياً بخانة فاضية بجدول الحصص — نفس جدول class_schedule اللي
// يملأه الاستخراج من الصورة، فتظهر فوراً بنفس الشكل والتصدير.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { childId, day, periodNumber, subject, teacher, startTime, endTime } = body;
  const motherId = req.headers.get("x-mother-id");
  const period = Number(periodNumber);
  if (!motherId || !childId || !DAYS.has(day) || !Number.isInteger(period) || period < 1 || period > 12 || !subject?.trim()) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: child } = await sb.from("children").select("id").eq("id", childId).eq("mother_id", motherId).maybeSingle();
  if (!child) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { data, error } = await sb
    .from("class_schedule")
    .insert({
      child_id: childId,
      day,
      period_number: period,
      subject: subject.trim(),
      teacher: teacher?.trim() || null,
      start_time: startTime?.trim() || null,
      end_time: endTime?.trim() || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ entry: data });
}
