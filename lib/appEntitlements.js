import { supabaseAdmin } from "./supabase";
import { APP_PRODUCTS, APP_PLAN } from "./appPlans";
import { normalizeKuwaitPhone } from "./otp";

// مفتاح الإيقاف الكامل — بدون هذين المتغيرين، اشتراك التطبيق الشامل معطّل
// تماماً ولا يؤثر على أي مستخدم، حتى لو الكود منشور بالمستودع.
//
//   APP_PAYWALL_ENABLED    = "true" لتفعيل الميزة أصلاً
//   APP_PAYWALL_ENFORCE_AT = تاريخ/وقت ISO لبداية الإلزام — يخص المستخدمين
//                            المسجَّلين *قبل* هذا التاريخ (انظر GRACE_DAYS)
export function appPaywallEnabled() {
  return process.env.APP_PAYWALL_ENABLED === "true";
}

function globalEnforceAt() {
  const raw = process.env.APP_PAYWALL_ENFORCE_AT;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// تجربة مجانية بنفس الطول للجميع (APP_PLAN.GRACE_DAYS)، لكن من نقطة بداية
// مختلفة حسب توقيت التسجيل — عشان ولي أمر يسجّل قبل الإلزام بيوم ما يفاجئه
// الاشتراك فوراً، وولي أمر قديم ياخذ المدة كاملة من تاريخ التفعيل:
//   - مسجَّل قبل APP_PAYWALL_ENFORCE_AT  → إلزامه من نفس هذا التاريخ
//   - مسجَّل بعده (مستخدم جديد بعد الإطلاق) → إلزامه بعد المدة من تسجيله هو
// نأخذ الأبعد زمنياً من (تاريخ التفعيل) و(تسجيله + المدة) — فالقديم يرجع
// تاريخ التفعيل، والجديد يرجع تسجيله + المدة.
function enforceAtFor(motherCreatedAt) {
  const global = globalEnforceAt();
  if (!global) return null;
  const fromSignup = motherCreatedAt ? new Date(new Date(motherCreatedAt).getTime() + APP_PLAN.GRACE_DAYS * 86400e3) : null;
  if (!fromSignup || Number.isNaN(fromSignup.getTime())) return global;
  return fromSignup > global ? fromSignup : global;
}

// الحالة الحالية للميزة لولي أمر معيّن — تستخدمها الواجهة لتقرر تعرض شريط
// تنبيه أو تمنع الدخول:
//   "off"      — معطّلة بالكامل، كل شي مجاني (الوضع الافتراضي)
//   "grace"    — قبل تاريخ إلزامه الشخصي: مجاني مع تنبيه بالتاريخ القادم
//   "enforced" — بعد تاريخ إلزامه الشخصي: يُطلب اشتراك فعلياً
// (hasAppAccess تضيف حالة رابعة "active" لمن اشترك وهو بفترة السماح — انظرها)
export function appPaywallState(motherCreatedAt = null) {
  if (!appPaywallEnabled()) return { phase: "off", enforceAt: null };
  const at = enforceAtFor(motherCreatedAt);
  if (!at) return { phase: "off", enforceAt: null }; // مفعّلة بلا تاريخ = لسا ما قررنا التوقيت، نتصرف كمعطّلة
  return { phase: Date.now() >= at.getTime() ? "enforced" : "grace", enforceAt: at.toISOString() };
}

// حساب مراجعة آبل — نفس الرقم المستخدم بتسجيل الدخول لتجاوز Twilio
// (lib/otp.js، APPLE_REVIEW_PHONE). نستخدمه هنا أيضاً ليشوف شاشة اشتراك
// دفتري بحالة "enforced" دائماً، بغض النظر عن فترة السماح الحقيقية —
// عشان المراجع يقدر يختبر الشراء فوراً وقت المراجعة، بدل ما ننتظر فترة
// السماح تنتهي على كل المستخدمين قبل ما نقدر نثبت لآبل إن الشراء يشتغل.
function isAppleReviewPhone(phone) {
  const review = normalizeKuwaitPhone(process.env.APPLE_REVIEW_PHONE || "");
  return !!review && !!phone && phone === review;
}

// هل عند ولي الأمر وصول لكامل التطبيق؟ true دائماً لو الميزة مو مُلزمة بعد
// (معطّلة أو بفترة سماح) — الإلزام الفعلي يبدأ بس بمرحلة "enforced".
export async function hasAppAccess(motherId) {
  const paywallOn = appPaywallEnabled() && !!globalEnforceAt();
  const reviewPhoneSet = !!process.env.APPLE_REVIEW_PHONE;
  // لو الميزة مطفّاة أصلاً وما فيه رقم مراجعة مُعرَّف، ما فيه أي احتمال
  // نطلب اشتراكاً من أي حد — نطلع فوراً بلا أي استعلام لقاعدة البيانات.
  if (!paywallOn && !reviewPhoneSet) return { allowed: true, phase: "off", enforceAt: null };

  const sb = supabaseAdmin();
  const { data: mother } = await sb.from("mothers").select("created_at,phone").eq("id", motherId).maybeSingle();

  let phase, at;
  if (isAppleReviewPhone(mother?.phone)) {
    phase = "enforced";
    at = null;
  } else if (paywallOn) {
    ({ phase, enforceAt: at } = appPaywallState(mother?.created_at));
  } else {
    phase = "off";
    at = null;
  }
  if (phase === "off") return { allowed: true, phase, enforceAt: at };

  const [{ data: sub }, { count: studentsCount }] = await Promise.all([
    sb.from("app_subscriptions").select("*").eq("mother_id", motherId).maybeSingle(),
    sb.from("children").select("*", { count: "exact", head: true }).eq("mother_id", motherId),
  ]);

  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // بتوقيت الكويت
  const active = sub?.plan === "active" && sub?.period_end && sub.period_end >= today;
  const covered = active && sub.max_students >= (studentsCount || 0);

  // من تشترك وهي بفترة التجربة: التجربة انتهت بالنسبة لها — ما عاد فيه
  // تاريخ إلزام قادم ينتظرها. نرجّعها "active" عشان يختفي شريط «تجربة
  // مجانية لمدة ٧ أيام» من شاشتها ويظهر اشتراكها الفعلي بالإعدادات، بدل
  // ما تضل تشوف تنبيه تجربة بعد ما دفعت وتشك إن دفعتها ما وصلت.
  if (phase === "grace") {
    if (!active) return { allowed: true, phase, enforceAt: at, subscription: null, studentsCount: studentsCount || 0 };
    return { allowed: true, phase: "active", subscription: sub, studentsCount: studentsCount || 0 };
  }

  return { allowed: covered, phase, subscription: sub || null, studentsCount: studentsCount || 0 };
}

// نمنح الاشتراك بعد تحقق ناجح من الإيصال. المنح مرتبط بمعرّف المعاملة
// (فريد بجدول app_purchases) عشان إعادة إرسال نفس الإيصال ما تمنح مرتين.
export async function grantAppSubscription({ motherId, platform, productId, transactionId, expiresAt = null, amountKwd = null, raw = null }) {
  const product = APP_PRODUCTS[productId];
  if (!product) return { ok: false, error: "منتج غير معروف" };

  const maxStudents = product.maxStudents === Infinity ? 9999 : product.maxStudents;
  const sb = supabaseAdmin();
  const { error: pErr } = await sb.from("app_purchases").insert({
    mother_id: motherId,
    platform,
    product_id: productId,
    transaction_id: transactionId,
    max_students: maxStudents,
    amount_kwd: amountKwd,
    raw,
  });

  let duplicate = false;
  if (pErr) {
    if (pErr.code !== "23505") return { ok: false, error: pErr.message };
    // نفس المعاملة سبق تسجيلها. ما نطلع من هنا فوراً: لو فشل تحديث
    // الاشتراك بالمحاولة السابقة (خلل عابر بقاعدة البيانات)، كان ولي الأمر
    // يبقى دافعاً بلا وصول للأبد — حتى «استعادة المشتريات» ترجّع «نجحت»
    // وما تصلح شي، لأن الإدراج يفشل بالتكرار قبل ما نوصل للتحديث. فنكمّل
    // للتحديث (وهو idempotent أصلاً) بعد ما نتأكد إن الشراء يخصه هو.
    duplicate = true;
    const { data: existing } = await sb
      .from("app_purchases")
      .select("mother_id")
      .eq("platform", platform)
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (existing && existing.mother_id !== motherId) {
      return { ok: false, error: "هذه المعاملة تخص حساباً آخر" };
    }
  }

  // تاريخ الانتهاء من المتجر نفسه، مو سنة ثابتة من وقت الشراء. المتجر هو
  // مصدر الحقيقة: هو اللي يعرف متى ينتهي فعلاً بعد ترقية أو إلغاء أو
  // استرجاع. السنة الثابتة كانت تعني إن من يشترك ثم يسترجع مبلغه يحتفظ
  // بالوصول سنة كاملة. نرجع للسنة فقط لو المتجر ما أعطانا تاريخاً.
  const start = new Date(Date.now() + 3 * 3600e3);
  const fromStore = expiresAt ? new Date(expiresAt) : null;
  const end = fromStore && !Number.isNaN(fromStore.getTime()) ? fromStore : (() => {
    const d = new Date(start);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  })();
  const periodEnd = end.toISOString().slice(0, 10);

  // ما نخلي إيصالاً قديماً يقلّص باقة سارية أكبر: «استعادة المشتريات» تعيد
  // إرسال معاملات المتجر، ولو رجعت معاملة باقة أصغر بعد ترقية، الكتابة
  // المباشرة كانت تنزّل تغطية ولي الأمر لباقة دفع أكثر منها.
  const { data: current } = await sb
    .from("app_subscriptions")
    .select("max_students, period_end")
    .eq("mother_id", motherId)
    .maybeSingle();
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const currentIsBetter =
    current?.period_end >= today && current?.max_students > maxStudents && current?.period_end >= periodEnd;
  if (currentIsBetter) return { ok: true, duplicate, maxStudents: current.max_students };

  const { error } = await sb.from("app_subscriptions").upsert(
    {
      mother_id: motherId,
      plan: "active",
      max_students: maxStudents,
      period_start: start.toISOString().slice(0, 10),
      period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mother_id" }
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true, duplicate, maxStudents: product.maxStudents };
}

// إنهاء الاشتراك فوراً — لاسترجاع المبلغ أو سحب الشراء من المتجر. بدونها
// من يطلب استرجاعاً من آبل يحتفظ بالوصول لين نهاية المدة المدفوعة.
// نبقي سجل app_purchases كما هو: هو سجل تاريخي لما حصل فعلاً، وحذفه
// يفتح باب منح نفس المعاملة من جديد.
export async function revokeAppSubscription(motherId, reason = "revoked") {
  const sb = supabaseAdmin();
  const yesterday = new Date(Date.now() + 3 * 3600e3 - 86400e3).toISOString().slice(0, 10);
  const { error } = await sb
    .from("app_subscriptions")
    .update({ plan: "free", period_end: yesterday, updated_at: new Date().toISOString() })
    .eq("mother_id", motherId);
  if (error) return { ok: false, error: error.message };
  console.log("app subscription revoked:", motherId, reason);
  return { ok: true };
}
