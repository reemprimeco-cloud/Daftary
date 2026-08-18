import crypto from "crypto";

// جلسة موقّعة بدون قاعدة بيانات: نوقّع معرّف ولي الأمر بمفتاح السيرفر، ونخزّن
// النتيجة بالجهاز. الجلسة ما لها انتهاء — تبقى شغالة لين تسجّل خروج، وهذا
// المطلوب: ولي الأمر ما يعيد التحقق كل مرة.
//
// المفتاح إجباري: بدونه أي أحد يقدر يزوّر جلسة، فنرمي خطأ بدل ما نشتغل بمفتاح
// افتراضي ضعيف.
function secret() {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) {
    throw new Error("SESSION_SECRET غير مضبوط بالسيرفر (يحتاج ٣٢ حرف على الأقل)");
  }
  return key;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(motherId) {
  const payload = Buffer.from(JSON.stringify({ mid: motherId, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// ترجّع معرّف ولي الأمر لو التوقيع سليم، وإلا null.
export function readSessionToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }

  // مقارنة ثابتة الزمن حتى ما نسرّب معلومات عن التوقيع الصحيح
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).mid || null;
  } catch {
    return null;
  }
}

// تتحقق أن الطلب جاي من صاحب الحساب فعلاً. نقرأ الجلسة من ترويسة Authorization
// ونقارنها بالـ motherId المطلوب.
export function motherIdFromRequest(req) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return readSessionToken(header.slice(7));
}
