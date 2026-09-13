import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

// تقييمات البرنامج: المعدّل، توزيع النجوم، ونسبة من شاركوا ممن يستحقون
// العرض — النسبة من إجمالي المستخدمات تكون مضلّلة، لأن اللي سجّلت أمس ما
// طُلب منها التقييم أصلاً.
const FEEDBACK_AFTER_DAYS = 7;

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sb = supabaseAdmin();
  const eligibleBefore = new Date(Date.now() - FEEDBACK_AFTER_DAYS * 86400e3).toISOString();

  const [{ data: rows, error }, { count: eligible }] = await Promise.all([
    sb.from("app_feedback").select("rating, note, created_at, mothers(name)").order("created_at", { ascending: false }).limit(100),
    sb.from("mothers").select("id", { count: "exact", head: true }).lte("created_at", eligibleBefore),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = rows || [];
  const dist = [0, 0, 0, 0, 0];
  for (const r of list) dist[r.rating - 1]++;
  const average = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : null;

  return NextResponse.json({
    count: list.length,
    average: average == null ? null : Math.round(average * 10) / 10,
    dist,
    eligible: eligible || 0,
    items: list.map((r) => ({
      rating: r.rating,
      note: r.note,
      created_at: r.created_at,
      name: r.mothers?.name || "—",
    })),
  });
}
