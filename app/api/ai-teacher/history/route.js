import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily } from "@/lib/family";
import { signedUrlsBySource } from "@/lib/uploadSources";

export async function GET(req) {
  const childId = req.nextUrl.searchParams.get("childId");
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!childId || !motherId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId, "id");
  if (!child) return NextResponse.json({ error: "الطالب/ة غير موجود" }, { status: 400 });

  const { data, error } = await sb
    .from("ai_messages")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // صور آخر ٢٤ ساعة ترجع برابط موقّع جاهز للعرض — الدلو خاص فما ينفع
  // رابط مباشر. الأقدم منها انحذفت، فتبقى الرسالة بسطر «مع صورة» فقط.
  // فشل التوقيع ما يضيّع المحادثة: نرجّعها بلا صور.
  let urls = {};
  try {
    urls = await signedUrlsBySource(sb, data.map((m) => m.source_id));
  } catch (e) {
    console.warn("ai-teacher history: signing source urls failed:", e.message);
  }

  const messages = data.map((m) => (m.source_id && urls[m.source_id] ? { ...m, image_url: urls[m.source_id] } : m));
  return NextResponse.json({ messages });
}
