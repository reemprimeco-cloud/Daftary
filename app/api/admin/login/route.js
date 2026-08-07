import { NextResponse } from "next/server";

export async function POST(req) {
  const { email, password } = await req.json();
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!adminEmail || !adminPassword || !sessionSecret) {
    console.error("Admin env vars not configured (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_SESSION_SECRET)");
    return NextResponse.json({ error: "لوحة التحكم غير مُعدّة بالسيرفر بعد" }, { status: 500 });
  }

  if ((email || "").trim().toLowerCase() !== adminEmail.toLowerCase() || password !== adminPassword) {
    return NextResponse.json({ error: "البريد أو كلمة المرور غلط" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", sessionSecret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
