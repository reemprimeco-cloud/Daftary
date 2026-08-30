import { NextResponse } from "next/server";
import { readSessionToken } from "@/lib/session";

// حارس مركزي لمسارات الـ API. قبله كانت كل المسارات مفتوحة: أي أحد يعرف معرّف
// ولي أمر يقدر يقرأ ويعدّل بياناته. نتحقق هنا مرة وحدة بدل ما نكرر الفحص في
// عشرين ملف وننسى واحد.
//
// المسارات العامة: الدخول (ما عنده جلسة بعد)، لوحة التحكم (لها كوكي خاص)،
// المهام المجدولة (لها CRON_SECRET)، والمنهج (بيانات وزارة عامة بلا خصوصية).
// /api/register ملغى ويرجّع 410 برسالة «حدّثي التطبيق» — نتركه عام عشان
// النسخ القديمة تشوف الرسالة بدل «الجلسة منتهية» المضلّلة.
// ويبهوك Tap ينادينا من خوادمهم بلا جلسة، فلازم يكون عاماً. وهو آمن: ما
// يثق بجسم الطلب أبداً، بل يستعلم عن الشحنة من Tap بمفتاحنا السري.
const PUBLIC_PREFIXES = [
  "/api/auth/", "/api/admin/", "/api/cron/", "/api/curriculum/", "/api/register",
  "/api/payments/webhook",
];

export async function middleware(req) {
  const { pathname, searchParams } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") || "";
  const sessionMotherId = header.startsWith("Bearer ") ? await readSessionToken(header.slice(7)) : null;

  if (!sessionMotherId) {
    return NextResponse.json({ error: "الجلسة منتهية، سجّلي دخول مرة ثانية." }, { status: 401 });
  }

  // لو الطلب يحدّد ولي أمر بالرابط، لازم يكون نفس صاحب الجلسة — حتى ما يقرأ
  // حساب أحد ثاني بتبديل المعرّف.
  const requested = searchParams.get("motherId");
  if (requested && requested !== sessionMotherId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  // نمرّر المعرّف الموثوق للمسارات اللي تبي تعتمد عليه بدل ما تثق بالعميل
  const headers = new Headers(req.headers);
  headers.set("x-mother-id", sessionMotherId);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
