import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import webpush from "web-push";

async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

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

const KIND_TITLES = {
  exam_day_before: "تذكير اختبار غداً",
  exam_today: "اختبار اليوم",
  new_task: "واجب جديد",
};

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

  let sent = 0;
  const batches = [
    [examsTomorrow || [], "exam_day_before", (t) => `⏰ تذكير: اختبار ${t.subject} لـ ${t.children.name} غداً — وقت المذاكرة 📚`],
    [examsToday || [], "exam_today", (t) => `⏰ اليوم اختبار ${t.subject} لـ ${t.children.name} — بالتوفيق 🌟`],
    [freshTasks || [], "new_task", (t) => `📝 واجب جديد لـ ${t.children.name}: ${t.subject} (${t.type}) — الموعد ${t.due_date}`],
  ];

  for (const [rows, kind, textFn] of batches) {
    for (const t of rows) {
      const { data: exists } = await sb.from("reminder_log").select("id").eq("task_id", t.id).eq("kind", kind).maybeSingle();
      if (exists) continue;

      const { data: mother } = await sb.from("mothers").select("*").eq("id", t.children.mother_id).single();
      if (!mother) continue;

      const text = textFn(t);
      let delivered = false;

      if (mother.telegram_chat_id) {
        await sendTelegram(mother.telegram_chat_id, text);
        delivered = true;
      }

      if (vapidConfigured()) {
        const { data: subs } = await sb.from("push_subscriptions").select("*").eq("mother_id", mother.id);
        for (const sub of subs || []) {
          const ok = await sendPush(sb, sub, { title: KIND_TITLES[kind] || "دفتري", body: text, url: "/" });
          if (ok) delivered = true;
        }
      }

      if (!delivered) continue;
      await sb.from("reminder_log").insert({ mother_id: mother.id, task_id: t.id, kind });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
