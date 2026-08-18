import { NextResponse } from "next/server";
import { isReviewPhone, normalizeKuwaitPhone, twilioVerify } from "@/lib/otp";

// إرسال كود التحقق على واتساب، مع تحويل تلقائي لرسالة نصية لو ما وصل واتساب
// (المستخدمة ما عندها واتساب، أو التسليم فشل). Twilio Verify يتكفّل بتوليد
// الكود وانتهاء صلاحيته وحد المحاولات — ما نخزّن أي كود عندنا.
export async function POST(req) {
  let phone;
  try {
    ({ phone } = await req.json());
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
    if (e.twilioCode === 60203) {
      return NextResponse.json(
        { error: "طلبتِ الكود مرات كثيرة. انتظري ١٠ دقائق وحاولي مرة ثانية." },
        { status: 429 }
      );
    }
    if (e.twilioCode === 60410 || e.twilioCode === 60200) {
      return NextResponse.json({ error: "ما قدرنا نرسل الكود لهذا الرقم. تأكدي منه وحاولي مرة ثانية." }, { status: 400 });
    }
    console.error("request-otp failed:", e.twilioCode || "", e.message);
    return NextResponse.json({ error: "تعذّر إرسال الكود، حاولي بعد شوي." }, { status: 502 });
  }
}
