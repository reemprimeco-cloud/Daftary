import { supabaseAdmin } from "./supabase";
import { getTapCharge } from "./tap";

const FAILED_STATUSES = ["FAILED", "DECLINED", "CANCELLED", "VOID", "TIMEDOUT", "ABANDONED", "RESTRICTED"];

// المصدر الوحيد الموثوق لحالة الدفع هو استعلام Tap مباشرة بمفتاحنا السري —
// ما نعتمد على بيانات الـwebhook نفسها (ممكن أي حد يبعتها)، فقط نستخدمها
// كإشارة إنه فيه تحديث نتحقق منه. يستدعيها كل من الـwebhook وصفحة الرجوع.
export async function finalizeCharge(tapChargeId) {
  const sb = supabaseAdmin();
  const { data: payment } = await sb.from("payments").select("*").eq("tap_charge_id", tapChargeId).maybeSingle();
  if (!payment) return { status: "unknown" };
  if (payment.status === "captured") return { status: "captured", alreadyProcessed: true };

  const charge = await getTapCharge(tapChargeId);
  const tapStatus = charge.status;

  if (tapStatus === "CAPTURED") {
    await sb
      .from("mothers")
      .update({
        paid_for_count: payment.children_count,
        paid_through: payment.academic_year_end,
        paid_academic_year: payment.academic_year,
      })
      .eq("id", payment.mother_id);
    await sb.from("payments").update({ status: "captured", updated_at: new Date().toISOString() }).eq("id", payment.id);
    return { status: "captured" };
  }

  if (FAILED_STATUSES.includes(tapStatus)) {
    await sb.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
    return { status: "failed" };
  }

  return { status: "pending" };
}
