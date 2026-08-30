import { NextResponse } from "next/server";
import { finalizeCharge } from "@/lib/paymentsService";

// صفحة العودة من Tap تنادي هذا المسار. نعيد الإتمام على نفس الشحنة حتى لو
// سبقه الويبهوك — المنح آمن للتكرار (قيد فريد على معرّف المعاملة) — عشان
// ولي الأمر ما ينتظر ويبهوك متأخر وهو واقف بالشاشة.
export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const chargeId = new URL(req.url).searchParams.get("chargeId");
  if (!chargeId) return NextResponse.json({ error: "معرّف العملية مطلوب" }, { status: 400 });

  try {
    const result = await finalizeCharge(chargeId, motherId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("tap status error:", e);
    return NextResponse.json({ ok: false, error: "تعذّر التحقق من حالة الدفع" }, { status: 502 });
  }
}
