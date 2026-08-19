// تكامل Twilio Verify — نستدعي REST مباشرة بدل حزمة twilio عشان ما نضيف
// تبعية ثقيلة لثلاث نداءات بسيطة، وعشان تشتغل على Edge/Node بدون إعداد.

const TWILIO_BASE = "https://verify.twilio.com/v2/Services";

// الكويت: نقبل ٨ أرقام مع أو بدون +965، ونرجّع الصيغة الدولية اللي يبيها Twilio.
export function normalizeKuwaitPhone(input) {
  const digits = String(input || "").replace(/[^\d]/g, "");
  if (/^965\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\d{8}$/.test(digits)) return `+965${digits}`;
  return null;
}

// رقم ثابت لمراجعة آبل — يتجاوز Twilio ويقبل كود ثابت. لازم يُضبط بمتغيرات
// البيئة، وما ينفع يشتغل بدونهم عشان ما نفتح باب خلفي بالغلط.
export function isReviewPhone(e164) {
  const review = normalizeKuwaitPhone(process.env.APPLE_REVIEW_PHONE || "");
  return !!review && !!process.env.APPLE_REVIEW_CODE && e164 === review;
}

export function isReviewCode(code) {
  const expected = process.env.APPLE_REVIEW_CODE;
  return !!expected && String(code).trim() === expected;
}

// Twilio يعيد استخدام أي تحقق معلّق لنفس الرقم بدل ما يولّد كود جديد — يعني
// «إعادة الإرسال» ما توصّل شي جديد والمستخدمة تحس إن الزر معطّل. نلغي المعلّق
// أول عشان الطلب الجديد يولّد كود فعلاً. لو ما فيه معلّق نتجاهل الخطأ بهدوء.
export async function cancelPendingVerification(to) {
  try {
    await twilioVerify(`Verifications/${encodeURIComponent(to)}`, { Status: "canceled" });
  } catch {
    // 404 = ما فيه تحقق معلّق، وهذي الحالة الطبيعية بأول إرسال
  }
}

export async function twilioVerify(resource, params) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !service) {
    throw new Error("إعدادات Twilio ناقصة بالسيرفر");
  }

  const res = await fetch(`${TWILIO_BASE}/${service}/${resource}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Twilio ${res.status}`);
    err.twilioCode = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}
