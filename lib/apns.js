import http2 from "node:http2";
import { createSign, createPrivateKey } from "node:crypto";

// إرسال إشعارات آبل (APNs).
//
// APNs تقبل HTTP/2 فقط — fetch بـNode ما يدعمه، فنستخدم node:http2 مباشرة.
// ولهذا لازم يشتغل هذا الملف على Node runtime مو Edge.
//
// المفاتيح مختلفة عن مفاتيح App Store Server API (مفاتيح المشتريات):
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY  ← مفتاح APNs Auth Key (.p8)
const HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};
const BUNDLE_ID = "app.reemora.daftary";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function apnsConfigured() {
  return !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);
}

// آبل تمنع توليد التوكن أكثر من مرة كل ٢٠ دقيقة وترد 403 لو تجاوزناها،
// فنخزّنه ونعيد استخدامه (صالح ساعة، نجدده بعد ٥٠ دقيقة).
let cachedJwt = null;

function apnsJwt() {
  if (cachedJwt && Date.now() - cachedJwt.at < 50 * 60_000) return cachedJwt.value;
  if (!apnsConfigured()) return null;

  const header = { alg: "ES256", kid: process.env.APNS_KEY_ID, typ: "JWT" };
  const claims = { iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const key = createPrivateKey(process.env.APNS_PRIVATE_KEY.replace(/\\n/g, "\n"));
  const sign = createSign("SHA256");
  sign.update(data);
  sign.end();
  // آبل تتوقع ES256 بصيغة IEEE P1363 مو DER — نفس فخ مسار المشتريات
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" });

  cachedJwt = { value: `${data}.${sig.toString("base64url")}`, at: Date.now() };
  return cachedJwt.value;
}

function requestOnce(client, token, jwt, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });

    let status = 0;
    let data = "";
    req.on("response", (headers) => { status = headers[":status"]; });
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      if (status === 200) return resolve({ ok: true });
      let reason = "";
      try { reason = JSON.parse(data).reason || ""; } catch { reason = data.slice(0, 120); }
      resolve({ ok: false, status, reason });
    });
    req.on("error", (e) => resolve({ ok: false, status: 0, reason: e.message }));
    req.setTimeout(10_000, () => { req.close(); resolve({ ok: false, status: 0, reason: "timeout" }); });

    req.end(body);
  });
}

function connect(env) {
  return new Promise((resolve, reject) => {
    const client = http2.connect(HOSTS[env]);
    client.once("error", reject);
    client.once("connect", () => resolve(client));
  });
}

// نرسل دفعة على اتصال واحد لكل بيئة بدل اتصال لكل إشعار — فتح اتصال HTTP/2
// جديد لكل رسالة يضاعف الزمن ويستنزف حصة الاتصالات عند آبل.
//
// الرمز المسجّل ببيئة غلط يرد BadDeviceToken، فنعيد المحاولة بالبيئة الثانية
// ونرجّع البيئة اللي نجحت عشان تُحفظ ولا نكرر التخمين كل مرة.
export async function sendApns(messages) {
  const jwt = apnsJwt();
  if (!jwt) return messages.map((m) => ({ token: m.token, ok: false, reason: "APNS_NOT_CONFIGURED" }));

  const clients = {};
  const clientFor = async (env) => {
    if (!clients[env]) clients[env] = await connect(env).catch(() => null);
    return clients[env];
  };

  const results = [];
  for (const m of messages) {
    const payload = {
      aps: {
        alert: { title: m.title, body: m.body },
        sound: "default",
        badge: m.badge ?? undefined,
      },
      url: m.url || "/",
    };

    const order = m.environment === "sandbox" ? ["sandbox", "production"] : ["production", "sandbox"];
    let result = { ok: false, reason: "no_client" };
    let usedEnv = order[0];

    for (const env of order) {
      const client = await clientFor(env);
      if (!client) { result = { ok: false, reason: "connect_failed" }; continue; }
      result = await requestOnce(client, m.token, jwt, payload);
      usedEnv = env;
      // نجرّب البيئة الثانية فقط لو الرمز مرفوض لأنه من بيئة غيرها
      if (result.ok || result.reason !== "BadDeviceToken") break;
    }

    results.push({ token: m.token, ok: result.ok, reason: result.reason, environment: usedEnv });
  }

  for (const c of Object.values(clients)) c?.close();
  return results;
}
