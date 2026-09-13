import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// استقبال تقييم البرنامج. معرّف ولية الأمر من الجلسة الموثوقة مو من العميل،
// وإلا قدر أي أحد يزوّر تقييمات باسم غيرها.
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { rating, note } = await req.json().catch(() => ({}));
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "التقييم مطلوب" }, { status: 400 });
  }

  // نقصّ الملاحظة: الحقل حر، وما فيه داعي نخزّن نصاً بلا حدود.
  const text = String(note || "").trim().slice(0, 1000) || null;

  const sb = supabaseAdmin();
  // upsert مو insert: لو انضغط الزر مرتين (شبكة بطيئة) ما نرجّع خطأ لولية
  // أمر ما سوّت شيئاً غلط — نحدّث تقييمها وخلاص.
  const { error } = await sb
    .from("app_feedback")
    .upsert({ mother_id: motherId, rating: stars, note: text }, { onConflict: "mother_id" });

  if (error) {
    console.error("feedback save failed:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ التقييم، حاولي مرة ثانية." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
