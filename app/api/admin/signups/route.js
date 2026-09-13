import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

const HOUR = 3600e3;

// حركة التسجيل ساعة بساعة — لمتابعة حملة إعلانية وهي شغّالة.
//
// أهم رقم فيها مو المجموع، بل «آخر تسجيل قبل كم»: توقف التدفق فجأة وسط
// حملة هو أسرع علامة على عطل (رصيد خلص، حساب موقوف) — أسرع من أي شكوى.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sb = supabaseAdmin();
  const now = Date.now();
  const since = new Date(now - 24 * HOUR).toISOString();

  const [{ data: recent }, { count: total }, { count: week }] = await Promise.all([
    sb.from("mothers").select("created_at").gte("created_at", since).order("created_at", { ascending: false }),
    sb.from("mothers").select("id", { count: "exact", head: true }),
    sb.from("mothers").select("id", { count: "exact", head: true }).gte("created_at", new Date(now - 7 * 24 * HOUR).toISOString()),
  ]);

  // ٢٤ خانة: الخانة ٠ هي الساعة الحالية، و٢٣ قبل ٢٣ ساعة.
  const counts = new Array(24).fill(0);
  for (const row of recent || []) {
    const hoursAgo = Math.floor((now - new Date(row.created_at).getTime()) / HOUR);
    if (hoursAgo >= 0 && hoursAgo < 24) counts[hoursAgo]++;
  }

  const hours = [];
  for (let i = 23; i >= 0; i--) {
    hours.push({
      // التوقيت بساعة الكويت مهما كان مكان السيرفر
      label: new Date(now - i * HOUR).toLocaleTimeString("ar-KW", { hour: "numeric", timeZone: "Asia/Kuwait" }),
      count: counts[i],
    });
  }

  const lastSignupAt = recent?.[0]?.created_at || null;

  return NextResponse.json({
    hours,
    last24: counts.reduce((a, b) => a + b, 0),
    lastHour: counts[0],
    week: week || 0,
    total: total || 0,
    lastSignupAt,
    minutesSinceLast: lastSignupAt ? Math.round((now - new Date(lastSignupAt).getTime()) / 60000) : null,
  });
}
