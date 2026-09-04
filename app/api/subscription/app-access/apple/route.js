import { NextResponse } from "next/server";
import { grantAppSubscription } from "@/lib/appEntitlements";
import { APP_PRODUCTS } from "@/lib/appPlans";
import { verifyAppleTransaction, decodeAppleJws } from "@/lib/appleServerApi";

// التحقق من مشتريات آبل لاشتراك التطبيق الشامل. نفس منطق مسار المعلم
// الذكي (app/api/subscription/apple)، بس يمنح app_subscriptions بدل
// entitlements — الاثنان نظامان منفصلان تماماً.
export async function POST(req) {
  try {
    return await handleVerify(req);
  } catch (e) {
    console.error("subscription/app-access/apple unexpected error:", e);
    return NextResponse.json({ error: "خطأ غير متوقع بالتحقق من الشراء" }, { status: 500 });
  }
}

async function handleVerify(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { transactionId } = await req.json().catch(() => ({}));
  if (!transactionId) return NextResponse.json({ error: "معرّف المعاملة مطلوب" }, { status: 400 });

  const result = await verifyAppleTransaction(transactionId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
  if (result.notFound) return NextResponse.json({ error: "معاملة غير موجودة عند آبل" }, { status: 400 });

  let info;
  try {
    info = decodeAppleJws(result.data.signedTransactionInfo);
  } catch {
    return NextResponse.json({ error: "تعذّرت قراءة بيانات المعاملة" }, { status: 502 });
  }

  if (!APP_PRODUCTS[info.productId]) {
    return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });
  }

  if (info.revocationDate) {
    return NextResponse.json({ error: "هذه المعاملة مستردّة" }, { status: 400 });
  }

  if (info.expiresDate && info.expiresDate < Date.now()) {
    return NextResponse.json({ error: "هذا الاشتراك منتهي" }, { status: 400 });
  }

  const token = info.appAccountToken;
  if (token && token.toLowerCase() !== String(motherId).toLowerCase()) {
    return NextResponse.json({ error: "هذه المعاملة تخص حساباً آخر" }, { status: 403 });
  }

  const granted = await grantAppSubscription({
    motherId,
    platform: "apple",
    productId: info.productId,
    transactionId: String(info.transactionId || transactionId),
    raw: info,
  });
  if (!granted.ok) return NextResponse.json({ error: granted.error }, { status: 400 });

  return NextResponse.json({ ok: true, ...granted });
}
