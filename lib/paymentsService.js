import { getTapCharge } from "./tap";
import { grantPurchase, PRODUCTS } from "./entitlements";

// إتمام عملية دفع Tap ومنح الرصيد.
//
// ما نثق أبداً بما يصلنا من المتصفح ولا بجسم الويبهوك — نستعلم عن الشحنة من
// Tap بمفتاحنا السري ونقرأ حالتها ومبلغها من ردّهم هم. غير كذا، أي أحد يقدر
// يرسل لنا "تم الدفع" ويمنح نفسه اشتراكاً.
//
// الدالة آمنة للتكرار: grantPurchase يرفض نفس معرّف المعاملة مرتين (قيد
// فريد بجدول purchases)، وهذا مهم لأن الويبهوك وصفحة العودة ينادونها كلاهما
// على نفس الشحنة.
export async function finalizeCharge(chargeId, expectedMotherId = null) {
  const charge = await getTapCharge(chargeId);

  const { productId, childId, motherId } = charge.metadata || {};

  // لما ينادينا مستخدم (مو الويبهوك) نتأكد إن الشحنة تخصه — بدونه يقدر أي
  // أحد يستعلم عن حالة عمليات غيره بتخمين المعرّفات.
  if (expectedMotherId && motherId !== expectedMotherId) {
    return { ok: false, error: "هذه العملية تخص حساباً آخر" };
  }

  if (charge.status !== "CAPTURED") {
    return { ok: false, status: charge.status, error: "لم تكتمل عملية الدفع" };
  }

  const product = PRODUCTS[productId];
  if (!product || !motherId) {
    return { ok: false, error: "بيانات العملية ناقصة" };
  }

  // نتأكد إن المبلغ المحصَّل فعلاً يطابق سعر المنتج — لو أحد عدّل المبلغ
  // بطريقه، ما نمنحه المنتج بسعر أرخص.
  if (Number(charge.amount) < product.priceKwd) {
    return { ok: false, error: "المبلغ المحصَّل لا يطابق سعر الباقة" };
  }

  const granted = await grantPurchase({
    childId: childId || null,
    motherId,
    platform: "tap",
    productId,
    transactionId: String(charge.id),
    amountKwd: Number(charge.amount),
    raw: { id: charge.id, status: charge.status, amount: charge.amount, currency: charge.currency },
  });

  return granted;
}
