import webpush from "web-push";
import { sendApns, apnsConfigured } from "@/lib/apns";

// إيصال إشعار لولي أمر عبر كل وسائله (متصفح + تطبيق آبل). كان هذا كله داخل
// كرون التذكيرات؛ صار مشتركاً لأن التذكير المسائي اليومي يحتاجه كذلك.

// ننفّذ على دفعات متوازية بدل واحد واحد. الحد ٢٠ يختصر الوقت لجزء من
// عشرين، وبنفس الوقت ما يفتح مئات الاتصالات المتزامنة على Supabase وAPNs.
export const CONCURRENCY = 20;
export async function mapPool(items, limit, fn) {
  const list = [...items];
  const results = [];
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (list.length) {
      const item = list.shift();
      results.push(await fn(item));
    }
  });
  await Promise.all(workers);
  return results;
}

export function vapidConfigured() {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_SUBJECT);
}

// ننظّف مفاتيح VAPID من أي محارف مو من أبجدية base64url — مسافات أو محارف
// اتجاه غير مرئية ممكن تنلصق بالقيمة عند نسخها ولصقها بإعدادات Vercel.
function cleanVapidKey(key) {
  return (key || "").trim().replace(/[^A-Za-z0-9\-_]/g, "");
}

export function configureWebPush() {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT.trim(),
    cleanVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    cleanVapidKey(process.env.VAPID_PRIVATE_KEY)
  );
  return true;
}

export async function sendPush(sb, sub, payload) {
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
export async function sendToDevices(sb, motherId, title, body) {
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

// نرسل للمتصفح والتطبيق معاً: ولي أمر عنده الاثنان يستحق يوصله بالمكانين،
// ومنع التكرار مسؤولية المنادي بسجل reminder_log مو بتقييد وسيلة واحدة.
export async function deliverToMother(sb, motherId, title, body) {
  let delivered = false;
  if (vapidConfigured()) {
    const { data: subs } = await sb.from("push_subscriptions").select("*").eq("mother_id", motherId);
    const oks = await Promise.all((subs || []).map((sub) => sendPush(sb, sub, { title, body, url: "/" })));
    if (oks.some(Boolean)) delivered = true;
  }
  if (await sendToDevices(sb, motherId, title, body)) delivered = true;
  return delivered;
}
