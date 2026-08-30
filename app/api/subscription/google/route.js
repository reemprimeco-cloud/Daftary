import { NextResponse } from "next/server";
import { grantPurchase, PRODUCTS } from "@/lib/entitlements";
import { getSubscriptionPurchase, getProductPurchase } from "@/lib/googlePlay";

// التحقق من مشتريات Google Play. التطبيق يرسل purchaseToken بعد نجاح الشراء،
// ونتحقق منه عند جوجل قبل المنح — الثقة بما يرسله العميل وحده تعني إن أي أحد
// يقدر يمنح نفسه اشتراكاً.
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { purchaseToken, productId, childId } = await req.json().catch(() => ({}));
  if (!purchaseToken) return NextResponse.json({ error: "معرّف الشراء مطلوب" }, { status: 400 });
  if (!childId) return NextResponse.json({ error: "لازم تختار الطالب/ة قبل الشراء" }, { status: 400 });

  const product = PRODUCTS[productId];
  if (!product) return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });

  // الاشتراك والمنتج الاستهلاكي لهما مساران مختلفان تماماً بواجهة جوجل.
  const result = product.kind === "subscription"
    ? await getSubscriptionPurchase(purchaseToken)
    : await getProductPurchase(productId, purchaseToken);

  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
  if (result.notFound) return NextResponse.json({ error: "عملية شراء غير موجودة عند جوجل" }, { status: 400 });

  const info = result.data;

  // المنتج اللي رجّعته جوجل هو المرجع، مو اللي أرسله العميل — بدون هالفحص
  // يقدر أحد يشتري الرصيد الرخيص ويطالب بباقة الاشتراك.
  if (info.productId && info.productId !== productId) {
    return NextResponse.json({ error: "المنتج لا يطابق عملية الشراء" }, { status: 400 });
  }

  // ملغى، أو معلّق، أو منتهي — ما يمنح رصيداً.
  if (!info.active) {
    return NextResponse.json({ error: "عملية الشراء غير مكتملة أو منتهية" }, { status: 400 });
  }

  // التطبيق يمرر معرّف ولي الأمر وقت الشراء، فنتأكد إن العملية تخص صاحب
  // الجلسة. المشتريات القديمة بلا معرّف نقبلها للتوافق.
  if (info.accountId && info.accountId.toLowerCase() !== String(motherId).toLowerCase()) {
    return NextResponse.json({ error: "هذه العملية تخص حساباً آخر" }, { status: 403 });
  }

  const granted = await grantPurchase({
    childId,
    motherId,
    platform: "google",
    productId,
    transactionId: String(info.transactionId),
    raw: info,
  });
  if (!granted.ok) return NextResponse.json({ error: granted.error }, { status: 400 });

  return NextResponse.json({ ok: true, ...granted });
}
