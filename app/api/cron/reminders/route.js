import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import { mapPool, CONCURRENCY, configureWebPush, deliverToMother } from "@/lib/pushDelivery";
import { purgeExpiredSources } from "@/lib/uploadSources";

// APNs يحتاج HTTP/2 عبر node:http2، وهو غير متوفر على Edge runtime.
export const runtime = "nodejs";
// بلا تحديد تصير المهلة ١٠ ثوانٍ، والمسار يرسل لكل ولي أمر عنده تذكير
// اليوم — فمع نمو المستخدمين ينقطع بالنص: بعضهم يوصله التذكير وبعضهم لا،
// بصمت وبلا أي خطأ يبان. كل إرسال ≈ ٠٫٣ ث (اتصال APNs + الطلب + سجل)،
// فبتوازي ٢٠ يستوعب ~٢٠٬٠٠٠ إرسال بالمهلة — والكرون يشتغل مرة باليوم،
// فالي يفوت ما يُعاد إلا بكرا.
export const maxDuration = 300;

// دوال الإرسال المشتركة (mapPool، Web Push، APNs) في lib/pushDelivery.js

// التذكير يوصل لكل أولياء أمور العائلة (الأم والأب) لا لمن أنشأ الصف وحده.
// خريطة وحدة لكل تشغيلة بدل استعلام لكل عائلة — الجدول صغير والكرون يومي.
async function loadFamilyParents(sb) {
  const { data } = await sb.from("mothers").select("id, family_id");
  const map = new Map();
  for (const m of data || []) {
    if (!m.family_id) continue;
    if (!map.has(m.family_id)) map.set(m.family_id, []);
    map.get(m.family_id).push(m.id);
  }
  return map;
}

// إرسال رسالة مجمّعة لكل ولي أمر بالعائلة، مع سجل مستقل لكل واحد — القيد
// بالقاعدة صار (task_id, kind, mother_id)، فسجل الأم ما يمنع وصول الأب.
// dedupeToday: للرسائل اللي ما لها مهمة (تسميع، مستلزمات) نمنع التكرار
// بفحص سجل اليوم لنفس ولي الأمر.
async function deliverToFamily(sb, parentIds, { title, text, kind, today, taskIds = [null] }) {
  let sent = 0;
  for (const motherId of parentIds || []) {
    if (today) {
      const { data: already } = await sb
        .from("reminder_log")
        .select("id")
        .eq("mother_id", motherId)
        .eq("kind", kind)
        .gte("sent_at", `${today}T00:00:00+03:00`)
        .limit(1);
      if (already?.length) continue;
    }
    if (!(await deliverToMother(sb, motherId, title, text))) continue;
    await sb.from("reminder_log").insert(taskIds.map((taskId) => ({ mother_id: motherId, task_id: taskId, kind })));
    sent += taskIds.length;
  }
  return sent;
}

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
async function sendMemorizationReminders(sb, today, parents) {
  const weekday = kuwaitNow().getUTCDay(); // ٠ الأحد .. ٦ السبت
  if (weekday !== 6 && weekday !== 2) return 0;

  const { data: pending } = await sb
    .from("memorization")
    .select("id, children(family_id, name)")
    .eq("done", false)
    // اللي له موعد تسميع مكتوب ياخذ تذكير موعده (قبله بيوم ويومه) —
    // لو دخل هنا كمان صار عنه تذكيران بنفس الأسبوع.
    .is("recite_on", null);

  const byFamily = new Map();
  for (const m of pending || []) {
    const familyId = m.children?.family_id;
    if (!familyId) continue;
    const entry = byFamily.get(familyId) || { count: 0, names: new Set() };
    entry.count++;
    entry.names.add(m.children.name);
    byFamily.set(familyId, entry);
  }

  const memoResults = await mapPool([...byFamily.entries()], CONCURRENCY, async ([familyId, { count, names }]) => {
    const who = names.size === 1 ? [...names][0] : "أبنائك";
    return deliverToFamily(sb, parents.get(familyId), {
      title: "تذكير التسميع",
      text: `🕌 عند ${who} ${count} للتسميع — وقت المراجعة`,
      kind: "memorization",
      today,
    });
  });
  return memoResults.reduce((a, b) => a + b, 0);
}

// التسميع اللي مكتوب له موعد بالخطة ياخذ نفس قاعدة بقية المواعيد: تذكير
// قبله بيوم وتذكير يومه. اللي بلا موعد يبقى على تذكير السبت والثلاثاء فوق.
// مجمّع لكل أم (reminder_log.task_id يخص المهام، فنمنع التكرار باليوم).
async function sendRecitationReminders(sb, today, tomorrow, parents) {
  let sent = 0;
  for (const [date, kind, title, phrase] of [
    [tomorrow, "recitation_day_before", "تسميع غداً", "غداً موعد تسميع"],
    [today, "recitation_today", "تسميع اليوم", "اليوم موعد تسميع"],
  ]) {
    const { data: due } = await sb
      .from("memorization")
      .select("reference, children(family_id, name)")
      .eq("done", false)
      .eq("recite_on", date);

    const byFamily = new Map();
    for (const m of due || []) {
      const familyId = m.children?.family_id;
      if (!familyId) continue;
      const entry = byFamily.get(familyId) || { refs: [], names: new Set() };
      entry.refs.push(m.reference);
      entry.names.add(m.children.name);
      byFamily.set(familyId, entry);
    }

    const results = await mapPool([...byFamily.entries()], CONCURRENCY, async ([familyId, { refs, names }]) => {
      const who = names.size === 1 ? [...names][0] : "أبنائك";
      return deliverToFamily(sb, parents.get(familyId), {
        title,
        text: `🕌 ${phrase} ${who}: ${refs.join("، ")}`,
        kind,
        today,
      });
    });
    sent += results.reduce((a, b) => a + b, 0);
  }
  return sent;
}

