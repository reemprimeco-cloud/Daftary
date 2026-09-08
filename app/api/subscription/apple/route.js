import { NextResponse } from "next/server";
import { grantPurchase, PRODUCTS } from "@/lib/entitlements";
import { verifyAppleTransaction, decodeAppleJws } from "@/lib/appleServerApi";

// التحقق من مشتريات آبل لاشتراك المعلم الذكي. التطبيق يرسل معرّف المعاملة
// بعد نجاح الشراء بـStoreKit، ونحن نتحقق منه عند آبل قبل المنح — الثقة
// بما يرسله العميل وحده تعني إن أي أحد يقدر يمنح نفسه اشتراكاً.
export async function POST(req) {
  try {
    return await handleVerify(req);
  } catch (e) {
    console.error("subscription/apple unexpected error:", e);
    return NextResponse.json({ error: "خطأ غير متوقع بالتحقق من الشراء" }, { status: 500 });
  }
}

async function handleVerify(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  // الشراء يُنسب لطالب/ة محدد — الاستحقاق لكل طالب/ة مو لولي الأمر.
  const { transactionId, childId } = await req.json().catch(() => ({}));
  if (!transactionId) return NextResponse.json({ error: "معرّف المعاملة مطلوب" }, { status: 400 });
  if (!childId) return NextResponse.json({ error: "لازم تختارين الطالب/ة قبل الشراء" }, { status: 400 });

  const result = await verifyAppleTransaction(transactionId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
  if (result.notFound) return NextResponse.json({ error: "معاملة غير موجودة عند آبل" }, { status: 400 });

  let info;
  try {
    info = decodeAppleJws(result.data.signedTransactionInfo);
  } catch {
    return NextResponse.json({ error: "تعذّرت قراءة بيانات المعاملة" }, { status: 502 });
  }

  if (!PRODUCTS[info.productId]) {
    return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });
  }

  // معاملة مستردّة أو ملغاة ما تمنح رصيداً — بدون هالفحص يقدر أحد يشتري،
  // يطلب استرجاع من آبل، ويحتفظ برصيده.
  if (info.revocationDate) {
    return NextResponse.json({ error: "هذه المعاملة مستردّة" }, { status: 400 });
  }

  // اشتراك منتهي ما يُمنح (يصير مهماً بالاستعادة، لأنها ترجّع معاملات قديمة).
  // expiresDate بميلي ثانية منذ epoch — نفس وحدة Date.now()، فالمقارنة مباشرة.
  if (PRODUCTS[info.productId].kind === "subscription" && info.expiresDate && info.expiresDate < Date.now()) {
    return NextResponse.json({ error: "هذا الاشتراك منتهي" }, { status: 400 });
  }

  // التطبيق يمرر معرّف ولي الأمر كـappAccountToken وقت الشراء، فنتأكد إن
  // المعاملة تخص صاحب الجلسة. نشترط وجوده مو نتساهل عن غيابه: معاملة بلا
  // توكن تعني إننا نقبل رقم معاملة أي شخص ثاني لو وصل لأحد، ونحرق الرقم
  // على صاحبه الحقيقي بنفس الوقت (القيد الفريد يمنع منحه مرتين).
  const token = info.appAccountToken;
  if (!token || token.toLowerCase() !== String(motherId).toLowerCase()) {
    return NextResponse.json({ error: "هذه المعاملة تخص حساباً آخر" }, { status: 403 });
  }

  const granted = await grantPurchase({
    childId,
    motherId,
    platform: "apple",
    productId: info.productId,
    transactionId: String(info.transactionId || transactionId),
    raw: info,
  });
  if (!granted.ok) return NextResponse.json({ error: granted.error }, { status: 400 });

  return NextResponse.json({ ok: true, ...granted });
}
