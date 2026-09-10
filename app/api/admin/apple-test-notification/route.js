import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requestTestNotification, getTestNotificationStatus } from "@/lib/appleServerApi";

export const runtime = "nodejs";

// طلب إشعار تجريبي من آبل للتأكد إن مسار الإشعارات مربوط وشغّال.
// بدونه ما نعرف إن الربط صحيح إلا لما يتجدد اشتراك حقيقي (بعد سنة) أو
// يطلب أحد استرجاعاً — أي بعد ما يصير الضرر.
//
// /api/admin/ عام بالحارس المركزي (له كوكي خاص)، فنتحقق من الكوكي هنا.
function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

export async function POST() {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const result = await requestTestNotification();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({ ok: true, token: result.token, environment: result.environment });
}

// حالة التسليم: آبل تسجّل كل محاولة إرسال وردّ خادمنا عليها.
export async function GET(req) {
  if (!isAuthed()) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token مطلوب" }, { status: 400 });

  const result = await getTestNotificationStatus(token);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, ...result });
}
