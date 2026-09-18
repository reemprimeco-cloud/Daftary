import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signedSourceUrls } from "@/lib/uploadSources";

// «عرض المصدر»: روابط موقّعة قصيرة العمر للصور اللي جاء منها البند.
// الدلو خاص، فالصور ما تنفتح إلا من هنا وبعد التأكد إن المصدر يخص صاحبة
// الجلسة (x-mother-id الموثوق من الحارس المركزي، لا من جسم الطلب).
export async function GET(req, { params }) {
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  const { data: source } = await sb
    .from("upload_sources")
    .select("id, mother_id, paths, created_at, expires_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!source || source.mother_id !== motherId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const urls = await signedSourceUrls(sb, source.paths);
  if (!urls.length) {
    return NextResponse.json({ error: "الصورة انحذفت — الصور تُحفظ أسبوعاً واحداً بعد الرفع." }, { status: 404 });
  }

  return NextResponse.json({ urls, createdAt: source.created_at, expiresAt: source.expires_at });
}