// المستلزمات كانت تُستخرج من الصور وتنعرض بالبرنامج، لكن ما كان لها أي
// تذكير — والأم تحتاج تعرف قبل بيوم عشان تشتريها، مو صبح يوم التسليم.
// رسالة واحدة مجمّعة: خمسة أغراض لنفس اليوم رحلة شراء وحدة مو خمس رسائل.
// وreminder_log.task_id مرتبط بجدول المهام، فنمنع التكرار باليوم وولي الأمر.
async function sendRequirementReminders(sb, today, tomorrow, parents) {
  const { data: due } = await sb
    .from("requirements")
    .select("item, children(family_id, name)")
    .eq("bought", false)
    .eq("due_date", tomorrow);

  const byFamily = new Map();
  for (const r of due || []) {
    const familyId = r.children?.family_id;
    if (!familyId) continue;
    const entry = byFamily.get(familyId) || { items: [], names: new Set() };
    entry.items.push(r.item);
    entry.names.add(r.children.name);
    byFamily.set(familyId, entry);
  }

  const results = await mapPool([...byFamily.entries()], CONCURRENCY, async ([familyId, { items, names }]) => {
    const who = names.size === 1 ? [...names][0] : "العيال";
    return deliverToFamily(sb, parents.get(familyId), {
      title: "مستلزمات غداً",
      text: `🎒 مستلزمات ${who} المطلوبة غداً: ${items.join("، ")}`,
      kind: "requirement_day_before",
      today,
    });
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
  // أولياء أمور كل عائلة — التذكير يوصل للأم والأب سواء.
  const parents = await loadFamilyParents(sb);
  const today = kuwaitTodayStr();
  const tomorrowDate = kuwaitNow();
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  const { data: examsToday } = await sb
    .from("tasks")
    .select("*, children(family_id, name)")
    .eq("type", "اختبار")
    .eq("due_date", today)
    .eq("status", "active");

  const { data: examsTomorrow } = await sb
    .from("tasks")
    .select("*, children(family_id, name)")
    .eq("type", "اختبار")
    .eq("due_date", tomorrow)
    .eq("status", "active");

  const { data: freshTasks } = await sb
    .from("tasks")
    .select("*, children(family_id, name)")
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
    .select("*, children(family_id, name)")
    .neq("type", "اختبار")
    .neq("type", "درس")
    .eq("due_date", tomorrow)
    .eq("status", "active");

  // الواجبات اللي موعد تسليمها اليوم. قبل هذا كان تذكير يوم التسليم تنبيهاً
  // محلياً على الجهاز فقط، وهو يُجدول لما يُفتح التطبيق — فأم ما فتحته من
  // أيام ما كان يوصلها شي أصلاً. الاختبارات مستثناة لأن لها تذكيرها الخاص.
  const { data: tasksToday } = await sb
    .from("tasks")
    .select("*, children(family_id, name)")
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
    // المنع من التكرار صار لكل ولي أمر على حدة: سجل الأم ما يمنع وصول
    // التذكير للأب (القيد بالقاعدة صار (task_id, kind, mother_id)).
    const { data: logged } = await sb.from("reminder_log").select("task_id, mother_id").eq("kind", kind).in("task_id", rows.map((t) => t.id));
    const already = new Set((logged || []).map((r) => `${r.task_id}|${r.mother_id}`));
    const byFamily = new Map();
    for (const t of rows) {
      const familyId = t.children?.family_id;
      if (!familyId) continue;
      if (!byFamily.has(familyId)) byFamily.set(familyId, []);
      byFamily.get(familyId).push(t);
    }

    const results = await mapPool([...byFamily.entries()], CONCURRENCY, async ([familyId, familyTasks]) => {
      let count = 0;
      for (const motherId of parents.get(familyId) || []) {
        const tasks = familyTasks.filter((t) => !already.has(`${t.id}|${motherId}`));
        if (!tasks.length) continue;
        const text = tasks.length === 1 ? textFn(tasks[0]) : groupedText(tasks, kind, groupFn);
        const title = tasks.length === 1 ? KIND_TITLES[kind] || "دفتري" : GROUP_TITLES[kind] || KIND_TITLES[kind] || "دفتري";
        if (!(await deliverToMother(sb, motherId, title, text))) continue;
        await sb.from("reminder_log").insert(tasks.map((t) => ({ mother_id: motherId, task_id: t.id, kind })));
        count += tasks.length;
      }
      return count;
    });
    sent += results.reduce((a, b) => a + b, 0);
  }

  sent += await sendRequirementReminders(sb, today, tomorrow, parents);
  sent += await sendRecitationReminders(sb, today, tomorrow, parents);
  sent += await sendMemorizationReminders(sb, today, parents);

  // تنظيف صور المصدر المنتهية (أسبوع من الرفع) — معلّق على كرون يومي موجود
  // بدل كرون جديد. فشله ما يخص التذكيرات، فلا يوقفها.
  let purgedSources = 0;
  try {
    purgedSources = await purgeExpiredSources(sb);
  } catch (e) {
    console.warn("purgeExpiredSources failed:", e.message);
  }

  return NextResponse.json({ ok: true, sent, purgedSources });
}
