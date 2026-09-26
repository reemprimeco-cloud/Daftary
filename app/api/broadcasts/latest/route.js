import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// بطاقة الإعلان داخل التطبيق: إشعار آبل يعرض سطرين بشاشة القفل، فالإعلان
// الطويل ينقص. هنا ترجع الأم تقراه كاملاً أول ما تفتح التطبيق وتقفله بزر.
//
// ترجّع **إعلاناً واحداً**: الأحدث اللي انرسل لها وما قرأته بعد. بطاقتان
// فوق بعض أول ما تفتح التطبيق إزعاج، والأقدم فات وقته أصلاً.
export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ broadcast: null });

  const sb = supabaseAdmin();

  // أحداثها هي: وش انرسل لها، ووش قرأته. العدد محدود بعدد الإعلانات
  // (عشرات بأقصى حال) فاستعلام واحد يكفي.
  const { data: events, error } = await sb
    .from("broadcast_events")
    .select("broadcast_id, kind")
    .eq("mother_id", motherId);
  if (error) {
    console.error("broadcast latest: events failed:", error.message);
    return NextResponse.json({ broadcast: null });
  }

  const read = new Set((events || []).filter((e) => e.kind === "read").map((e) => e.broadcast_id));
  const pending = [...new Set(
    (events || []).filter((e) => e.kind === "sent" && !read.has(e.broadcast_id)).map((e) => e.broadcast_id)
  )];
  if (!pending.length) return NextResponse.json({ broadcast: null });

  const { data, error: bErr } = await sb
    .from("broadcasts")
    .select("id, title, body, sent_at")
    .in("id", pending)
    .eq("show_in_app", true)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bErr) {
    console.error("broadcast latest failed:", bErr.message);
    return NextResponse.json({ broadcast: null });
  }

  return NextResponse.json({ broadcast: data || null });
}
