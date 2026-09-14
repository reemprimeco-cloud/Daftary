import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { alertAdmin } from "@/lib/opsAlert";

// APNs عبر node:http2 بتنبيه التكرار — غير متوفر على Edge.
export const runtime = "nodejs";

// كم أمّاً مختلفة بنفس الخطأ خلال ساعة حتى نعتبره عطلاً عاماً ونُنبّه.
// أقل من ذلك غالباً يخص جهازاً أو صورة بعينها — يُسجَّل بهدوء بلا إزعاج.
const ALERT_THRESHOLD = 3;

export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  const { feature, reason, detail, note, platform } = await req.json().catch(() => ({}));
  if (!feature) return NextResponse.json({ error: "feature مطلوب" }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("error_reports").insert({
    mother_id: motherId || null,
    feature: String(feature).slice(0, 80),
    reason: reason ? String(reason).slice(0, 80) : null,
    detail: detail ? String(detail).slice(0, 2000) : null,
    note: note ? String(note).trim().slice(0, 1000) : null,
    platform: platform ? String(platform).slice(0, 20) : null,
  });
  if (error) {
    console.error("error-report insert failed:", error.message);
    // ما نرجّع خطأ للعميل: البلاغ مساعد، وفشله ما يستاهل رسالة ثانية
    // فوق المشكلة الأصلية اللي تعاني منها الأم أصلاً.
    return NextResponse.json({ ok: false });
  }

  // نفس الخطأ عند عدة أمهات بساعة = عطل عام يستاهل تنبيهاً فورياً.
  const { data: recent } = await sb
    .from("error_reports")
    .select("mother_id")
    .eq("feature", feature)
    .eq("reason", reason || "")
    .gte("created_at", new Date(Date.now() - 3600e3).toISOString());

  const affected = new Set((recent || []).map((r) => r.mother_id).filter(Boolean));
  if (affected.size >= ALERT_THRESHOLD) {
    await alertAdmin(
      `error_${feature}_${reason || "x"}`,
      "⚠️ خلل يتكرر عند عدة أمهات",
      `${affected.size} أمهات واجهن نفس المشكلة بآخر ساعة (${feature}). افتحي لوحة الأدمن للتفاصيل.`,
      { detail: `${feature} / ${reason || ""}` }
    );
  }

  return NextResponse.json({ ok: true });
}
