import { NextResponse } from "next/server";
import { cancelPendingVerification, isReviewPhone, maskPhone, normalizeKuwaitPhone, twilioVerify } from "@/lib/otp";
import { alertAdmin } from "@/lib/opsAlert";
import { supabaseAdmin } from "@/lib/supabase";

// إرسال كود التحقق على واتساب، مع تحويل تلقائي لرسالة نصية لو ما وصل واتساب
// (المستخدمة ما عندها واتساب، أو التسليم فشل). Twilio Verify يتكفّل بتوليد
// الكود وانتهاء صلاحيته وحد المحاولات — ما نخزّن أي كود عندنا.
export async function POST(req) {
  let phone, resend, bypassPassword;
  try {
    ({ phone, resend, bypassPassword } = await req.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const to = normalizeKuwaitPhone(phone);
  if (!to) {
    return NextResponse.json({ error: "رقم الموبايل غير صحيح" }, { status: 400 });
  }

  // رقم مراجعة آبل: ما نرسل شي، الكود ثابت من إعدادات السيرفر. بدون هذا المخرج
  // المراجع ما يقدر يدخل التطبيق أصلاً (سبب رفض تحت قاعدة 2.1).
  if (isReviewPhone(to)) {
    return NextResponse.json({ ok: true, channel: "review" });
  }

  // رقم سبق أن حدّد رقماً سرياً: ندخلها بالجوال + الرقم السري بلا كود ولا
  // تكلفة Twilio — إلا لو طلبت صراحةً «نسيت الرقم السري» (bypassPassword).
  // الكود يبقى إلزامياً مرة واحدة فقط لكل رقم لمنع حسابات وهمية تستهلك
  // التجربة المجانية (راجع CLAUDE.md، قرار ١٦ سبتمبر).
  if (!bypassPassword) {
    const { data: mother } = await supabaseAdmin().from("mothers").select("password_hash").eq("phone", to).maybeSingle();
    if (mother?.password_hash) {
      return NextResponse.json({ ok: true, channel: "password" });
    }
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
    // 60245 = تجاوز حد الرسائل على مستوى الحساب/الخدمة (مو رقم واحد) —
    // يظهر تحديداً بيوم حملة لما يسجّل مئات بنفس الساعة. الأم ما تقدر تسوي
    // شي، لكن صاحبة التطبيق تقدر ترفع الحد من Twilio. فنقول لكل طرف الي
    // يخصه، وننبّه بنوع مستقل عشان ما يختلط بعطل الرصيد.
    // و20429 = تجاوز عدد الطلبات المتزامنة على واجهة Twilio — نفس السبب
    // (ازدحام لحظي) ونفس المعالجة.
    if (e.twilioCode === 60245 || e.twilioCode === 20429) {
      console.error("otp account limit hit:", maskPhone(to));
      await alertAdmin(
        "otp_limit",
        "⚠️ Twilio أوقف الإرسال: تجاوز الحد",
        "الحملة تجاوزت حد رسائل Verify (خطأ 60245). ارفعي الحد من إعدادات خدمة Verify أو تواصلي مع دعم Twilio فوراً.",
        { detail: e.message || "", cooldownMinutes: 15 }
      );
      return NextResponse.json(
        { error: "ضغط عالي على التسجيل هاللحظة. انتظري دقيقة وحاولي مرة ثانية." },
        { status: 503 }
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
