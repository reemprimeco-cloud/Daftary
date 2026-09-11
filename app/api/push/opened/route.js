import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// يبلّغنا التطبيق (أو الموقع) إن ولي الأمر فتح إشعار إعلان.
//
// ليش نحتاجه أصلاً: آبل ما تخبر أحداً إذا المستخدم شاف الإشعار أو ضغط عليه
// — أقصى ما ترجّعه هو «قبلته للتوصيل». فالجهاز نفسه هو المصدر الوحيد
// لهالمعلومة، والتطبيق يناديه من مستمع النقر على الإشعار.
//
// المسار مستثنى من حجب الاشتراك (بادئة /api/push/ بـmiddleware) عشان
// يشتغل حتى لو حساب ولي الأمر محجوب — وهذي بالضبط الحالة اللي نبي نقيسها
// بإعلان «التجربة المجانية».
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  const { campaign } = await req.json().catch(() => ({}));
  if (!motherId || !campaign) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("broadcast_events")
    .insert({ broadcast_id: campaign, mother_id: motherId, kind: "opened" });

  // 23505 = فتحه مرة ثانية، و23503 = معرّف إعلان مو موجود (رابط قديم أو
  // معدَّل). الحالتان مو أخطاء تستاهل إزعاج ولي الأمر — ما فيه شي يعرضه له.
  if (error && error.code !== "23505" && error.code !== "23503") {
    console.error("broadcast open failed:", error.message);
  }

  return NextResponse.json({ ok: true });
}
