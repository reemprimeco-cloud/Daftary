// عميل Tap Payments — الدفع بالبطاقة على الويب فقط.
// داخل تطبيق آيفون الدفع يمر عبر آبل إلزامياً (بند 3.1.1)، والفصل بينهما
// مطبّق بالواجهة وبمسار الإنشاء.
const TAP_API_BASE = "https://api.tap.company/v2";

function tapHeaders() {
  if (!process.env.TAP_SECRET_KEY) throw new Error("TAP_SECRET_KEY غير معرّف بمتغيرات البيئة");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`,
  };
}

export async function createTapCharge({
  amount, description, motherName, motherPhone, redirectUrl, postUrl, metadata,
}) {
  const res = await fetch(`${TAP_API_BASE}/charges`, {
    method: "POST",
    headers: tapHeaders(),
    body: JSON.stringify({
      amount,
      currency: "KWD",
      threeDSecure: true,
      save_card: false,
      description,
      statement_descriptor: "Daftary",
      metadata,
      reference: { order: metadata.motherId },
      receipt: { email: false, sms: false },
      customer: {
        first_name: motherName,
        phone: { country_code: "965", number: (motherPhone || "").replace(/^\+?965/, "") },
      },
      source: { id: "src_all" },
      redirect: { url: redirectUrl },
      post: { url: postUrl },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.errors?.[0]?.description || data?.message || "تعذّر إنشاء عملية الدفع");
  }
  return data;
}

export async function getTapCharge(chargeId) {
  const res = await fetch(`${TAP_API_BASE}/charges/${chargeId}`, {
    method: "GET",
    headers: tapHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "تعذّر التحقق من حالة الدفع");
  return data;
}
