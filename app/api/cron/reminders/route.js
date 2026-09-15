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
    .not("due_date", "is", null)
    .gte("created_at", new Date(Date.now() - 26 * 3600 * 1000).toISOString());

  // الواجبات اللي موعد تسليمها بكرا. كان التذكير «قبل بيوم» للاختبارات
  // وحدها، والواجب ما يوصل عنه شي إلا صبح يوم التسليم — وهو متأخر: ما
  // يبقى وقت لعمله. نفس قاعدة الاختبار تنطبق عليه.
  const { data: tasksTomorrow } = await sb
    .from("tasks")
    .select("*, children(mother_id, name)")
    .neq("type", "اختبار")
    .eq("due_date", tomorrow)
    .eq("status", "active");

  // الواجبات اللي موعد تسليمها اليوم. قبل هذا كان تذكير يوم التسليم تنبيهاً
  // محلياً على الجهاز فقط، وهو يُجدول لما يُفتح التطبيق — فأم ما فتحته من
  // أيام ما كان يوصلها شي أصلاً. الاختبارات مستثناة لأن لها تذكيرها الخاص.
  const { data: tasksToday } = await sb
    .from("tasks")
    .select("*, children(mother_id, name)")
    .neq("type", "اختبار")
    .eq("due_date", today)
    .eq("status", "active");

  let sent = 0;
  const batches = [
    [examsTomorrow || [], "exam_day_before", (t) => `⏰ تذكير: اختبار ${t.subject} لـ ${t.children.name} غداً — وقت المذاكرة 📚`],
    [examsToday || [], "exam_today", (t) => `⏰ اليوم اختبار ${t.subject} لـ ${t.children.name} — بالتوفيق 🌟`],
    [freshTasks || [], "new_task", (t) => `📝 واجب جديد لـ ${t.children.name}: ${t.subject} (${t.type}) — الموعد ${t.due_date}`],
    [tasksTomorrow || [], "task_day_before", (t) => `⏰ تذكير: ${t.subject} (${t.type}) لـ ${t.children.name} موعد تسليمه غداً`],
    [tasksToday || [], "task_today", (t) => `📝 اليوم موعد تسليم ${t.subject} لـ ${t.children.name}`],
  ];

  for (const [rows, kind, textFn] of batches) {
    const results = await mapPool(rows, CONCURRENCY, async (t) => {
      const { data: exists } = await sb.from("reminder_log").select("id").eq("task_id", t.id).eq("kind", kind).maybeSingle();
      if (exists) return 0;

      // معرّف ولي الأمر جاي أصلاً مع الطالب/ة بالاستعلام، فما نحتاج استعلاماً
      // كاملاً عن صف الأم لكل تذكير — كان استعلاماً ضائعاً بالكامل.
      const motherId = t.children.mother_id;
      if (!motherId) return 0;

      const text = textFn(t);
      const title = KIND_TITLES[kind] || "دفتري";
      if (!(await deliverToMother(sb, motherId, title, text))) return 0;
      await sb.from("reminder_log").insert({ mother_id: motherId, task_id: t.id, kind });
      return 1;
    });
    sent += results.reduce((a, b) => a + b, 0);
  }

  sent += await sendRequirementReminders(sb, today, tomorrow);
  sent += await sendMemorizationReminders(sb, today);

  return NextResponse.json({ ok: true, sent });
}
