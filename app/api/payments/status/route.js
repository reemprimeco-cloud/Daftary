import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computePaymentStatus } from "@/lib/academicYear";
import { finalizeCharge } from "@/lib/paymentsService";

export async function GET(req) {
  const motherId = req.nextUrl.searchParams.get("motherId");
  const tapId = req.nextUrl.searchParams.get("tapId");

  if (tapId) {
    try {
      const result = await finalizeCharge(tapId);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  if (!motherId) return NextResponse.json({ error: "motherId مطلوب" }, { status: 400 });
  const sb = supabaseAdmin();

  const { data: mother, error: mErr } = await sb.from("mothers").select("*").eq("id", motherId).single();
  if (mErr || !mother) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });

  const { count } = await sb.from("children").select("*", { count: "exact", head: true }).eq("mother_id", motherId);

  const status = computePaymentStatus({ mother, childrenCount: count ?? 0 });
  return NextResponse.json(status);
}
