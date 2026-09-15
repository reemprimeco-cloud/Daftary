import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// حالة رفعة معيّنة — يستعلم عنها الجهاز كل ثوانٍ لو انقطع اتصال طلب الرفع
// الأصلي (راجع lib/uploadJobs.js). محصور بصاحبة الجلسة.
export const runtime = "nodejs";

export async function GET(req, { params }) {
  const motherId = req.headers.get("x-mother-id");
  const { data } = await supabaseAdmin()
    .from("upload_jobs")
    .select("status, http_status, result")
    .eq("id", params.id)
    .eq("mother_id", motherId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ status: data.status, httpStatus: data.http_status, result: data.result });
}
