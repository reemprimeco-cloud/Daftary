import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import { mapPool, CONCURRENCY, configureWebPush, deliverToMother } from "@/lib/pushDelivery";

// التذكير المسائي اليومي: إشعار واحد بسيط لكل ولي أمر بين ٢ و٥ العصر
// (بتوقيت الكويت) يذكّره بمتابعة دروس وواجبات أبنائه — طلب صاحبة التطبيق
// ١٥ سبتمبر. مستقل عن تذكيرات المواعيد (كرون الصباح): هذا تعويد يومي على
// المتابعة، وذاك عن موعد بعينه.
export const runtime = "nodejs";
export const maxDuration = 300;

const KIND = "evening_nudge";

function message(names, dueTomorrow) {
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} و${names[1]}` : "الأبناء";
  const weekday = kuwaitNow().getUTCDay(); // ٠ الأحد .. ٦ السبت
  // الخميس والجمعة مساءً ما فيه دوام بكرا — نذكّر بمراجعة الأسبوع بدل واجبات بكرا.
  if (weekday === 4 || weekday === 5) {
    return `🌙 وقت المتابعة: راجعي مع ${who} دروس الأسبوع وشوفي وش باقي من الواجبات 📚`;
  }
  const tail = dueTomorrow > 0 ? ` — عندك ${dueTomorrow} موعد تسليم بكرا ⏰` : "";
  return `🌙 وقت المتابعة: راجعي مع ${who} دروس اليوم وواجبات بكرا 📚${tail}`;
}

export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  configureWebPush();

  const sb = supabaseAdmin();
  const today = kuwaitTodayStr();
  const tomorrowDate = kuwaitNow();
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  // كل ولي أمر عنده طالب/ة — الرسالة تذكير عام ما تعتمد على وجود واجبات.
  const { data: children } = await sb.from("children").select("id, name, mother_id");
  const byMother = new Map();
  for (const c of children || []) {
    if (!c.mother_id) continue;
    const m = byMother.get(c.mother_id) || { names: [], childIds: [] };
    m.names.push(c.name);
    m.childIds.push(c.id);
    byMother.set(c.mother_id, m);
  }

  // عدد المواعيد بكرا لكل ولي أمر — استعلام واحد للجميع بدل واحد لكل أم.
  const { data: dueRows } = await sb
    .from("tasks").select("child_id").eq("status", "active").neq("type", "درس").eq("due_date", tomorrow);
  const childMother = new Map((children || []).map((c) => [c.id, c.mother_id]));
  const dueByMother = new Map();
  for (const t of dueRows || []) {
    const m = childMother.get(t.child_id);
    if (m) dueByMother.set(m, (dueByMother.get(m) || 0) + 1);
  }

  // من وصله إشعار اليوم ما يُعاد — استعلام واحد بدل واحد لكل أم.
  const { data: sentToday } = await sb
    .from("reminder_log").select("mother_id").eq("kind", KIND).gte("sent_at", `${today}T00:00:00+03:00`);
  const already = new Set((sentToday || []).map((r) => r.mother_id));

  const results = await mapPool([...byMother.entries()], CONCURRENCY, async ([motherId, { names }]) => {
    if (already.has(motherId)) return 0;
    const body = message(names, dueByMother.get(motherId) || 0);
    const delivered = await deliverToMother(sb, motherId, "دفتري", body);
    if (!delivered) return 0;
    await sb.from("reminder_log").insert({ mother_id: motherId, task_id: null, kind: KIND });
    return 1;
  });

  const sent = results.reduce((a, b) => a + b, 0);
  return NextResponse.json({ ok: true, mothers: byMother.size, sent });
}
