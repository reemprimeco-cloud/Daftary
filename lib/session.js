// جلسة موقّعة بدون قاعدة بيانات: نوقّع معرّف ولي الأمر بمفتاح السيرفر، ونخزّن
// النتيجة بالجهاز. الجلسة ما لها انتهاء — تبقى شغالة لين تسجّل خروج.
//
// نستخدم WebCrypto مو crypto من Node، لأن الـ middleware يشتغل على Edge runtime
// وما عنده وحدة crypto. WebCrypto متوفرة على Edge وNode معاً، فنفس الملف يخدم
// المكانين. (جرّبناها بـ node:crypto أول مرة وكانت كل جلسة صحيحة تنرفض بصمت.)

function secret() {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) {
    throw new Error("SESSION_SECRET غير مضبوط بالسيرفر (يحتاج ٣٢ حرف على الأقل)");
  }
  return key;
}

function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(payload) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload));
  return b64url(sig);
}

export async function createSessionToken(motherId) {
  const json = JSON.stringify({ mid: motherId, iat: Date.now() });
  const payload = b64url(new TextEncoder().encode(json));
  return `${payload}.${await sign(payload)}`;
}

// ترجّع معرّف ولي الأمر لو التوقيع سليم، وإلا null.
export async function readSessionToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected;
  try {
    expected = await sign(payload);
  } catch {
    return null;
  }

  // مقارنة ثابتة الزمن حتى ما نسرّب معلومات عن التوقيع الصحيح
  if (signature.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(payload))).mid || null;
  } catch {
    return null;
  }
}
