import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

// بلاغات الأخطاء مجمّعة. التجميع مقصود: عشرون بلاغاً بنفس السبب مشكلة
// واحدة تحتاج إصلاحاً واحداً — عرضها كعشرين سطراً يخفي أن كلها شي واحد.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: rows, error } = await sb
    .from("error_reports")
    .select("feature, reason, detail, note, platform, created_at, mother_id, mothers(name)")
    .gte("created_at", new Date(Date.now() - 7 * 86400e3).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const groups = new Map();
  for (const r of rows || []) {
    const key = `${r.feature}|${r.reason || ""}`;
    const g = groups.get(key) || {
      feature: r.feature,
      reason: r.reason,
      count: 0,
      mothers: new Set(),
      names: new Set(),
      last: r.created_at,
      sample: r.detail,
      notes: [],
    };
    g.count++;
    if (r.mother_id) g.mothers.add(r.mother_id);
    if (r.mothers?.name) g.names.add(r.mothers.name);
    if (r.note) g.notes.push(r.note);
    groups.set(key, g);
  }

  const list = [...groups.values()]
    .map((g) => ({
      feature: g.feature,
      reason: g.reason,
      count: g.count,
      affected: g.mothers.size,
      names: [...g.names].slice(0, 6),
      last: g.last,
      sample: g.sample,
      notes: g.notes.slice(0, 3),
    }))
    .sort((a, b) => b.affected - a.affected || b.count - a.count);

  return NextResponse.json({ groups: list, total: (rows || []).length });
}
