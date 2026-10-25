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
  // **سجل لا صف واحد** (طلبها ٢٥ أكتوبر): كان `mother_id` مفتاحاً أساسياً
  // والكتابة `upsert`، فأم قيّمت بسبتمبر تكتب ملاحظة اليوم فتمسح القديمة —
  // أو ما توصل أصلاً لأن الشريط يختفي بعد أول تقييم. الحين كل إرسال صف
  // جديد، والأدمن يقرأ التسلسل.
  //
  // ومنع الضغط المزدوج صار بالوقت بدل المفتاح: نفس التقييم ونفس النص خلال
  // دقيقتين = نفس الإرسال، ما هو رأي ثانٍ.
  const twoMinutesAgo = new Date(Date.now() - 120e3).toISOString();
  const { data: recent } = await sb
    .from("app_feedback")
    .select("id")
    .eq("mother_id", motherId)
    .eq("rating", stars)
    .gte("created_at", twoMinutesAgo)
    .limit(1);
  if (recent?.length) return NextResponse.json({ ok: true, duplicate: true });

  const { error } = await sb
    .from("app_feedback")
    .insert({ mother_id: motherId, rating: stars, note: text });

  if (error) {
    console.error("feedback save failed:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ التقييم، حاولي مرة ثانية." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
