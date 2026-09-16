import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import { mapPool, CONCURRENCY, configureWebPush, deliverToMother } from "@/lib/pushDelivery";

// APNs يحتاج HTTP/2 عبر node:http2، وهو غير متوفر على Edge runtime.
export const runtime = "nodejs";
// بلا تحديد تصير المهلة ١٠ ثوانٍ، والمسار يرسل لكل ولي أمر عنده تذكير
// اليوم — فمع نمو المستخدمين ينقطع بالنص: بعضهم يوصله التذكير وبعضهم لا،
// بصمت وبلا أي خطأ يبان. كل إرسال ≈ ٠٫٣ ث (اتصال APNs + الطلب + سجل)،
// فبتوازي ٢٠ يستوعب ~٢٠٬٠٠٠ إرسال بالمهلة — والكرون يشتغل مرة باليوم،
// فالي يفوت ما يُعاد إلا بكرا.
export const maxDuration = 300;

// دوال الإرسال المشتركة (mapPool، Web Push، APNs) في lib/pushDelivery.js

const KIND_TITLES = {
  exam_day_before: "تذكير اختبار غداً",
  exam_today: "اختبار اليوم",
  new_task: "واجب جديد",
  task_day_before: "تذكير تسليم غداً",
  task_today: "موعد التسليم اليوم",
};
const GROUP_TITLES = {
  exam_day_before: "اختبارات غداً",
  exam_today: "اختبارات اليوم",
  new_task: "واجبات جديدة",
  task_day_before: "تسليم غداً",
  task_today: "تسليم اليوم",
};

// «واجبان» / «٥ واجبات» / «١٢ واجباً» — عربية سليمة بدل «5 واجب».
function countTasks(n) {
  if (n === 2) return "واجبان";
  if (n <= 10) return `${n} واجبات`;
  return `${n} واجباً`;
}

// نص الإشعار المجمّع: المواد بأسمائها كما بالخطة (والنوع لو مو واجباً عادياً)،
// ولكل طالب/ة سطر لو الأم عندها أكثر من واحد بنفس الإشعار.
function groupedText(tasks, kind, groupFn) {
  const byChild = new Map();
  for (const t of tasks) {
    const name = t.children?.name || "";
    if (!byChild.has(name)) byChild.set(name, []);
    byChild.get(name).push(t);
  }
  const label = (t) => (kind.startsWith("exam") || t.type === "واجب" ? t.subject : `${t.subject} (${t.type})`);
  if (byChild.size === 1) {
    const [name, list] = [...byChild.entries()][0];
    return groupFn(name, list.map(label).join("، "), list.length);
  }
  const lines = [...byChild.entries()].map(([name, list]) => `${name}: ${list.map(label).join("، ")}`);
  return groupFn("أبنائك", `\n${lines.join("\n")}`, tasks.length);
}

// المحفوظات ما لها موعد بقاعدة البيانات (مرجع وحالة إنجاز فقط)، وغالباً
// تجي ضمن الخطة الأسبوعية بلا تاريخ محدد — فما نقدر نذكّر «قبل الموعد
// بيوم» مثل الواجبات. نذكّر بدلها مرتين بالأسبوع بما تبقّى غير منجز:
// السبت (قبل بداية الدوام) والثلاثاء (منتصف الأسبوع الدراسي). أما
// التسميع اللي له اختبار فيُسجَّل كاختبار وياخذ تذكير الاختبارات نفسه.
//
// رسالة واحدة مجمّعة لكل ولي أمر مو رسالة لكل محفوظ — عائلة عندها عشر
// محفوظات ما تستاهل عشرة إشعارات بنفس الدقيقة.
async function sendMemorizationReminders(sb, today) {
  const weekday = kuwaitNow().getUTCDay(); // ٠ الأحد .. ٦ السبت
  if (weekday !== 6 && weekday !== 2) return 0;

  const { data: pending } = await sb
    .from("memorization")
    .select("id, children(mother_id, name)")
    .eq("done", false);

  const byMother = new Map();
  for (const m of pending || []) {
    const motherId = m.children?.mother_id;
    if (!motherId) continue;
    const entry = byMother.get(motherId) || { count: 0, names: new Set() };
    entry.count++;
    entry.names.add(m.children.name);
    byMother.set(motherId, entry);
  }

  const memoResults = await mapPool([...byMother.entries()], CONCURRENCY, async ([motherId, { count, names }]) => {
    // القيد الفريد بـreminder_log على (task_id, kind) وهنا ما فيه مهمة،
    // فنمنع التكرار بفحص إن ما أُرسل شي لنفس ولي الأمر اليوم.
    const { data: already } = await sb
      .from("reminder_log")
      .select("id")
      .eq("mother_id", motherId)
      .eq("kind", "memorization")
      .gte("sent_at", `${today}T00:00:00+03:00`)
      .limit(1);
    if (already?.length) return 0;

    const who = names.size === 1 ? [...names][0] : "أبنائك";
    const text = `🕌 عند ${who} ${count} للتسميع — وقت المراجعة`;

    if (!(await deliverToMother(sb, motherId, "تذكير التسميع", text))) return 0;
    await sb.from("reminder_log").insert({ mother_id: motherId, task_id: null, kind: "memorization" });
    return 1;
  });
  return memoResults.reduce((a, b) => a + b, 0);
}

