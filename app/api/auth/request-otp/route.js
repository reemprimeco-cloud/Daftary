import { NextResponse } from "next/server";
import { cancelPendingVerification, isReviewPhone, maskPhone, normalizeKuwaitPhone, twilioVerify } from "@/lib/otp";
import { alertAdmin } from "@/lib/opsAlert";

// إرسال كود التحقق على واتساب، مع تحويل تلقائي لرسالة نصية لو ما وصل واتساب
// (المستخدمة ما عندها واتساب، أو التسليم فشل). Twilio Verify يتكفّل بتوليد
// الكود وانتهاء صلاحيته وحد المحاولات — ما نخزّن أي كود عندنا.
export async function POST(req) {
  let phone, resend;
  try {
    ({ phone, resend } = await req.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const to = normalizeKuwaitPhone(phone);
  if (!to) {
    return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 });
  }

  // رقم مراجعة آبل: ما نرسل شي، الكود ثابت من إعدادات السيرفر. بدون هذا المخرج
  // المراجع ما يقدر يدخل التطبيق أصلاً (سبب رفض تحت قاعدة 2.1).
  if (isReviewPhone(to)) {
    return NextResponse.json({ ok: true, channel: "review" });
  }

  // عند إعادة الإرسال نلغي المعلّق عشان يتولّد كود جديد بدل تكرار القديم
  if (resend) await cancelPendingVerification(to);

  try {
    const verification = await twilioVerify("Verifications", {
      To: to,
      Channel: "whatsapp",
      // لو واتساب ما وصل، Twilio ينزّل نفس الكود برسالة نصية تلقائياً
      "ChannelConfiguration.whatsapp.enabled": "true",
      "ChannelConfiguration.sms.enabled": "true",
    });
    return NextResponse.json({ ok: true, channel: verification.channel || "whatsapp" });
  } catch (e) {
    // 60203 = تجاوزت حد الإرسال (٥ مرات لكل رقم خلال ١٠ دقائق)
    // الحالات الفردية ما ترفع تنبيهاً — هي مشكلة رقم واحد مو عطل عام —
    // بس نسجّلها عشان لو اتصلت أم تقول «ما يوصلني الكود» نعرف وش صار
    // معها بالضبط. console.log مو error عشان ما تختلط بالأعطال الحقيقية.
    if (e.twilioCode === 60203) {
      console.log("otp rate-limited:", maskPhone(to));
      return NextResponse.json(
        { error: "طلبتِ الكود مرات كثيرة. انتظري ١٠ دقائق وحاولي مرة ثانية." },
        { status: 429 }
      );
    }
    if (e.twilioCode === 60410 || e.twilioCode === 60200) {
      console.log("otp undeliverable:", maskPhone(to), e.twilioCode);
      return NextResponse.json({ error: "ما قدرنا نرسل الكود لهذا الرقم. تأكدي منه وحاولي مرة ثانية." }, { status: 400 });
    }
    // عطل يصيب الجميع مو مستخدمة وحدة: رصيد خلص، حساب موقوف، مفاتيح غلط.
    // بلا تنبيه يبقى التسجيل مقفلاً على كل الناس لين تلاحظه صاحبة التطبيق
    // بالصدفة (صار فعلاً: ١١ ساعة ونصف، ٢٦ مستخدمة). ننتظر الإرسال عشان
    // بيئة السيرفر تقدر توقف العمل الخلفي بعد رد الطلب.
    console.error("request-otp failed:", maskPhone(to), e.twilioCode || "", e.message);
    await alertAdmin(
      "otp_send_failed",
      "⚠️ التسجيل معطّل بدفتري",
      "فشل إرسال رمز التحقق — ما فيه أحد يقدر يسجّل دخول. تحققي من حساب Twilio (الرصيد أو حالة الحساب).",
      { detail: `${e.twilioCode || ""} ${e.message || ""}`.trim() }
    );
    return NextResponse.json({ error: "تعذّر إرسال الكود، حاولي بعد شوي." }, { status: 502 });
  }
}
