import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { sendApns, apnsConfigured } from "@/lib/apns";
import webpush from "web-push";

// APNs يحتاج HTTP/2 عبر node:http2 — غير متوفر على Edge.
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

function vapidConfigured() {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_SUBJECT);
}

function cleanVapidKey(key) {
  return (key || "").trim().replace(/[^A-Za-z0-9\-_]/g, "");
}

// إشعار عام لكل المستخدمين — للإعلانات اللي ما ترتبط بواجب أو اختبار
// معيّن، مثل بدء التجربة المجانية قبل تطبيق الرسوم. ما يمر على
// reminder_log لأنه مو تذكيراً مرتبطاً بمهمة، فالتكرار مسؤولية المرسِل:
// نرجّع عدد من وصلهم عشان ما يُرسل مرتين بالغلط.
export async function POST(req) {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { title, body } = await req.json().catch(() => ({}));
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "العنوان والنص مطلوبان" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  let apnsDelivered = 0;
  let webDelivered = 0;
  const failures = {};

  // ————— أجهزة التطبيق —————
  if (apnsConfigured()) {
    const { data: devices } = await sb.from("device_tokens").select("token, environment").eq("platform", "ios");
    if (devices?.length) {
      const results = await sendApns(
        devices.map((d) => ({ token: d.token, environment: d.environment, title, body }))
      );
      for (const r of results) {
        if (r.ok) {
          apnsDelivered++;
          await sb.from("device_tokens").update({ environment: r.environment, last_error: null }).eq("token", r.token);
        } else if (r.reason === "BadDeviceToken" || r.reason === "Unregistered") {
          // رمز ميت (حُذف التطبيق أو أُلغي الإذن) — نمسحه بدل ما نعيد
          // المحاولة عليه بكل إعلان
          await sb.from("device_tokens").delete().eq("token", r.token);
          failures[r.reason] = (failures[r.reason] || 0) + 1;
        } else {
          failures[r.reason || "unknown"] = (failures[r.reason || "unknown"] || 0) + 1;
        }
      }
    }
  }

  // ————— متصفحات الويب —————
  if (vapidConfigured()) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT.trim(),
      cleanVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      cleanVapidKey(process.env.VAPID_PRIVATE_KEY)
    );
    const { data: subs } = await sb.from("push_subscriptions").select("*");
    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: "/" })
        );
        webDelivered++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("id", sub.id);
        }
        failures[`web_${err.statusCode || "error"}`] = (failures[`web_${err.statusCode || "error"}`] || 0) + 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    delivered: apnsDelivered + webDelivered,
    apns: apnsDelivered,
    web: webDelivered,
    failures,
  });
}
