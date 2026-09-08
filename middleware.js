import { NextResponse } from "next/server";
import { readSessionToken } from "@/lib/session";
import { hasAppAccess } from "@/lib/appEntitlements";

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

// مسارات مستثناة من اشتراك التطبيق الشامل تحديداً (بعد التحقق من الجلسة) —
// لازم تبقى شغّالة حتى لو ولي الأمر ما عنده وصول:
// - subscription/payments: عشان يقدر يشترك أو يسترجع مشترياته أصلاً — لو
//   حجبنا مسار الدفع نفسه، ولي الأمر المحجوب ما يقدر حتى يدفع ليفكّ الحجب
// - ai-teacher: له بوابته المستقلة الخاصة، ما يخص اشتراك التطبيق الشامل
// - push: التذكيرات تبقى تشتغل بغض النظر عن حالة الاشتراك
// - delete-account: الحذف حق دائم بصرف النظر عن أي اشتراك
const APP_PAYWALL_EXEMPT_PREFIXES = [
  "/api/subscription/", "/api/payments/", "/api/ai-teacher/", "/api/push/", "/api/delete-account",
];

// عرض الأبناء وحذف طالب/ة يبقيان مسموحين دائماً حتى لو الحساب محجوب —
// وإلا عائلة تجاوزت حد باقتها (أضافت طالباً زايداً) تنحجب عن كامل التطبيق
// بلا حتى ما تقدر تشوف مين تحذف عشان ترجع تحت الحد بنفسها. الإضافة
// (POST) تبقى محجوبة عادي، بس القراءة (GET) والحذف (DELETE) يفكّان الحجز
// الذاتي.
function isChildManagement(req) {
  const { method, nextUrl } = req;
  if (method === "GET" && nextUrl.pathname === "/api/children") return true;
  if (method === "DELETE" && /^\/api\/children\/[^/]+$/.test(nextUrl.pathname)) return true;
  return false;
}

async function checkAppPaywall(req, motherId) {
  if (APP_PAYWALL_EXEMPT_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p))) return null;
  if (isChildManagement(req)) return null;

  const access = await hasAppAccess(motherId);
  if (access.allowed) return null;

  return NextResponse.json(
    { error: "الاشتراك بالتطبيق منتهي أو غير مفعّل", paywall: true, phase: access.phase },
    { status: 402 }
  );
}

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

  // اشتراك التطبيق الشامل — hasAppAccess ترجع مسموح فوراً بلا أي استعلام
  // قاعدة بيانات ما دامت الميزة معطّلة (المفتاح الافتراضي)، فما فيه أي
  // كلفة إضافية على الأداء لين نفعّلها فعلياً.
  const paywallBlock = await checkAppPaywall(req, sessionMotherId);
  if (paywallBlock) return paywallBlock;

  // نمرّر المعرّف الموثوق للمسارات اللي تبي تعتمد عليه بدل ما تثق بالعميل
  const headers = new Headers(req.headers);
  headers.set("x-mother-id", sessionMotherId);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