// المستلزمات كانت تُستخرج من الصور وتنعرض بالبرنامج، لكن ما كان لها أي
// تذكير — والأم تحتاج تعرف قبل بيوم عشان تشتريها، مو صبح يوم التسليم.
// رسالة واحدة مجمّعة: خمسة أغراض لنفس اليوم رحلة شراء وحدة مو خمس رسائل.
// وreminder_log.task_id مرتبط بجدول المهام، فنمنع التكرار باليوم وولي الأمر.
async function sendRequirementReminders(sb, today, tomorrow) {
  const { data: due } = await sb
    .from("requirements")
    .select("item, children(mother_id, name)")
    .eq("bought", false)
    .eq("due_date", tomorrow);

  const byMother = new Map();
  for (const r of due || []) {
    const motherId = r.children?.mother_id;
    if (!motherId) continue;
    const entry = byMother.get(motherId) || { items: [], names: new Set() };
    entry.items.push(r.item);
    entry.names.add(r.children.name);
    byMother.set(motherId, entry);
  }

  const results = await mapPool([...byMother.entries()], CONCURRENCY, async ([motherId, { items, names }]) => {
    const { data: already } = await sb
      .from("reminder_log")
      .select("id")
      .eq("mother_id", motherId)
      .eq("kind", "requirement_day_before")
      .gte("sent_at", `${today}T00:00:00+03:00`)
      .limit(1);
    if (already?.length) return 0;

    const who = names.size === 1 ? [...names][0] : "العيال";
    const text = `🎒 مستلزمات ${who} المطلوبة غداً: ${items.join("، ")}`;
    const title = "مستلزمات غداً";

    if (!(await deliverToMother(sb, motherId, title, text))) return 0;
    await sb.from("reminder_log").insert({ mother_id: motherId, task_id: null, kind: "requirement_day_before" });
    return 1;
  });
  return results.reduce((a, b) => a + b, 0);
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

  const { data: examsToday } = await sb
    .from("tasks")
    .select("*, children(mother_id, name)")
    .eq("type", "اختبار")
    .eq("due_date", today)
    .eq("status", "active");

  const { data: examsTomorrow } = await sb
    .from("tasks")
    .select("*, children(mother_id, name)")
    .eq("type", "اختبار")
    .eq("due_date", tomorrow)
    .eq("status", "active");

  const { data: freshTasks } = await sb
    .from("tasks")
    .select("*, children(mother_id, name)")
    .eq("status", "active")
    // «درس» = محتوى المنهج بالخطة الأسبوعية، ما له موعد تسليم ولا يحتاج
    // تنبيهاً — التذكير للواجب والاختبار والمشروع والحفظ فقط.
    .neq("type", "درس")
    .not("due_date", "is", null)
    .gte("created_at", new Date(Date.now() - 26 * 3600 * 1000).toISOString());

  // الواجبات اللي موعد تسليمها بكرا. كان التذكير «قبل بيوم» للاختبارات
  // وحدها، والواجب ما يوصل عنه شي إلا صبح يوم التسليم — وهو متأخر: ما
  // يبقى وقت لعمله. نفس قاعدة الاختبار تنطبق عليه.
  const { data: tasksTomorrow } = await sb
    .from("tasks")
    .select("*, children(mother_id, name)")
    .neq("type", "اختبار")
    .neq("type", "درس")
    .eq("due_date", tomorrow)
    .eq("status", "active");

  // الواجبات اللي موعد تسليمها اليوم. قبل هذا كان تذكير يوم التسليم تنبيهاً
  // محلياً على الجهاز فقط، وهو يُجدول لما يُفتح التطبيق — فأم ما فتحته من
  // أيام ما كان يوصلها شي أصلاً. الاختبارات مستثناة لأن لها تذكيرها الخاص.
  const { data: tasksToday } = await sb
    .from("tasks")
    .select("*, children(mother_id, name)")
    .neq("type", "اختبار")
    .neq("type", "درس")
    .eq("due_date", today)
    .eq("status", "active");

  let sent = 0;
  const batches = [
    [examsTomorrow || [], "exam_day_before", (t) => `⏰ تذكير: اختبار ${t.subject} لـ ${t.children.name} غداً — وقت المذاكرة 📚`, (who, list) => `⏰ غداً اختبارات لـ ${who}: ${list} — وقت المذاكرة 📚`],
    [examsToday || [], "exam_today", (t) => `⏰ اليوم اختبار ${t.subject} لـ ${t.children.name} — بالتوفيق 🌟`, (who, list) => `⏰ اليوم اختبارات لـ ${who}: ${list} — بالتوفيق 🌟`],
    [freshTasks || [], "new_task", (t) => `📝 واجب جديد لـ ${t.children.name}: ${t.subject} (${t.type}) — الموعد ${t.due_date}`, (who, list, n) => `📝 ${countTasks(n)} جديدة لـ ${who}: ${list}`],
    [tasksTomorrow || [], "task_day_before", (t) => `⏰ تذكير: ${t.subject} (${t.type}) لـ ${t.children.name} موعد تسليمه غداً`, (who, list, n) => `⏰ غداً موعد تسليم ${countTasks(n)} لـ ${who}: ${list}`],
    [tasksToday || [], "task_today", (t) => `📝 اليوم موعد تسليم ${t.subject} لـ ${t.children.name}`, (who, list, n) => `📝 اليوم موعد تسليم ${countTasks(n)} لـ ${who}: ${list}`],
  ];

  // إشعار واحد لكل ولي أمر لكل نوع، مو إشعار لكل واجب: خطة فيها خمسة واجبات
  // ليوم الخميس كانت تطلّع خمسة إشعارات متتالية بنفس الدقيقة (طلب صاحبة
  // التطبيق ١٦ سبتمبر). التكرار يبقى ممنوعاً بسجل reminder_log لكل واجب.
  for (const [rows, kind, textFn, groupFn] of batches) {
    if (!rows.length) continue;
    const { data: logged } = await sb.from("reminder_log").select("task_id").eq("kind", kind).in("task_id", rows.map((t) => t.id));
    const already = new Set((logged || []).map((r) => r.task_id));
    const byMother = new Map();
    for (const t of rows) {
      const motherId = t.children?.mother_id;
      if (!motherId || already.has(t.id)) continue;
      if (!byMother.has(motherId)) byMother.set(motherId, []);
      byMother.get(motherId).push(t);
    }

    const results = await mapPool([...byMother.entries()], CONCURRENCY, async ([motherId, tasks]) => {
      const text = tasks.length === 1 ? textFn(tasks[0]) : groupedText(tasks, kind, groupFn);
      const title = tasks.length === 1 ? KIND_TITLES[kind] || "دفتري" : GROUP_TITLES[kind] || KIND_TITLES[kind] || "دفتري";
      if (!(await deliverToMother(sb, motherId, title, text))) return 0;
      await sb.from("reminder_log").insert(tasks.map((t) => ({ mother_id: motherId, task_id: t.id, kind })));
      return tasks.length;
    });
    sent += results.reduce((a, b) => a + b, 0);
  }

  sent += await sendRequirementReminders(sb, today, tomorrow);
  sent += await sendMemorizationReminders(sb, today);

  return NextResponse.json({ ok: true, sent });
}
