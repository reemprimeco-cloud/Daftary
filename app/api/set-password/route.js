import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hashPassword, isValidPassword } from "@/lib/authPassword";

// تحديد أو تغيير الرقم السري — بعد أول تحقق بالكود (اختياري) أو من صفحة
// الحساب لاحقاً. يحتاج جلسة سارية فقط (middleware.js)، بلا اشتراك —
// معفى من الحجب (APP_PAYWALL_EXEMPT_PREFIXES) عشان حتى حساب محجوب يقدر
// يحدّد رقمه السري.
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { password } = await req.json().catch(() => ({}));
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "الرقم السري لازم يكون ٤ أحرف/أرقام على الأقل" }, { status: 400 });
  }

  const hash = await hashPassword(password);
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("mothers")
    .update({ password_hash: hash, failed_login_attempts: 0, login_locked_until: null })
    .eq("id", motherId);
  if (error) return NextResponse.json({ error: "تعذّر حفظ الرقم السري، حاولي مرة ثانية." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
