import { supabaseAdmin } from "./supabase";
import { PLAN, PRODUCTS, splitPool } from "./plans";

// الثوابت بـlib/plans.js عشان الواجهة تستوردها بلا ما تسحب عميل Supabase
// الإداري لحزمة المتصفح. نعيد تصديرها هنا للمسارات اللي تستوردها من مكان واحد.
export { PLAN, PRODUCTS, SUBSCRIPTION_TIERS, CREDIT_PRODUCT_ID, splitPool } from "./plans";

const EMPTY = { plan: "free", included_questions: 0, used_questions: 0, credit_questions: 0, trial_used: 0 };

// تاريخ اليوم بتوقيت الكويت (UTC+3) — نفس ما تحسبه دالة قاعدة البيانات.
function kuwaitToday() {
  return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
}

// خصم سؤال واحد بشكل ذرّي (دالة بقاعدة البيانات تقفل السطر) — بدون القفل،
// سؤالان متزامنان يمرّان على آخر رصيد متبقٍ.
export async function consumeQuestion(childId, motherId) {
  const { data, error } = await supabaseAdmin().rpc("consume_question", {
    p_child_id: childId,
    p_mother_id: motherId,
    p_trial_limit: PLAN.TRIAL_QUESTIONS,
  });
  if (error) {
    console.error("consume_question failed:", error.message);
    // ما نمنع ولي الأمر بسبب خلل عندنا — نسمح ونسجّل الخطأ
    return { allowed: true, source: "error_fallback" };
  }
  return data;
}

export async function getEntitlement(childId) {
  const sb = supabaseAdmin();
  const { data } = await sb.from("entitlements").select("*").eq("child_id", childId).maybeSingle();
  return shapeEntitlement(data);
}

// استحقاقات كل أبناء ولي الأمر بطلب واحد — تستخدمها الواجهة لعرض المتبقي
// لكل طالب/ة بدون ما تسوي طلب لكل واحد.
export async function getEntitlementsForMother(motherId) {
  const sb = supabaseAdmin();
  const [{ data: kids }, { data: rows }] = await Promise.all([
    sb.from("children").select("id,name,grade").eq("mother_id", motherId).order("created_at"),
    sb.from("entitlements").select("*").eq("mother_id", motherId),
  ]);
  const byChild = Object.fromEntries((rows || []).map((r) => [r.child_id, r]));
  return (kids || []).map((k) => ({
    childId: k.id,
    childName: k.name,
    grade: k.grade,
    ...shapeEntitlement(byChild[k.id]),
  }));
}

function shapeEntitlement(row) {
  const e = row || EMPTY;
  const active = e.plan === "annual" && e.period_end && e.period_end >= kuwaitToday();

  const remainingSubscription = active ? Math.max(e.included_questions - e.used_questions, 0) : 0;
  const remainingTrial = Math.max(PLAN.TRIAL_QUESTIONS - (e.trial_used || 0), 0);
  return {
    plan: active ? "annual" : "free",
    periodEnd: active ? e.period_end : null,
    remainingSubscription,
    remainingCredits: e.credit_questions || 0,
    remainingTrial: active ? 0 : remainingTrial,
    remainingTotal: remainingSubscription + (e.credit_questions || 0) + (active ? 0 : remainingTrial),
    price: PLAN,
  };
}

