import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendApns, apnsConfigured } from "@/lib/apns";

// APNs يحتاج HTTP/2 عبر node:http2 — غير متوفر على Edge.
export const runtime = "nodejs";
// المهلة الاختيارية قبل الإرسال (حتى ٨ ثوانٍ) + زمن الاتصال بآبل — نوسّع
// الحد الافتراضي عشان الطلب ما يُقطع قبل ما تكتمل المهلة.
export const maxDuration = 15;

// اختبار إشعارات الجهاز. يرسل لأجهزة صاحب الجلسة فقط — ما يقدر أحد يرسل
// لجهاز غيره، فما نحتاج صلاحية إدارية ويقدر أي ولي أمر يتحقق من جهازه.
//
// نرجّع سبب الفشل الحقيقي كما جاء من آبل بدل رسالة عامة، لأن هذا بالضبط
// اللي نحتاجه للتشخيص: BadDeviceToken غير InvalidProviderToken غير
// انعدام المفاتيح — وكل واحد له علاج مختلف.
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  if (!apnsConfigured()) {
    return NextResponse.json({
      ok: false,
      stage: "config",
      error: "مفاتيح APNs غير مُعدّة بالسيرفر (APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY)",
    }, { status: 503 });
  }

  const sb = supabaseAdmin();
  const { data: devices } = await sb
    .from("device_tokens")
    .select("token, environment, platform, updated_at")
    .eq("mother_id", motherId)
    .eq("platform", "ios");

  if (!devices?.length) {
    return NextResponse.json({
      ok: false,
      stage: "registration",
      error: "ما فيه جهاز مسجّل. افتح التطبيق على الآيفون ووافق على إذن الإشعارات.",
    }, { status: 404 });
  }

  // مهلة اختيارية قبل الإرسال: إشعار يوصل والتطبيق مفتوح قدامك ما يظهر
  // كبانر على iOS افتراضياً (النظام يعتبر التطبيق نشطاً فما يحتاج تنبيه) —
  // فولي الأمر يشوف رسالة «نجح» بالسيرفر بينما الإشعار نفسه ضاع بصمت.
  // المهلة تعطيه وقت يقفل الشاشة قبل ما نرسل فعلياً، فالاختبار يقيس التسليم
  // الحقيقي (تطبيق بالخلفية) بدل حالة لا تحصل بالاستخدام العادي.
  const { delaySeconds } = await req.json().catch(() => ({}));
  const delay = Math.min(Math.max(Number(delaySeconds) || 0, 0), 8);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay * 1000));

  const results = await sendApns(
    devices.map((d) => ({
      token: d.token,
      environment: d.environment,
      title: "دفتري",
      body: "اختبار الإشعارات — وصلك هذا يعني إن التذكيرات شغّالة ✅",
    }))
  );

  // ننظّف الرموز الميتة هنا كمان، عشان الاختبار ما يعيد نفس الفشل كل مرة.
  for (const r of results) {
    if (!r.ok && (r.reason === "BadDeviceToken" || r.reason === "Unregistered")) {
      await sb.from("device_tokens").delete().eq("token", r.token);
    } else if (r.ok) {
      await sb.from("device_tokens")
        .update({ environment: r.environment, last_error: null }).eq("token", r.token);
    }
  }

  const delivered = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: delivered > 0,
    stage: "send",
    devices: devices.length,
    delivered,
    // الرمز نفسه سر — نعرض أوله فقط للتمييز بين جهازين
    results: results.map((r) => ({
      token: `${r.token.slice(0, 8)}…`,
      ok: r.ok,
      reason: r.reason || null,
      environment: r.environment,
    })),
  });
}
