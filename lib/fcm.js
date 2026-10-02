import { createSign, createPrivateKey } from "node:crypto";

// إرسال إشعارات أندرويد عبر Firebase Cloud Messaging (HTTP v1 API).
//
// نفس أسلوب lib/apns.js: بلا SDK ثقيل (firebase-admin)، توقيع JWT يدوي
// بمفتاح حساب الخدمة (service account) وتبادله بتوكن وصول مؤقت، ثم نداء
// REST مباشر. الفرق عن APNs إن FCM يحتاج خطوة تبادل OAuth2 أول (آبل تاخذ
// مفتاح التوقيع مباشرة بدون تبادل).
//
// FIREBASE_SERVICE_ACCOUNT_JSON = محتوى ملف JSON الكامل لحساب الخدمة
// (Firebase Console → Project settings → Service accounts → Generate new
// private key) — يُلصق كسطر واحد بمتغيرات البيئة.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function fcmConfigured() {
  const sa = serviceAccount();
  return !!(sa?.client_email && sa?.private_key && sa?.project_id);
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

// توكن وصول Google ساري ساعة — نخزّنه ونجدده بعد ٥٠ دقيقة، نفس أسلوب
// APNs JWT، عشان ما نسوي تبادل OAuth2 كامل مع كل إشعار.
let cachedToken = null;

async function accessToken() {
  if (cachedToken && Date.now() - cachedToken.at < 50 * 60_000) return cachedToken.value;
  const sa = serviceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const key = createPrivateKey(sa.private_key.replace(/\\n/g, "\n"));
  const sign = createSign("RSA-SHA256");
  sign.update(data);
  sign.end();
  const jwt = `${data}.${sign.sign(key).toString("base64url")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) return null;

  cachedToken = { value: json.access_token, at: Date.now() };
  return cachedToken.value;
}

async function sendOne(projectId, token, bearer, { token: deviceToken, title, body }) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
      },
    }),
  });
  if (res.status === 200) return { token: deviceToken, ok: true };

  const data = await res.json().catch(() => ({}));
  // FCM يرجّع رمز الخطأ بحقل error.status، مثل UNREGISTERED لو الرمز ما
  // عاد صالح (حُذف التطبيق أو أُلغي الإذن) — نفس معنى BadDeviceToken بآبل.
  const reason = data?.error?.status || `HTTP_${res.status}`;
  return { token: deviceToken, ok: false, reason };
}

// نرسل كل الرسائل على توكن وصول واحد (مو توكن لكل رسالة)، وبالتوازي —
// FCM v1 ما يدعم إرسال دفعة واحدة لعدة أجهزة بنداء وحد (خلاف الـlegacy
// API)، فلازم نداء REST مستقل لكل جهاز.
export async function sendFcm(messages) {
  const sa = serviceAccount();
  const bearer = await accessToken();
  if (!sa || !bearer) {
    return messages.map((m) => ({ token: m.token, ok: false, reason: "FCM_NOT_CONFIGURED" }));
  }
  return Promise.all(messages.map((m) => sendOne(sa.project_id, m.token, bearer, m)));
}
