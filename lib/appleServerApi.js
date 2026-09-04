// عميل App Store Server API مشترك — يستخدمه أي مسار يحتاج يتحقق من معاملة
// شراء عند آبل (اشتراك المعلم الذكي، واشتراك التطبيق الشامل لاحقاً).
// مستخرَج من مسار واحد كان يكرّر نفس المنطق — تفرّقهما يعني لو صلّحنا خللاً
// بمكان (زي عنوان الخادم القديم اللي صلّحناه) وننسى المكان الثاني.
//
// العناوين الحالية بتوثيق آبل الرسمي — النطاق القديم "itunes.apple.com"
// كان يُستخدم عند إطلاق الـAPI أول مرة، وآبل نقلت التوثيق للنطاق الحالي
// بدونه. لو بقي القديم، كل تحقق شراء معرّض للفشل.
const APPLE_API = {
  production: "https://api.storekit.apple.com",
  sandbox: "https://api.storekit-sandbox.apple.com",
};

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function appleJwt() {
  const { APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
  if (!APPLE_ISSUER_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: APPLE_KEY_ID, typ: "JWT" };
  const payload = {
    iss: APPLE_ISSUER_ID,
    iat: now,
    exp: now + 600,
    aud: "appstoreconnect-v1",
    bid: "app.reemora.daftary",
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  const { createSign, createPrivateKey } = await import("crypto");
  const key = createPrivateKey(APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"));
  const sign = createSign("SHA256");
  sign.update(data);
  sign.end();
  // آبل تتوقع توقيع ES256 بصيغة IEEE P1363 مو DER
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${data}.${sig.toString("base64url")}`;
}

export async function fetchAppleTransaction(transactionId, env) {
  const jwt = await appleJwt();
  if (!jwt) return { error: "مفاتيح آبل غير مُعدّة بالسيرفر" };

  let res;
  try {
    res = await fetch(`${APPLE_API[env]}/inApps/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
  } catch (e) {
    return { error: `تعذّر الاتصال بآبل: ${e.message}` };
  }
  if (res.status === 404) return { notFound: true };
  if (!res.ok) return { error: `آبل ردّت ${res.status}` };
  return { data: await res.json() };
}

// نجرّب الإنتاج أولاً ثم الاختبار — نفس ما توصي به آبل، لأن بناء TestFlight
// يعطي معاملات بيئة الاختبار.
export async function verifyAppleTransaction(transactionId) {
  let result = await fetchAppleTransaction(transactionId, "production");
  if (result.notFound) result = await fetchAppleTransaction(transactionId, "sandbox");
  return result;
}

// حمولة JWS من آبل: نقرأ الحمولة للحصول على بيانات المعاملة. التوقيع نفسه
// ليس موضع ثقة هنا — الثقة جاية من إن الاستجابة وصلت من خادم آبل بمفتاحنا.
export function decodeAppleJws(signedPayload) {
  const part = String(signedPayload).split(".")[1];
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}
