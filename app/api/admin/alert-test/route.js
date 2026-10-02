import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { alertAdmin } from "@/lib/opsAlert";

// APNs يحتاج HTTP/2 عبر node:http2 — غير متوفر على Edge.
export const runtime = "nodejs";

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

// تجربة تنبيه العطل. التنبيه الحقيقي ما ينطلق إلا وقت عطل فعلي، فبدون هذا
// الزر ما فيه طريقة نتأكد إنه مضبوط إلا يوم ما نحتاجه — وهذا أسوأ وقت
// نكتشف فيه إن المتغيّر ناقص أو الرمز ميت.
export async function POST() {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  // نوع منفصل ومهلة صفر: التجربة ما تستهلك فترة تهدئة التنبيه الحقيقي،
  // فلو صار عطل بعد التجربة بدقيقة يوصل تنبيهه عادي.
  const result = await alertAdmin(
    "otp_send_failed_test",
    "🔔 تجربة تنبيه الأعطال",
    "هذي تجربة. وقت العطل الحقيقي بيوصلك نفس الإشعار بنص يقول إن التسجيل معطّل.",
    { cooldownMinutes: 0, detail: "manual test" }
  );

  if (result.ok) return NextResponse.json({ ok: true });

  // نترجم السبب التقني لخطوة واضحة تقدر تسويها — «فشل» وحدها ما تفيد.
  const why = {
    "not configured": "المتغيّر ADMIN_ALERT_PHONE ناقص بإعدادات Vercel (أو مفاتيح آبل ناقصة). أضيفيه ثم أعيدي النشر.",
    "admin account not found": "الرقم المكتوب بـADMIN_ALERT_PHONE ما له حساب بدفتري. تأكدي إنه نفس رقم حسابك.",
    "no device": "حسابك ما عنده جهاز مسجّل للإشعارات. افتحي التطبيق على موبايلك واسمحي بالإشعارات، ثم جربي مرة ثانية.",
    error: "صار خطأ غير متوقع — راجعي سجلات Vercel.",
  }[result.reason] || `تعذّر الإرسال (${result.reason || "سبب غير معروف"}).`;

  return NextResponse.json({ error: why }, { status: 400 });
}
