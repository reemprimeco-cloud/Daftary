import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import { mapPool, CONCURRENCY, configureWebPush, deliverToMother } from "@/lib/pushDelivery";
import { purgeExpiredSources } from "@/lib/uploadSources";

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
  // التجميع بالعائلة، والإرسال لكل أولياء أمورها (الأم والأب).
  const { data: children } = await sb.from("children").select("id, name, family_id");
  const { data: allParents } = await sb.from("mothers").select("id, family_id");
  const parentsByFamily = new Map();
  for (const p of allParents || []) {
    if (!p.family_id) continue;
    if (!parentsByFamily.has(p.family_id)) parentsByFamily.set(p.family_id, []);
    parentsByFamily.get(p.family_id).push(p.id);
  }

  const byFamily = new Map();
  for (const c of children || []) {
    if (!c.family_id) continue;
    const m = byFamily.get(c.family_id) || { names: [], childIds: [] };
    m.names.push(c.name);
    m.childIds.push(c.id);
    byFamily.set(c.family_id, m);
  }

  // عدد المواعيد بكرا لكل عائلة — استعلام واحد للجميع بدل واحد لكل أم.
  const { data: dueRows } = await sb
    .from("tasks").select("child_id").eq("status", "active").neq("type", "درس").eq("due_date", tomorrow);
  const childFamily = new Map((children || []).map((c) => [c.id, c.family_id]));
  const dueByFamily = new Map();
  for (const t of dueRows || []) {
    const f = childFamily.get(t.child_id);
    if (f) dueByFamily.set(f, (dueByFamily.get(f) || 0) + 1);
  }

  // من وصله إشعار اليوم ما يُعاد — استعلام واحد بدل واحد لكل أم.
  const { data: sentToday } = await sb
    .from("reminder_log").select("mother_id").eq("kind", KIND).gte("sent_at", `${today}T00:00:00+03:00`);
  const already = new Set((sentToday || []).map((r) => r.mother_id));

  const results = await mapPool([...byFamily.entries()], CONCURRENCY, async ([familyId, { names }]) => {
    const body = message(names, dueByFamily.get(familyId) || 0);
    let count = 0;
    for (const motherId of parentsByFamily.get(familyId) || []) {
      if (already.has(motherId)) continue;
      if (!(await deliverToMother(sb, motherId, "دفتري", body))) continue;
      await sb.from("reminder_log").insert({ mother_id: motherId, task_id: null, kind: KIND });
      count++;
    }
    return count;
  });

  const sent = results.reduce((a, b) => a + b, 0);

  // مرور تنظيف ثانٍ بنفس اليوم: صور المعلم الذكي عمرها ٢٤ ساعة، وكرون
  // الصباح وحده كان يخلي المنتهية تقعد بالتخزين لين بكرة.
  let purgedSources = 0;
  try {
    purgedSources = await purgeExpiredSources(sb);
  } catch (e) {
    console.warn("purgeExpiredSources failed:", e.message);
  }

  return NextResponse.json({ ok: true, families: byFamily.size, sent, purgedSources });
}
