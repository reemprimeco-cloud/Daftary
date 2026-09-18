import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logActivity } from "@/lib/family";

// الدعوة الموجّهة لرقم صاحب الجلسة نفسه. ما ناخذ الرقم من الطلب — نقرأه
// من حسابه، فما يقدر أحد يقبل دعوة موجّهة لغيره.
async function pendingInviteFor(sb, motherId) {
  const { data: me } = await sb.from("mothers").select("id, name, phone, family_id, family_role").eq("id", motherId).maybeSingle();
  if (!me) return { me: null, invite: null };
  const { data: invite } = await sb
    .from("family_invites")
    .select("id, family_id, invited_by, created_at")
    .eq("phone", me.phone)
    .eq("status", "pending")
    .maybeSingle();
  return { me, invite: invite || null };
}

export async function GET(req) {
  const sb = supabaseAdmin();
  const { me, invite } = await pendingInviteFor(sb, req.headers.get("x-mother-id"));
  if (!me) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  if (!invite) return NextResponse.json({ invite: null });

  const { data: inviter } = await sb.from("mothers").select("name").eq("id", invite.invited_by).maybeSingle();
  return NextResponse.json({ invite: { id: invite.id, fromName: inviter?.name || "ولي الأمر", createdAt: invite.created_at } });
}

// القبول: ينضم الحساب لعائلة الداعي كولي أمر ثانٍ، فيشوف نفس الأبناء
// ونفس البيانات — بحسابه ورقمه هو، بلا اشتراك جديد.
export async function POST(req) {
  const { accept } = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  const { me, invite } = await pendingInviteFor(sb, motherId);
  if (!me) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  if (!invite) return NextResponse.json({ error: "ما فيه دعوة معلّقة." }, { status: 404 });

  if (accept === false) {
    await sb.from("family_invites").update({ status: "revoked" }).eq("id", invite.id);
    return NextResponse.json({ ok: true, joined: false });
  }

  // حساب فيه طلاب ما ينضم (قرار صاحبة التطبيق: لا دمج) — يحذف حسابه أولاً.
  const { count } = await sb.from("children").select("*", { count: "exact", head: true }).eq("family_id", me.family_id);
  if (count) {
    return NextResponse.json(
      { error: "حسابك فيه طلاب مسجّلين. احذف حسابك أولاً من «حسابي ← حذف الحساب» ثم اقبل الدعوة بنفس رقمك." },
      { status: 409 }
    );
  }

  const oldFamily = me.family_id;
  const { error } = await sb
    .from("mothers")
    .update({ family_id: invite.family_id, family_role: "secondary" })
    .eq("id", motherId);
  if (error) {
    // القيد الفريد بالقاعدة: العائلة عندها ولي أمر ثانٍ أصلاً.
    if (error.code === "23505") return NextResponse.json({ error: "العائلة مكتملة أصلاً." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await sb.from("family_invites").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: motherId }).eq("id", invite.id);
  // عائلته القديمة صارت فاضية بلا أي حساب — ما لها داعٍ تبقى.
  if (oldFamily && oldFamily !== invite.family_id) await sb.from("families").delete().eq("id", oldFamily);

  await logActivity(sb, { familyId: invite.family_id, actorId: motherId, actorName: me.name, action: "انضم للعائلة" });
  return NextResponse.json({ ok: true, joined: true });
}
