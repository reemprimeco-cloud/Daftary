import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

// تشفير الرقم السري بـscrypt (مكتبة Node القياسية — بلا تبعية جديدة، بنفس
// روح lib/otp.js). ملح عشوائي لكل رقم سري، مخزّن معه بنفس الحقل بصيغة
// "salt:hash" hex — القياسي لطريقة scrypt اليدوية.
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(String(password), salt, KEY_LEN);
  return `${salt}:${derived.toString("hex")}`;
}

// مقارنة ثابتة الزمن حتى ما نسرّب معلومات عن الرقم الصحيح بفارق التوقيت.
export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = await scryptAsync(String(password), salt, KEY_LEN);
  const expected = Buffer.from(hashHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// الرقم السري: ٤ أرقام أو أحرف على الأقل — بسيط يكفي أم تتذكره، وأي محاولة
// تخمين بلا حد محكومة بقفل الدخول (راجع loginLockout أدناه) لا بطول الرقم.
export function isValidPassword(password) {
  return typeof password === "string" && password.trim().length >= 4;
}

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// حالة القفل الحالية — يُستدعى أول أي محاولة دخول بالرقم السري.
export function loginLockStatus(mother) {
  const until = mother?.login_locked_until ? new Date(mother.login_locked_until) : null;
  if (until && until.getTime() > Date.now()) {
    return { locked: true, minutesLeft: Math.ceil((until.getTime() - Date.now()) / 60000) };
  }
  return { locked: false };
}

// بعد محاولة فاشلة: نحسب القفل الجديد (بعد ٥ محاولات) بدل ما نكتب مباشرة —
// المنادي هو اللي يحفظ بقاعدة البيانات، فهذي دالة نقية قابلة للاختبار بلا DB.
export function nextFailedAttemptState(mother) {
  const attempts = (mother?.failed_login_attempts || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { failed_login_attempts: 0, login_locked_until: new Date(Date.now() + LOCK_MINUTES * 60e3).toISOString() };
  }
  return { failed_login_attempts: attempts, login_locked_until: null };
}
