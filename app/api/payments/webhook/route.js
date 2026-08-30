import { NextResponse } from "next/server";
import { finalizeCharge } from "@/lib/paymentsService";

// Tap يبعت الشحنة نفسها بالـbody، لكن ما نثق فيها — finalizeCharge يستعلم
// من Tap بمفتاحنا السري ويقرأ الحالة والمبلغ من ردّهم. لذلك ما نحتاج نتحقق
// من توقيع الويبهوك: أسوأ ما يقدر عليه مرسِل مزيّف هو إننا نستعلم عن شحنة
// مو موجودة أو غير مدفوعة، وترجع النتيجة رفضاً.
//
// نرجّع 200 دايماً عشان Tap ما يعيد المحاولة بلا داعي — لو فشل الإتمام،
// صفحة العودة تعيد المحاولة على نفس الشحنة، والمنح آمن للتكرار.
export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {}

  const chargeId = body?.id;
  if (!chargeId) return NextResponse.json({ ok: true });

  try {
    await finalizeCharge(chargeId);
  } catch (e) {
    console.error("tap webhook finalize error:", e);
  }

  return NextResponse.json({ ok: true });
}
