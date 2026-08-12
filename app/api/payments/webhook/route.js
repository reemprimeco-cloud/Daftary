import { NextResponse } from "next/server";
import { finalizeCharge } from "@/lib/paymentsService";

// Tap يبعت الشحنة (charge object) نفسها بالـbody، لكن ما نثق فيها مباشرة —
// finalizeCharge يستعلم من Tap بمفتاحنا السري عشان يتأكد من الحالة الحقيقية.
// نرجّع 200 دايماً (حتى لو صار خطأ داخلي) عشان Tap ما يعيد المحاولة بلا داعي؛
// لو التحقق فشل، صفحة /payment/callback أو الزيارة الجاية للتطبيق بتعيد المحاولة.
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
