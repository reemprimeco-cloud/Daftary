import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

// قائمة أرقام أولياء الأمور للتواصل اليدوي بالواتساب (طلبها ١ أكتوبر).
// الإشعار يوصل ٥١ من ٢٢١ بس — والباقي ما عنده أي قناة غير رقمه.
//
// ترجّع **ولي الأمر الأساسي وحده**: الثاني بنفس العائلة يشوف نفس
// البيانات، فرسالتان لنفس البيت إزعاج.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sb = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: mothers, error }, { data: subs }, { data: devices }, { data: webSubs }, { data: kids }] =
    await Promise.all([
      sb.from("mothers").select("id, name, phone, family_id, family_role, last_seen_at, created_at"),
      sb.from("app_subscriptions").select("mother_id").gte("period_end", today),
      sb.from("device_tokens").select("mother_id"),
      sb.from("push_subscriptions").select("mother_id"),
      sb.from("children").select("family_id"),
    ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subscribed = new Set((subs || []).map((r) => r.mother_id));
  const pushable = new Set([...(devices || []), ...(webSubs || [])].map((r) => r.mother_id));
  const kidsBy = new Map();
  for (const c of kids || []) kidsBy.set(c.family_id, (kidsBy.get(c.family_id) || 0) + 1);

  // أرقام أنشأناها نحن للاختبار ومراجعة آبل — تُعلَّم ولا تُحذف: الإخفاء
  // بالتخمين قد يخفي أماً حقيقية، والعلامة تخلّي القرار لها.
  const TEST_PHONES = new Set(["+96599000000", "+96550000000", "+96555555555", "+96512345678"]);

  const rows = (mothers || [])
    .filter((m) => (m.family_role || "primary") === "primary")
    .map((m) => ({
      name: m.name || "",
      phone: m.phone || "",
      wa: (m.phone || "").replace(/[^0-9]/g, ""),
      subscriber: subscribed.has(m.id),
      push: pushable.has(m.id),
      kids: kidsBy.get(m.family_id) || 0,
      lastSeen: m.last_seen_at ? m.last_seen_at.slice(0, 10) : null,
      joined: m.created_at ? m.created_at.slice(0, 10) : null,
      test: TEST_PHONES.has(m.phone || ""),
    }))
    .filter((r) => r.wa.length >= 8);

  // الترتيب هو الأولوية: المشتركة أولاً، ثم من ما يوصلها إشعار (هي اللي
  // الواتساب قناتها الوحيدة)، ثم الأكثر أبناءً — الأقرب للاستخدام فعلاً.
  rows.sort((a, b) =>
    Number(a.test) - Number(b.test) ||
    Number(b.subscriber) - Number(a.subscriber) ||
    Number(a.push) - Number(b.push) ||
    b.kids - a.kids ||
    (a.joined || "").localeCompare(b.joined || "")
  );

  return NextResponse.json({ contacts: rows });
}
