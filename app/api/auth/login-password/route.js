import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSessionToken } from "@/lib/session";
import { normalizeKuwaitPhone } from "@/lib/otp";
import { verifyPassword, loginLockStatus, nextFailedAttemptState } from "@/lib/authPassword";

// دخول بالجوال + رقم سري — بلا كود، بلا Twilio. راجع request-otp/route.js:
// هذا المسار ما يُستدعى إلا لرقم سبق أن حدّد رقماً سرياً (channel:"password").
export async function POST(req) {
  let phone, password;
  try {
    ({ phone, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const to = normalizeKuwaitPhone(phone);
  if (!to || !password) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: mother } = await sb.from("mothers").select("*").eq("phone", to).maybeSingle();
  // رسالة موحّدة لرقم غير موجود ولرقم سري غلط — ما نسرّب إذا الرقم مسجَّل.
  const wrongMsg = { error: "رقم الجوال أو الرقم السري غير صحيح" };
  if (!mother || !mother.password_hash) return NextResponse.json(wrongMsg, { status: 401 });

  const lock = loginLockStatus(mother);
  if (lock.locked) {
    return NextResponse.json(
      { error: `حاولتِ مرات كثيرة. انتظري ${lock.minutesLeft} دقيقة${lock.minutesLeft === 1 ? "" : "أو استخدمي «نسيت الرقم السري»"}.` },
      { status: 429 }
    );
  }

  const ok = await verifyPassword(password, mother.password_hash);
  if (!ok) {
    const patch = nextFailedAttemptState(mother);
    await sb.from("mothers").update(patch).eq("id", mother.id);
    return NextResponse.json(wrongMsg, { status: 401 });
  }

  if (mother.failed_login_attempts || mother.login_locked_until) {
    await sb.from("mothers").update({ failed_login_attempts: 0, login_locked_until: null }).eq("id", mother.id);
  }

  let token;
  try {
    token = await createSessionToken(mother.id);
  } catch (e) {
    console.error(e.message);
    return NextResponse.json({ error: "إعدادات الجلسة ناقصة بالسيرفر" }, { status: 500 });
  }

  return NextResponse.json({ mother, token });
}
