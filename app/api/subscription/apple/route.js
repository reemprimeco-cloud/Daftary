import { NextResponse } from "next/server";
import { grantPurchase, PRODUCTS } from "@/lib/entitlements";

// التحقق من مشتريات آبل. التطبيق يرسل معرّف المعاملة بعد نجاح الشراء
// بـStoreKit، ونحن نتحقق منه عند آبل قبل المنح — الثقة بما يرسله العميل
// وحده تعني إن أي أحد يقدر يمنح نفسه اشتراكاً.
//
// App Store Server API يحتاج توقيع JWT بمفتاح خاص من App Store Connect:
//   APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (محتوى ملف .p8)
const APPLE_API = {
  production: "https://api.storekit.itunes.apple.com",
  sandbox: "https://api.storekit-sandbox.itunes.apple.com",
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

async function fetchTransaction(transactionId, env) {
  const jwt = await appleJwt();
  if (!jwt) return { error: "مفاتيح آبل غير مُعدّة بالسيرفر" };

  const res = await fetch(`${APPLE_API[env]}/inApps/v1/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) return { error: `آبل ردّت ${res.status}` };
  return { data: await res.json() };
}

// حمولة JWS من آبل: نقرأ الحمولة للحصول على productId. التوقيع نفسه ليس
// موضع ثقة هنا — الثقة جاية من إن الاستجابة وصلت من خادم آبل بمفتاحنا.
function decodeJws(signedPayload) {
  const part = String(signedPayload).split(".")[1];
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { transactionId } = await req.json().catch(() => ({}));
  if (!transactionId) return NextResponse.json({ error: "معرّف المعاملة مطلوب" }, { status: 400 });

  // نجرّب الإنتاج أولاً ثم الاختبار — نفس ما توصي به آبل، لأن بناء
  // TestFlight يعطي معاملات بيئة الاختبار.
  let result = await fetchTransaction(transactionId, "production");
  if (result.notFound) result = await fetchTransaction(transactionId, "sandbox");
  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
  if (result.notFound) return NextResponse.json({ error: "معاملة غير موجودة عند آبل" }, { status: 400 });

  let info;
  try {
    info = decodeJws(result.data.signedTransactionInfo);
  } catch {
    return NextResponse.json({ error: "تعذّرت قراءة بيانات المعاملة" }, { status: 502 });
  }

  if (!PRODUCTS[info.productId]) {
    return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });
  }

  const granted = await grantPurchase({
    motherId,
    platform: "apple",
    productId: info.productId,
    transactionId: String(info.transactionId || transactionId),
    raw: info,
  });
  if (!granted.ok) return NextResponse.json({ error: granted.error }, { status: 400 });

  return NextResponse.json({ ok: true, ...granted });
}
