import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signedSourceUrls } from "@/lib/uploadSources";
import { childInFamily } from "@/lib/family";

// «عرض المصدر»: روابط موقّعة قصيرة العمر للصور اللي جاء منها البند.
// الدلو خاص، فالصور ما تنفتح إلا من هنا وبعد التأكد إن المصدر يخص صاحبة
// الجلسة (x-mother-id الموثوق من الحارس المركزي، لا من جسم الطلب).
export async function GET(req, { params }) {
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  // المصدر يخص العائلة لا الجهاز اللي رفعه: الأب يقدر يشوف صورة رفعتها
  // الأم، لأن البند اللي جاء منها مشترك بينهما أصلاً.
  const { data: source } = await sb
    .from("upload_sources")
    .select("id, mother_id, child_id, paths, created_at, expires_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!source || !(await childInFamily(sb, source.child_id, motherId, "id"))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  // الكرون يحذف الملفات مرة باليوم، فالصف المنتهي قد يعيش ساعات بعد
  // موعده. المدة اللي نوعد فيها لازم تكون دقيقة، فنرفض من هنا بلا انتظار.
  if (source.expires_at && new Date(source.expires_at) <= new Date()) {
    return NextResponse.json({ error: "انتهت مدة حفظ هذه الصورة." }, { status: 404 });
  }

  const urls = await signedSourceUrls(sb, source.paths);
  if (!urls.length) {
    return NextResponse.json({ error: "الصورة انحذفت — الصور تُحفظ أسبوعاً واحداً بعد الرفع." }, { status: 404 });
  }

  return NextResponse.json({ urls, createdAt: source.created_at, expiresAt: source.expires_at });
}
