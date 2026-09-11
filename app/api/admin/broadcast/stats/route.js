import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

// نتيجة كل إعلان: كم وصل، كم فتحه، وكم منهم فتح التطبيق بعده فعلاً.
//
// «فتح التطبيق» يُقاس من last_seen_at بعد وقت الإرسال — أوسع من فتح
// الإشعار: فيه من يشوف الإشعار ويتجاهله ثم يفتح التطبيق بنفسه لاحقاً،
// وهذا نجاح للإعلان كذلك.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: campaigns, error } = await sb
    .from("broadcasts")
    .select("id, title, sent_at, recipients")
    .order("sent_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = [];
  for (const c of campaigns || []) {
    const { data: events } = await sb
      .from("broadcast_events")
      .select("mother_id, kind")
      .eq("broadcast_id", c.id);

    const sentTo = (events || []).filter((e) => e.kind === "sent").map((e) => e.mother_id);
    const opened = (events || []).filter((e) => e.kind === "opened").length;

    let openedApp = 0;
    if (sentTo.length) {
      const { count } = await sb
        .from("mothers")
        .select("id", { count: "exact", head: true })
        .in("id", sentTo)
        .gte("last_seen_at", c.sent_at);
      openedApp = count || 0;
    }

    rows.push({ ...c, opened, openedApp });
  }

  return NextResponse.json({ campaigns: rows });
}
