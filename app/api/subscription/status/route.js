import { NextResponse } from "next/server";
import { getEntitlement } from "@/lib/entitlements";

export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json(await getEntitlement(motherId));
}
