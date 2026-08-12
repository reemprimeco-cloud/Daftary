import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computePaymentStatus, getAcademicYear } from "@/lib/academicYear";
import { createTapCharge } from "@/lib/tap";

export async function POST(req) {
  const { motherId } = await req.json();
  if (!motherId) return NextResponse.json({ error: "motherId مطلوب" }, { status: 400 });
  const sb = supabaseAdmin();

  const { data: mother, error: mErr } = await sb.from("mothers").select("*").eq("id", motherId).single();
  if (mErr || !mother) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });

  const { count } = await sb.from("children").select("*", { count: "exact", head: true }).eq("mother_id", motherId);
  const childrenCount = count ?? 0;

  const status = computePaymentStatus({ mother, childrenCount });
  if (status.amountDueKwd <= 0) {
    return NextResponse.json({ error: "لا يوجد مبلغ مستحق حالياً" }, { status: 400 });
  }

  const ay = getAcademicYear();
  const origin = req.nextUrl.origin;

  let charge;
  try {
    charge = await createTapCharge({
      amount: status.amountDueKwd,
      description: `اشتراك دفتري ${ay.label} — ${childrenCount} طالب/ة`,
      motherName: mother.name,
      motherPhone: mother.phone,
      redirectUrl: `${origin}/payment/callback`,
      postUrl: `${origin}/api/payments/webhook`,
      metadata: { motherId, childrenCount: String(childrenCount), academicYear: ay.label },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const { error: pErr } = await sb.from("payments").insert({
    mother_id: motherId,
    tap_charge_id: charge.id,
    amount_kwd: status.amountDueKwd,
    children_count: childrenCount,
    academic_year: ay.label,
    academic_year_end: ay.end,
    status: "initiated",
  });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ url: charge.transaction?.url, chargeId: charge.id });
}
