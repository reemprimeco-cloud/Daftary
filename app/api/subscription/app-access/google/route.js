import { NextResponse } from "next/server";
import { grantAppSubscription } from "@/lib/appEntitlements";
import { APP_PRODUCTS } from "@/lib/appPlans";
import { getSubscriptionPurchase } from "@/lib/googlePlay";

// التحقق من مشتريات Google Play لاشتراك التطبيق الشامل — كلها اشتراكات
// (بلا رصيد استهلاكي بهالنظام)، فمسار واحد بس يكفي.
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { purchaseToken, productId } = await req.json().catch(() => ({}));
  if (!purchaseToken) return NextResponse.json({ error: "معرّف الشراء مطلوب" }, { status: 400 });
  if (!APP_PRODUCTS[productId]) return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });

  const result = await getSubscriptionPurchase(purchaseToken);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
  if (result.notFound) return NextResponse.json({ error: "عملية شراء غير موجودة عند جوجل" }, { status: 400 });

  const info = result.data;

  if (info.productId && info.productId !== productId) {
    return NextResponse.json({ error: "المنتج لا يطابق عملية الشراء" }, { status: 400 });
  }
  if (!info.active) {
    return NextResponse.json({ error: "عملية الشراء غير مكتملة أو منتهية" }, { status: 400 });
  }
  if (info.accountId && info.accountId.toLowerCase() !== String(motherId).toLowerCase()) {
    return NextResponse.json({ error: "هذه العملية تخص حساباً آخر" }, { status: 403 });
  }

  const granted = await grantAppSubscription({
    motherId,
    platform: "google",
    productId,
    transactionId: String(info.transactionId),
    raw: info,
  });
  if (!granted.ok) return NextResponse.json({ error: granted.error }, { status: 400 });

  return NextResponse.json({ ok: true, ...granted });
}
