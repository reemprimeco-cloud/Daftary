import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// تسجيل رمز جهاز التطبيق لإشعارات المتجر (APNs على آيفون).
// الرمز هو المفتاح: لو سجّل ولي أمر ثاني على نفس الجهاز ننقل ملكيته له،
// وإلا تظل إشعارات الأول توصل جهاز صار لغيره.
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { token, platform } = await req.json().catch(() => ({}));
  if (!token || !["ios", "android"].includes(platform)) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("device_tokens").upsert(
    { token, mother_id: motherId, platform, updated_at: new Date().toISOString(), last_error: null },
    { onConflict: "token" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 });

  await supabaseAdmin().from("device_tokens").delete().eq("token", token).eq("mother_id", motherId);
  return NextResponse.json({ ok: true });
}
