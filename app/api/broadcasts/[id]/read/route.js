import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// «إغلاق» بالبطاقة: نسجّل إنها قرأته فما يرجع يطلع لها.
// نوع مستقل عن `opened` (نقر إشعار آبل) عشان تبقى نتيجة الإعلان بالأدمن
// تفرّق بين الاثنين: منو ضغط الإشعار، ومنو قرأ البطاقة داخل التطبيق.
export async function POST(req, { params }) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId || !params.id) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("broadcast_events")
    .insert({ broadcast_id: params.id, mother_id: motherId, kind: "read" });

  // 23505 = قفلتها مرتين (جهازان مثلاً)، و23503 = إعلان انحذف.
  // الحالتان مو أخطاء تستاهل إزعاجها — البطاقة انقفلت وهذا المطلوب.
  if (error && error.code !== "23505" && error.code !== "23503") {
    console.error("broadcast read failed:", error.message);
    return NextResponse.json({ error: "تعذّر الحفظ" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
