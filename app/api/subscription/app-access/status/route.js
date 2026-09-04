import { NextResponse } from "next/server";
import { hasAppAccess } from "@/lib/appEntitlements";

// حالة اشتراك التطبيق الشامل لولي الأمر — تستخدمها الواجهة تقرر تعرض
// شريط تنبيه فترة السماح، أو شاشة الاشتراك الإلزامية، أو ما تعرض شي.
// المسار خلف middleware.js أصلاً فما نحتاج فحص جلسة إضافي هنا.
export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  const access = await hasAppAccess(motherId);
  return NextResponse.json(access);
}
