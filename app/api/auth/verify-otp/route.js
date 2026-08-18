import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSessionToken } from "@/lib/session";
import { isReviewCode, isReviewPhone, normalizeKuwaitPhone, twilioVerify } from "@/lib/otp";

// التحقق من الكود. لو صح: ننشئ الحساب لو جديد، ونرجّع جلسة موقّعة تبقى شغالة
// لين تسجّل خروج.
export async function POST(req) {
  let name, phone, code;
  try {
    ({ name, phone, code } = await req.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const to = normalizeKuwaitPhone(phone);
  if (!to) return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 });
  if (!/^\d{4,10}$/.test(String(code || "").trim())) {
    return NextResponse.json({ error: "الكود غير صحيح" }, { status: 400 });
  }

  // ————— التحقق من الكود —————
  if (isReviewPhone(to)) {
    if (!isReviewCode(code)) {
      return NextResponse.json({ error: "الكود غير صحيح" }, { status: 401 });
    }
  } else {
    try {
      const check = await twilioVerify("VerificationCheck", { To: to, Code: String(code).trim() });
      // ملاحظة: الكود الغلط ما يرمي خطأ — يرجّع status = pending. لازم نتحقق صراحة.
      if (check.status !== "approved") {
        return NextResponse.json({ error: "الكود غير صحيح أو منتهي" }, { status: 401 });
      }
    } catch (e) {
      // 60202 = تجاوزت حد المحاولات، 404 = ما فيه تحقق معلّق (منتهي أو مستخدم)
      if (e.twilioCode === 60202) {
        return NextResponse.json({ error: "حاولتِ مرات كثيرة. اطلبي كود جديد." }, { status: 429 });
      }
      if (e.status === 404) {
        return NextResponse.json({ error: "انتهت صلاحية الكود. اطلبي كود جديد." }, { status: 401 });
      }
      console.error("verify-otp failed:", e.twilioCode || "", e.message);
      return NextResponse.json({ error: "تعذّر التحقق، حاولي بعد شوي." }, { status: 502 });
    }
  }

  // ————— الحساب —————
  const sb = supabaseAdmin();
  const { data: existing, error: findErr } = await sb
    .from("mothers")
    .select("*")
    .eq("phone", to)
    .maybeSingle();
  if (findErr) {
    console.error("verify-otp lookup failed:", findErr.message);
    return NextResponse.json({ error: "تعذّر الدخول، حاولي مرة ثانية." }, { status: 500 });
  }

  let mother = existing;
  if (!mother) {
    // حساب جديد — الاسم مطلوب هنا فقط
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "الاسم مطلوب", needsName: true }, { status: 400 });
    }
    const { data, error } = await sb.from("mothers").insert({ name: trimmed, phone: to }).select().single();
    if (error) {
      console.error("verify-otp insert failed:", error.message);
      return NextResponse.json({ error: "تعذّر إنشاء الحساب، حاولي مرة ثانية." }, { status: 500 });
    }
    mother = data;
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
