// التحقق من مشتريات Google Play عبر Android Publisher API.
//
// نحتاج حساب خدمة (service account) من Google Cloud، مربوط بحسابك في Play
// Console بصلاحية قراءة الطلبات المالية. محتوى ملف JSON كامل بمتغيّر واحد:
//   GOOGLE_PLAY_SERVICE_ACCOUNT  (نص JSON)
const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const PACKAGE_NAME = "app.reemora.daftary";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function serviceAccount() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error("GOOGLE_PLAY_SERVICE_ACCOUNT ليس JSON صالحاً");
    return null;
  }
}

// توكن وصول من جوجل بتوقيع JWT بمفتاح حساب الخدمة (RS256).
// نخزّنه بالذاكرة لين ينتهي — كل طلب تحقق ما يحتاج جولة إضافية لجوجل.
let cachedToken = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const sa = serviceAccount();
  if (!sa?.client_email || !sa?.private_key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const { createSign, createPrivateKey } = await import("crypto");
  const key = createPrivateKey(sa.private_key.replace(/\\n/g, "\n"));
  const sign = createSign("RSA-SHA256");
  sign.update(data);
  sign.end();
  const jwt = `${data}.${sign.sign(key).toString("base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    console.error("google token error:", body);
    return null;
  }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function call(path) {
  const token = await accessToken();
  if (!token) return { error: "مفاتيح Google Play غير مُعدّة بالسيرفر" };

  const res = await fetch(`${API_BASE}/applications/${PACKAGE_NAME}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) {
    const text = await res.text();
    console.error("google play api error:", res.status, text);
    return { error: `جوجل ردّت ${res.status}` };
  }
  return { data: await res.json() };
}

// الاشتراكات: subscriptionsv2 مفتاحه التوكن وحده، والمنتج يجي داخل lineItems.
export async function getSubscriptionPurchase(purchaseToken) {
  const r = await call(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  if (r.error || r.notFound) return r;

  const d = r.data;
  const line = (d.lineItems || [])[0] || {};
  const active = d.subscriptionState === "SUBSCRIPTION_STATE_ACTIVE"
    || d.subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";

  return {
    data: {
      productId: line.productId,
      active,
      state: d.subscriptionState,
      expiresAt: line.expiryTime || null,
      accountId: d.externalAccountIdentifiers?.obfuscatedExternalAccountId || null,
      // ما فيه معرّف طلب بهذا الرد، والتوكن نفسه فريد لكل عملية شراء —
      // فنستخدمه لمنع منح نفس الشراء مرتين.
      transactionId: purchaseToken,
    },
  };
}

// المنتجات الاستهلاكية (الرصيد الإضافي): purchaseState = 0 يعني مدفوع.
export async function getProductPurchase(productId, purchaseToken) {
  const r = await call(
    `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
  );
  if (r.error || r.notFound) return r;

  const d = r.data;
  return {
    data: {
      productId: d.productId || productId,
      active: d.purchaseState === 0,
      state: String(d.purchaseState),
      expiresAt: null,
      accountId: d.obfuscatedExternalAccountId || null,
      transactionId: d.orderId || purchaseToken,
    },
  };
}
