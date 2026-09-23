import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import { mapPool, CONCURRENCY, configureWebPush } from "@/lib/pushDelivery";
import { purgeExpiredSources } from "@/lib/uploadSources";
import {
  loadFamilyParents,
  deliverToFamily,
  countTasks,
  sendTaskBatch,
  sendExamRounds,
  sendRecitationFor,
  EXAM_ROUNDS,
} from "@/lib/reminderBatch";

// APNs يحتاج HTTP/2 عبر node:http2، وهو غير متوفر على Edge runtime.
export const runtime = "nodejs";
// بلا تحديد تصير المهلة ١٠ ثوانٍ، والمسار يرسل لكل ولي أمر عنده تذكير
// اليوم — فمع نمو المستخدمين ينقطع بالنص: بعضهم يوصله التذكير وبعضهم لا،
// بصمت وبلا أي خطأ يبان. كل إرسال ≈ ٠٫٣ ث (اتصال APNs + الطلب + سجل)،
// فبتوازي ٢٠ يستوعب ~٢٠٬٠٠٠ إرسال بالمهلة — والكرون يشتغل مرة باليوم،
// فالي يفوت ما يُعاد إلا بكرا.
export const maxDuration = 300;

// دوال الإرسال المشتركة (mapPool، Web Push، APNs) في lib/pushDelivery.js،
// ومنطق التجميع ومنع التكرار وتذكيرات الاختبار في lib/reminderBatch.js —
// يشاركها كرون المساء.

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

  // تذكير «موعد التسليم اليوم» انلغى (قرار صاحبة التطبيق ٢٣ سبتمبر): صبح
  // يوم التسليم ما يبقى وقت للعمل، فتذكير «غداً» هو المفيد. وانشال معه
  // التنبيه المحلي على الجهاز اللي كان يطلع ٤ العصر بنفس المعنى
  // (`syncTaskReminders` بـlib/native.js) — وإلا انلغى نصفه فقط.
  let sent = 0;

  // الاختبارات: قبل يومين وقبل يوم، صبحاً — والعصر بكرون المساء.
  sent += await sendExamRounds(sb, parents, EXAM_ROUNDS.morning, kuwaitNow());

  const batches = [
    {
      rows: freshTasks || [], kind: "new_task", title: "واجب جديد", groupTitle: "واجبات جديدة",
      textFn: (t) => `📝 واجب جديد لـ ${t.children.name}: ${t.subject} (${t.type}) — الموعد ${t.due_date}`,
      groupFn: (who, list, n) => `📝 ${countTasks(n)} جديدة لـ ${who}: ${list}`,
    },
    {
      rows: tasksTomorrow || [], kind: "task_day_before", title: "تذكير تسليم غداً", groupTitle: "تسليم غداً",
      textFn: (t) => `⏰ تذكير: ${t.subject} (${t.type}) لـ ${t.children.name} موعد تسليمه غداً`,
      groupFn: (who, list, n) => `⏰ غداً موعد تسليم ${countTasks(n)} لـ ${who}: ${list}`,
    },
  ];
  for (const batch of batches) {
    sent += await sendTaskBatch(sb, parents, batch);
  }

  sent += await sendRequirementReminders(sb, today, tomorrow, parents);
  // تذكير «تسميع اليوم» انتقل لكرون ٦ الصبح (/api/cron/recitation).
  sent += await sendRecitationFor(sb, parents, {
    date: tomorrow, kind: "recitation_day_before", title: "تسميع غداً", phrase: "غداً موعد تسميع", today,
  });
  sent += await sendMemorizationReminders(sb, today, parents);

  // تنظيف صور المصدر المنتهية (أسبوع لصور الخطة، ٢٤ ساعة لصور المعلم
  // الذكي) — معلّق على كرون يومي موجود بدل كرون جديد، ويشتغل بكرون المساء
  // كذلك عشان ما تقعد الصورة المنتهية بالتخزين لين بكرة. فشله ما يخص
  // التذكيرات، فلا يوقفها.
  let purgedSources = 0;
  try {
    purgedSources = await purgeExpiredSources(sb);
  } catch (e) {
    console.warn("purgeExpiredSources failed:", e.message);
  }

  return NextResponse.json({ ok: true, sent, purgedSources });
}
