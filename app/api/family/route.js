import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { familyContext, familyParents, logActivity } from "@/lib/family";
import { normalizeKuwaitPhone } from "@/lib/otp";

// حالة العائلة: من فيها، ودعوة معلّقة إن وُجدت. تُستخرج دائماً من جلسة
// صاحب الطلب — ما نقبل معرّف عائلة من العميل أبداً.
export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();
  const ctx = await familyContext(sb, motherId);
  if (!ctx) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const [parents, { data: invite }, { data: activity }] = await Promise.all([
    familyParents(sb, ctx.familyId),
    sb.from("family_invites").select("id, phone, created_at").eq("family_id", ctx.familyId).eq("status", "pending").maybeSingle(),
    sb.from("family_activity").select("actor_name, action, entity, created_at").eq("family_id", ctx.familyId).order("created_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    role: ctx.role,
    canInvite: ctx.role === "primary" && parents.length < 2 && !invite,
    parents: parents.map((p) => ({ id: p.id, name: p.name, phone: p.phone, role: p.family_role, isMe: p.id === motherId })),
    invite: invite || null,
    activity: activity || [],
  });
}

// دعوة ولي الأمر الثاني برقم جواله. صاحب الاشتراك (الأساسي) وحده يدعو،
// والحد وليّا أمر لكل عائلة — مفروض بقيود القاعدة كذلك لا بالواجهة وحدها.
export async function POST(req) {
  const { phone } = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  const ctx = await familyContext(sb, motherId);
  if (!ctx) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  if (ctx.role !== "primary") {
    return NextResponse.json({ error: "صاحب الاشتراك وحده يقدر يدعو ولي أمر ثاني." }, { status: 403 });
  }

  const to = normalizeKuwaitPhone(phone || "");
  if (!to) return NextResponse.json({ error: "رقم الموبايل غير صحيح" }, { status: 400 });

  const parents = await familyParents(sb, ctx.familyId);
  if (parents.length >= 2) {
    return NextResponse.json({ error: "العائلة مكتملة — ولي أمر أساسي وولي أمر ثانٍ فقط." }, { status: 400 });
  }
  if (parents.some((p) => p.phone === to)) {
    return NextResponse.json({ error: "هذا رقمك أنتِ." }, { status: 400 });
  }

  // رقم عنده حساب فيه بيانات: ما ندمج العائلتين (قرار صاحبة التطبيق) —
  // يحذف حسابه من «حسابي» ثم ينضم بالدعوة برقمه نفسه.
  const { data: existing } = await sb.from("mothers").select("id, family_id, family_role").eq("phone", to).maybeSingle();
  if (existing) {
    const { count } = await sb.from("children").select("*", { count: "exact", head: true }).eq("family_id", existing.family_id);
    if (count) {
      return NextResponse.json(
        { error: "هذا الرقم عنده حساب فيه طلاب مسجّلين. لازم يحذف حسابه أولاً من «حسابي ← حذف الحساب» ثم يقبل الدعوة." },
        { status: 409 }
      );
    }
    if (existing.family_role === "secondary") {
      return NextResponse.json({ error: "هذا الرقم منضم لعائلة ثانية أصلاً." }, { status: 409 });
    }
  }

  // دعوة معلّقة سابقة لنفس العائلة تُلغى — الأحدث هي المعتمدة.
  await sb.from("family_invites").update({ status: "revoked" }).eq("family_id", ctx.familyId).eq("status", "pending");

  const { data: invite, error } = await sb
    .from("family_invites")
    .insert({ family_id: ctx.familyId, phone: to, invited_by: motherId })
    .select("id, phone, created_at")
    .single();
  if (error) {
    // القيد الفريد: نفس الرقم عنده دعوة معلّقة من عائلة ثانية.
    if (error.code === "23505") return NextResponse.json({ error: "هذا الرقم عنده دعوة معلّقة من عائلة ثانية." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivity(sb, { familyId: ctx.familyId, actorId: motherId, actorName: ctx.name, action: "دعت ولي أمر ثاني", entity: to });
  return NextResponse.json({ invite });
}

// إلغاء الدعوة المعلّقة، أو إخراج ولي الأمر الثاني من العائلة.
// الإخراج يقطع وصوله فوراً: يرجع لعائلته الخاصة الفاضية.
export async function DELETE(req) {
  const { parentId } = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  const ctx = await familyContext(sb, motherId);
  if (!ctx) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  if (ctx.role !== "primary") {
    return NextResponse.json({ error: "صاحب الاشتراك وحده يقدر يدير العائلة." }, { status: 403 });
  }

  if (!parentId) {
    await sb.from("family_invites").update({ status: "revoked" }).eq("family_id", ctx.familyId).eq("status", "pending");
    return NextResponse.json({ ok: true });
  }

  const { data: target } = await sb
    .from("mothers").select("id, name, family_role").eq("id", parentId).eq("family_id", ctx.familyId).maybeSingle();
  if (!target || target.family_role !== "secondary") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  // الطلاب اللي أضافهم ينتقلون لصاحب الاشتراك حتى ما يضيعون بخروجه.
  await sb.from("children").update({ mother_id: motherId }).eq("mother_id", target.id);
  const { data: fresh } = await sb.from("families").insert({}).select("id").single();
  if (!fresh) return NextResponse.json({ error: "تعذّر الإخراج، حاولي مرة ثانية." }, { status: 500 });
  const { error } = await sb.from("mothers").update({ family_id: fresh.id, family_role: "primary" }).eq("id", target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity(sb, { familyId: ctx.familyId, actorId: motherId, actorName: ctx.name, action: "أخرجت ولي الأمر الثاني", entity: target.name });
  return NextResponse.json({ ok: true });
}
