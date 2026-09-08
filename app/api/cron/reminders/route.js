import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import webpush from "web-push";
import { sendApns, apnsConfigured } from "@/lib/apns";

// APNs يحتاج HTTP/2 عبر node:http2، وهو غير متوفر على Edge runtime.
export const runtime = "nodejs";

function vapidConfigured() {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_SUBJECT);
}

// ننظّف مفاتيح VAPID من أي محارف مو من أبجدية base64url — مسافات أو محارف
// اتجاه غير مرئية ممكن تنلصق بالقيمة عند نسخها ولصقها بإعدادات Vercel.
function cleanVapidKey(key) {
  return (key || "").trim().replace(/[^A-Za-z0-9\-_]/g, "");
}

async function sendPush(sb, sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // الاشتراك ما عاد صالح (المستخدم مسح البيانات / ألغى الإذن) — نمسحه.
      await sb.from("push_subscriptions").delete().eq("id", sub.id);
    } else {
      console.error("push send error:", err.message);
    }
    return false;
  }
}

// إشعارات أجهزة التطبيق. الفرق الجوهري عن Web Push إنها توصل حتى والتطبيق
// مقفل ومن غير ما يفتحه ولي الأمر — وهذي كانت الفجوة: مستخدم التطبيق ما
// كان يوصله شي عن واجب أضافه أحد ثاني، لأن التذكيرات المحلية تُجدول فقط
// لما يفتح التطبيق.
async function sendToDevices(sb, motherId, title, body) {
  if (!apnsConfigured()) return false;

  const { data: devices } = await sb
    .from("device_tokens").select("token, environment").eq("mother_id", motherId).eq("platform", "ios");
  if (!devices?.length) return false;

  const results = await sendApns(
    devices.map((d) => ({ token: d.token, environment: d.environment, title, body }))
  );

  let delivered = false;
  for (const r of results) {
    if (r.ok) {
      delivered = true;
      // نحفظ البيئة اللي نجحت عشان ما نخمّنها بكل إرسال
      await sb.from("device_tokens")
        .update({ environment: r.environment, last_error: null }).eq("token", r.token);
    } else if (r.reason === "BadDeviceToken" || r.reason === "Unregistered") {
      // الرمز ما عاد صالح (حُذف التطبيق أو أُلغي الإذن) — نمسحه بدل ما
      // نعيد المحاولة عليه كل يوم للأبد.
      await sb.from("device_tokens").delete().eq("token", r.token);
    } else {
      await sb.from("device_tokens").update({ last_error: r.reason }).eq("token", r.token);
    }
  }
  return delivered;
}

const KIND_TITLES = {
  exam_day_before: "تذكير اختبار غداً",
  exam_today: "اختبار اليوم",
  new_task: "واجب جديد",
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

  let sent = 0;
  for (const [motherId, { count, names }] of byMother) {
    // القيد الفريد بـreminder_log على (task_id, kind) وهنا ما فيه مهمة،
    // فنمنع التكرار بفحص إن ما أُرسل شي لنفس ولي الأمر اليوم.
    const { data: already } = await sb
      .from("reminder_log")
      .select("id")
      .eq("mother_id", motherId)
      .eq("kind", "memorization")
      .gte("sent_at", `${today}T00:00:00+03:00`)
      .limit(1);
    if (already?.length) continue;

    const who = names.size === 1 ? [...names][0] : "أبنائك";
    const text = `🕌 عند ${who} ${count} للتسميع — وقت المراجعة`;

    let delivered = false;
    if (vapidConfigured()) {
      const { data: subs } = await sb.from("push_subscriptions").select("*").eq("mother_id", motherId);
      for (const sub of subs || []) {
        if (await sendPush(sb, sub, { title: "تذكير التسميع", body: text, url: "/" })) delivered = true;
      }
    }
    if (await sendToDevices(sb, motherId, "تذكير التسميع", text)) delivered = true;

    if (!delivered) continue;
    await sb.from("reminder_log").insert({ mother_id: motherId, task_id: null, kind: "memorization" });
    sent++;
  }
  return sent;
}

export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (vapidConfigured()) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT.trim(),
      cleanVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      cleanVapidKey(process.env.VAPID_PRIVATE_KEY)
    );
  }

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
    [tasksToday || [], "task_today", (t) => `📝 اليوم موعد تسليم ${t.subject} لـ ${t.children.name}`],
  ];

  for (const [rows, kind, textFn] of batches) {
    for (const t of rows) {
      const { data: exists } = await sb.from("reminder_log").select("id").eq("task_id", t.id).eq("kind", kind).maybeSingle();
      if (exists) continue;

      const { data: mother } = await sb.from("mothers").select("*").eq("id", t.children.mother_id).single();
      if (!mother) continue;

      const text = textFn(t);
      let delivered = false;

      const title = KIND_TITLES[kind] || "دفتري";

      if (vapidConfigured()) {
        const { data: subs } = await sb.from("push_subscriptions").select("*").eq("mother_id", mother.id);
        for (const sub of subs || []) {
          const ok = await sendPush(sb, sub, { title, body: text, url: "/" });
          if (ok) delivered = true;
        }
      }

      // نرسل للمتصفح والتطبيق معاً: ولي أمر عنده الاثنان يستحق يوصله بالمكانين،
      // ونحن نمنع التكرار بسجل reminder_log مو بتقييد وسيلة واحدة.
      if (await sendToDevices(sb, mother.id, title, text)) delivered = true;

      if (!delivered) continue;
      await sb.from("reminder_log").insert({ mother_id: mother.id, task_id: t.id, kind });
      sent++;
    }
  }

  sent += await sendMemorizationReminders(sb, today);

  return NextResponse.json({ ok: true, sent });
}
