import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSessionToken } from "@/lib/session";
import { normalizeKuwaitPhone } from "@/lib/otp";
import { hashPassword, isValidPassword } from "@/lib/authPassword";

// إنشاء حساب: الاسم + الموبايل + رقم سري، بلا كود تحقق (قرار صاحبة
// التطبيق ١٩ سبتمبر — فاتورة Twilio). الرقم يُحفظ كما هو بلا تحقق منه:
// نحتاجه لدعوة ولي الأمر الثاني وللدفع، لا لإثبات الهوية.
//
// الحارس الوحيد المهم هنا: **رقم مسجَّل من قبل ما يُنشأ عليه حساب جديد**.
// بدونه يقدر أي شخص يكتب رقم أم مسجّلة ويحدد رقماً سرياً جديداً فيدخل
// حسابها ويشوف بيانات عيالها — وهذي نفس الثغرة اللي انحذف بسببها مسار
// /api/register قبل (راجع app/api/register/route.js). فالرقم المسجَّل
// يُرد بـ409 ويُطلب منها تسجيل الدخول أو «نسيت الرقم السري».
export async function POST(req) {
  let name, phone, password;
  try {
    ({ name, phone, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const trimmed = String(name || "").trim();
  if (!trimmed) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });

  const to = normalizeKuwaitPhone(phone);
  if (!to) return NextResponse.json({ error: "رقم الموبايل غير صحيح" }, { status: 400 });

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "الرقم السري لازم يكون ٤ أحرف/أرقام على الأقل" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: existing, error: findErr } = await sb
    .from("mothers")
    .select("id")
    .eq("phone", to)
    .maybeSingle();
  if (findErr) {
    console.error("signup lookup failed:", findErr.message);
    return NextResponse.json({ error: "تعذّر إنشاء الحساب، حاولي مرة ثانية." }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: "هذا الرقم عنده حساب. سجّلي دخول برقمك السري، أو اضغطي «نسيت الرقم السري».", alreadyRegistered: true },
      { status: 409 }
    );
  }

  const hash = await hashPassword(password);
  const { data, error } = await sb
    .from("mothers")
    .insert({ name: trimmed, phone: to, password_hash: hash })
    .select()
    .single();

  // ضغطتان متزامنتان: الأولى تنشئ الحساب والثانية تصطدم بقيد الرقم الفريد.
  // ما نرجّع الحساب هنا (عكس verify-otp) لأن الكود ما أثبت الهوية —
  // نطلب منها تسجيل الدخول بالرقم السري اللي حطّته توّها.
  if (error?.code === "23505") {
    return NextResponse.json(
      { error: "هذا الرقم عنده حساب. سجّلي دخول برقمك السري.", alreadyRegistered: true },
      { status: 409 }
    );
  }
  if (error || !data) {
    console.error("signup insert failed:", error?.message);
    return NextResponse.json({ error: "تعذّر إنشاء الحساب، حاولي مرة ثانية." }, { status: 500 });
  }

  let token;
  try {
    token = await createSessionToken(data.id);
  } catch (e) {
    console.error(e.message);
    return NextResponse.json({ error: "إعدادات الجلسة ناقصة بالسيرفر" }, { status: 500 });
  }

  return NextResponse.json({ mother: data, token });
}
