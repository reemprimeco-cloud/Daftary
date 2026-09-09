import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyAppleTransaction, decodeAppleJws } from "@/lib/appleServerApi";
import { grantAppSubscription, revokeAppSubscription } from "@/lib/appEntitlements";
import { APP_PRODUCTS } from "@/lib/appPlans";

export const runtime = "nodejs";

// إشعارات آبل للخادم (App Store Server Notifications V2).
//
// بدونها نعرف عن الاشتراك بس لحظة الشراء داخل التطبيق: التجديد السنوي،
// والإلغاء، والاسترجاع، وسحب الشراء — كلها تصير عند آبل بلا ما يفتح ولي
// الأمر التطبيق، فيبقى وصوله عندنا كما هو مهما تغيّر عند آبل.
//
// المسار عام (آبل تناديه بلا جلسة)، فلا نثق بجسم الطلب إطلاقاً: نقرأ منه
// معرّف المعاملة فقط، ثم نستعلم عن حالتها الحقيقية من آبل بمفتاحنا نحن.
// يعني حتى لو زوّر أحد إشعاراً كاملاً، أقصى ما يحققه إننا نعيد التحقق من
// معاملة حقيقية — والنتيجة تجي من آبل مو منه. وهذا أبسط وأأمن من التحقق
// من سلسلة الشهادات (x5c) يدوياً، وخطأ واحد فيها يعني قبول المزوَّر.
export async function POST(req) {
  try {
    return await handleNotification(req);
  } catch (e) {
    console.error("apple notifications: unexpected error", e);
    // 500 يخلي آبل تعيد المحاولة لاحقاً، وهو المطلوب لو الخلل عندنا
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

async function handleNotification(req) {
  const { signedPayload } = await req.json().catch(() => ({}));
  if (!signedPayload) return NextResponse.json({ error: "signedPayload required" }, { status: 400 });

  let note;
  try {
    note = decodeAppleJws(signedPayload);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const { notificationType, subtype, data } = note;
  if (data?.bundleId && data.bundleId !== "app.reemora.daftary") {
    return NextResponse.json({ ok: true, ignored: "bundle" });
  }

  let claimed;
  try {
    claimed = decodeAppleJws(data.signedTransactionInfo);
  } catch {
    // إشعارات ما لها معاملة (مثل TEST) — نردّ 200 عشان آبل ما تعيدها
    return NextResponse.json({ ok: true, ignored: notificationType });
  }

  // الحقيقة من آبل مباشرة، مو من جسم الإشعار
  const verified = await verifyAppleTransaction(String(claimed.transactionId));
  if (verified.error) {
    console.error("apple notifications: verify failed", notificationType, verified.error);
    return NextResponse.json({ error: verified.error }, { status: 500 }); // تعيد آبل المحاولة
  }
  if (verified.notFound) return NextResponse.json({ ok: true, ignored: "unknown transaction" });

  const tx = decodeAppleJws(verified.data.signedTransactionInfo);
  if (!APP_PRODUCTS[tx.productId]) {
    // اشتراك المعلم الذكي له نظامه المستقل — ما نتصرف فيه هنا
    return NextResponse.json({ ok: true, ignored: "other product" });
  }

  const motherId = await resolveMother(tx);
  if (!motherId) {
    console.error("apple notifications: no mother for transaction", tx.transactionId, tx.originalTransactionId);
    return NextResponse.json({ ok: true, ignored: "unknown account" });
  }

  // الاسترجاع وسحب الشراء ينهيان الوصول فوراً. نعتمد revocationDate من
  // آبل نفسها بدل نوع الإشعار وحده — النوع وصف، وهذا الحقل هو الحقيقة.
  if (tx.revocationDate || notificationType === "REFUND" || notificationType === "REVOKE") {
    await revokeAppSubscription(motherId, `${notificationType}${subtype ? `/${subtype}` : ""}`);
    return NextResponse.json({ ok: true, action: "revoked" });
  }

  // التجديد والترقية: نمدّد للتاريخ الجديد من آبل. grantAppSubscription
  // تتعامل مع التكرار وما تقلّص باقة سارية أكبر.
  const granted = await grantAppSubscription({
    motherId,
    platform: "apple",
    productId: tx.productId,
    transactionId: String(tx.transactionId),
    expiresAt: tx.expiresDate || null,
    raw: { notificationType, subtype, tx },
  });
  if (!granted.ok) {
    console.error("apple notifications: grant failed", granted.error);
    return NextResponse.json({ error: granted.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: "renewed", notificationType });
}

// آبل تحمل appAccountToken (معرّف ولي الأمر عندنا) بالمعاملات المتجددة
// كمان، فهو أوثق مصدر. ولو غاب لأي سبب، نرجع لمعاملة الشراء الأصلية
// المسجّلة عندنا.
async function resolveMother(tx) {
  if (tx.appAccountToken) return tx.appAccountToken;

  const sb = supabaseAdmin();
  const ids = [tx.originalTransactionId, tx.transactionId].filter(Boolean).map(String);
  if (!ids.length) return null;

  const { data } = await sb
    .from("app_purchases")
    .select("mother_id")
    .eq("platform", "apple")
    .in("transaction_id", ids)
    .limit(1);
  return data?.[0]?.mother_id || null;
}
