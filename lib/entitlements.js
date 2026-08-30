import { supabaseAdmin } from "./supabase";

// خطة المعلم الذكي: اشتراك سنوي بحد أسئلة + رصيد إضافي يُشترى عند الحاجة.
// الأرقام مبنية على تكلفة قياسية ~$0.013 للسؤال بعد تقليل مرفقات الاختبارات،
// وعمولة آبل ١٥٪ (برنامج الشركات الصغيرة).
export const PLAN = {
  TRIAL_QUESTIONS: 20,
  ANNUAL_QUESTIONS: 300,
  ANNUAL_PRICE_KWD: 3,
  CREDIT_PACK_QUESTIONS: 100,
  CREDIT_PACK_PRICE_KWD: 1,
};

// معرّفات منتجات آبل — لازم تطابق اللي بـApp Store Connect حرفياً.
export const PRODUCTS = {
  "app.reemora.daftary.teacher.annual": { kind: "subscription", questions: PLAN.ANNUAL_QUESTIONS },
  "app.reemora.daftary.teacher.credits100": { kind: "credits", questions: PLAN.CREDIT_PACK_QUESTIONS },
};

// خصم سؤال واحد بشكل ذرّي (دالة بقاعدة البيانات تقفل السطر) — بدون القفل،
// سؤالان متزامنان يمرّان على آخر رصيد متبقٍ.
export async function consumeQuestion(motherId) {
  const { data, error } = await supabaseAdmin().rpc("consume_question", {
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

export async function getEntitlement(motherId) {
  const sb = supabaseAdmin();
  const { data } = await sb.from("entitlements").select("*").eq("mother_id", motherId).maybeSingle();
  const e = data || { plan: "free", included_questions: 0, used_questions: 0, credit_questions: 0, trial_used: 0 };

  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const active = e.plan === "annual" && e.period_end && e.period_end >= today;

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
export async function grantPurchase({ motherId, platform, productId, transactionId, amountKwd = null, raw = null }) {
  const product = PRODUCTS[productId];
  if (!product) return { ok: false, error: "منتج غير معروف" };

  const sb = supabaseAdmin();
  const { error: pErr } = await sb.from("purchases").insert({
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

  await sb.from("entitlements").upsert({ mother_id: motherId }, { onConflict: "mother_id", ignoreDuplicates: true });

  if (product.kind === "subscription") {
    const start = new Date(Date.now() + 3 * 3600e3);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    const { error } = await sb.from("entitlements").update({
      plan: "annual",
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      included_questions: product.questions,
      used_questions: 0,
      updated_at: new Date().toISOString(),
    }).eq("mother_id", motherId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: cur } = await sb.from("entitlements").select("credit_questions").eq("mother_id", motherId).maybeSingle();
    const { error } = await sb.from("entitlements").update({
      credit_questions: (cur?.credit_questions || 0) + product.questions,
      updated_at: new Date().toISOString(),
    }).eq("mother_id", motherId);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, granted: product.questions, kind: product.kind };
}