// نمنح الاستحقاق بعد تحقق ناجح من الإيصال. المنح مرتبط بمعرّف المعاملة
// (فريد بجدول purchases) عشان إعادة إرسال نفس الإيصال ما تمنح مرتين.
export async function grantPurchase({ childId, motherId, platform, productId, transactionId, amountKwd = null, raw = null }) {
  const product = PRODUCTS[productId];
  if (!product) return { ok: false, error: "منتج غير معروف" };

  const sb = supabaseAdmin();

  // الاشتراك يشمل كل الأبناء (الرصيد عائلي وينقسم عليهم)، أما الرصيد
  // الإضافي فيُضاف لطالب/ة محدد — فنتحقق منه ونتأكد إنه يخص ولي الأمر
  // نفسه، وإلا صار بالإمكان شحن رصيد لطالب مو تابع للمشتري.
  let children = [];
  if (product.kind === "subscription") {
    const { data } = await sb.from("children").select("id").eq("mother_id", motherId).order("created_at");
    children = data || [];
    if (!children.length) return { ok: false, error: "ما فيه طلاب مسجّلين بعد" };
  } else {
    if (!childId) return { ok: false, error: "لازم تختارين الطالب/ة" };
    const { data: child } = await sb
      .from("children")
      .select("id")
      .eq("id", childId)
      .eq("mother_id", motherId)
      .maybeSingle();
    if (!child) return { ok: false, error: "الطالب/ة المحدد غير موجود" };
  }

  const { error: pErr } = await sb.from("purchases").insert({
    child_id: product.kind === "credits" ? childId : null,
    mother_id: motherId,
    platform,
    product_id: productId,
    kind: product.kind,
    transaction_id: transactionId,
    questions_granted: product.questions,
    amount_kwd: amountKwd,
    raw,
  });
  if (pErr) {
    // 23505 = تكرار: نفس المعاملة سبق منحها، فنعتبرها نجاحاً بلا منح ثانٍ
    if (pErr.code === "23505") return { ok: true, duplicate: true };
    return { ok: false, error: pErr.message };
  }

  if (product.kind === "subscription") {
    const start = new Date(Date.now() + 3 * 3600e3);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    const shares = splitPool(product.questions, children.length);

    // نكتب استحقاق كل طالب/ة بحصته من الرصيد العائلي. upsert بدفعة واحدة
    // عشان ما نخلي عائلة بنص اشتراك لو فشل سطر بالنص.
    const { error } = await sb.from("entitlements").upsert(
      children.map((c, i) => ({
        child_id: c.id,
        mother_id: motherId,
        plan: "annual",
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        included_questions: shares[i],
        used_questions: 0,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "child_id" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, granted: product.questions, kind: product.kind, students: children.length };
  } else {
    await sb
      .from("entitlements")
      .upsert({ child_id: childId, mother_id: motherId }, { onConflict: "child_id", ignoreDuplicates: true });
    const { data: cur } = await sb.from("entitlements").select("credit_questions").eq("child_id", childId).maybeSingle();
    const { error } = await sb.from("entitlements").update({
      credit_questions: (cur?.credit_questions || 0) + product.questions,
      updated_at: new Date().toISOString(),
    }).eq("child_id", childId);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, granted: product.questions, kind: product.kind };
}

// لما يضيف ولي الأمر طالباً بعد الشراء، الجديد يطلع بلا رصيد لأن القسمة
// صارت وقت الشراء. فنعيد توزيع المتبقي من الرصيد العائلي على الجميع —
// المجموع ما يتغير، بس يشمل الطالب/ة الجديد.
// الرصيد الإضافي (credit_questions) ما يدخل التوزيع لأنه اشتُري لطالب بعينه.
export async function redistributePool(motherId) {
  const sb = supabaseAdmin();
  const [{ data: kids }, { data: rows }] = await Promise.all([
    sb.from("children").select("id").eq("mother_id", motherId).order("created_at"),
    sb.from("entitlements").select("*").eq("mother_id", motherId),
  ]);
  if (!kids?.length || !rows?.length) return { ok: true, skipped: true };

  const active = rows.filter((r) => r.plan === "annual" && r.period_end && r.period_end >= kuwaitToday());
  if (!active.length) return { ok: true, skipped: true };

  const remaining = active.reduce(
    (sum, r) => sum + Math.max((r.included_questions || 0) - (r.used_questions || 0), 0),
    0
  );
  const shares = splitPool(remaining, kids.length);
  const { period_start, period_end } = active[0];

  const { error } = await sb.from("entitlements").upsert(
    kids.map((c, i) => ({
      child_id: c.id,
      mother_id: motherId,
      plan: "annual",
      period_start,
      period_end,
      included_questions: shares[i],
      used_questions: 0,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "child_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, redistributed: remaining, students: kids.length };
}
