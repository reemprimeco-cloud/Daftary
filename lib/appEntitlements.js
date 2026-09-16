import { supabaseAdmin } from "./supabase";
import { APP_PRODUCTS, APP_PLAN } from "./appPlans";
import { normalizeKuwaitPhone } from "./otp";

// مفتاح الإيقاف الكامل — بدون هذا المتغير، اشتراك التطبيق الشامل معطّل
// تماماً ولا يؤثر على أي مستخدم، حتى لو الكود منشور بالمستودع.
//
//   APP_PAYWALL_ENABLED = "true" لتفعيل الاشتراك — ويُلزم الجميع فوراً.
//
// ما فيه فترة تجربة مجانية: قرار صاحبة التطبيق يوم إطلاق الحملة (١٥ سبتمبر
// ٢٠٢٦) إلغاؤها للجميع من لحظتها. كانت هنا آلية تاريخ إلزام عام
// (APP_PAYWALL_ENFORCE_AT) + مدة سماح من التسجيل — أُزيلت عمداً عشان
// الإلزام ما يعتمد على تاريخ بمتغير بيئة ما ينشاف من الكود.
export function appPaywallEnabled() {
  return process.env.APP_PAYWALL_ENABLED === "true";
}

// الحالة الحالية للميزة — تستخدمها الواجهة لتقرر تمنع الدخول أو لا:
//   "off"      — معطّلة بالكامل، كل شي مجاني
//   "enforced" — يُطلب اشتراك فعلياً
export function appPaywallState() {
  return appPaywallEnabled() ? { phase: "enforced", enforceAt: null } : { phase: "off", enforceAt: null };
}

// تجربة مجانية لمرة واحدة لكل أم (قرار ١٦ سبتمبر ٢٠٢٦، يعدّل قرار ١٥ سبتمبر
// أعلاه): طالب أول واحد، وجدول حصص واحد، وخطة أسبوعية واحدة — كل عنصر
// يُحتسب فقط عند نجاحه فعلياً (طالب يُضاف، تحليل يُحفظ)، لا عند مجرد
// المحاولة. بلا حد زمني: تبقى متاحة لين تُستهلك بغض النظر عن الوقت. تسري
// بأثر رجعي على كل أم مسجّلة سابقاً بلا اشتراك (الأعمدة تبدأ false للجميع).
// أسئلة المعلم الذكي التجريبية (١٠ أسئلة) مستقلة أصلاً بـlib/plans.js
// ولا تحتاج أي تغيير هنا.
//
// إضافة الطالب الأول مجاناً: بلا اشتراك وبلا طالب مسجّل بعد.
export function childAddAllowedByTrial(access) {
  return !access.subscription && (access.studentsCount || 0) === 0;
}

// المسارات المستثناة من الحجب لأجل التجربة — تُنادى من middleware.js بعد
// التأكد إن الوصول العام محجوب أصلاً (access.allowed === false).
export function isTrialExempt(access, method, pathname) {
  if (method !== "POST") return false;
  if (pathname === "/api/children") return childAddAllowedByTrial(access);
  if (pathname === "/api/upload-class-schedule") return !!access.trial?.scheduleAvailable;
  if (pathname === "/api/upload-schedule") return !!access.trial?.planAvailable;
  return false;
}

// تُنادى بعد نجاح حفظ جدول حصص أو خطة أسبوعية فعلياً — تُستهلك التجربة
// فقط هنا، فمحاولة فشلت (صورة غير واضحة، قراءة ناقصة) ما تخسّرها. آمنة
// النداء حتى لمشتركة فعلاً (العمود ما يُقرأ إلا لغير المشتركة).
export async function markTrialUploadUsed(motherId, kind) {
  if (!motherId) return;
  const col = kind === "schedule" ? "trial_schedule_used" : "trial_plan_used";
  const { error } = await supabaseAdmin().from("mothers").update({ [col]: true }).eq("id", motherId);
  if (error) console.warn(`markTrialUploadUsed(${kind}) failed:`, error.message);
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

// هل عند ولي الأمر وصول لكامل التطبيق؟ true دائماً لو الميزة معطّلة —
// وإلا لازم اشتراك سارٍ يغطي عدد أبنائه.
export async function hasAppAccess(motherId) {
  const paywallOn = appPaywallEnabled();
  const reviewPhoneSet = !!process.env.APPLE_REVIEW_PHONE;
  // لو الميزة مطفّاة أصلاً وما فيه رقم مراجعة مُعرَّف، ما فيه أي احتمال
  // نطلب اشتراكاً من أي حد — نطلع فوراً بلا أي استعلام لقاعدة البيانات.
  if (!paywallOn && !reviewPhoneSet) return { allowed: true, phase: "off", enforceAt: null };

  const sb = supabaseAdmin();
  // هالدالة تنادى من middleware.js على كل طلب API، فأي رحلة شبكة زايدة هنا
  // تنضاف على كل ضغطة زر بالتطبيق. الاستعلامات الثلاثة مستقلة عن بعض —
  // كان استعلام الأم لحاله ثم الباقيين، أي رحلتين متتاليتين بدل وحدة.
  const [{ data: mother }, { data: sub }, { count: studentsCount }] = await Promise.all([
    sb.from("mothers").select("created_at,phone,trial_schedule_used,trial_plan_used").eq("id", motherId).maybeSingle(),
    sb.from("app_subscriptions").select("*").eq("mother_id", motherId).maybeSingle(),
    sb.from("children").select("*", { count: "exact", head: true }).eq("mother_id", motherId),
  ]);

  const phase = isAppleReviewPhone(mother?.phone) || paywallOn ? "enforced" : "off";
  if (phase === "off") return { allowed: true, phase, enforceAt: null };

  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // بتوقيت الكويت
  const active = sub?.plan === "active" && sub?.period_end && sub.period_end >= today;
  const covered = active && sub.max_students >= (studentsCount || 0);

  // التجربة المجانية لمرة واحدة (راجع الشرح أعلاه) — غير ذات معنى لمشتركة
  // فعلاً، لكن حسابها هنا مجاني (بلا استعلام إضافي) وvisibleAllowed يبقى
  // كما هو مبنياً على الاشتراك فقط؛ الاستثناءات تُطبَّق بـisTrialExempt.
  const trial = { scheduleAvailable: !active && !mother?.trial_schedule_used, planAvailable: !active && !mother?.trial_plan_used };

  return { allowed: covered, phase, subscription: sub || null, studentsCount: studentsCount || 0, trial };
}

// نمنح الاشتراك بعد تحقق ناجح من الإيصال. المنح مرتبط بمعرّف المعاملة
// (فريد بجدول app_purchases) عشان إعادة إرسال نفس الإيصال ما تمنح مرتين.
export async function grantAppSubscription({ motherId, platform, productId, transactionId, expiresAt = null, amountKwd = null, raw = null }) {
  const product = APP_PRODUCTS[productId];
  if (!product) return { ok: false, error: "منتج غير معروف" };

  const maxStudents = product.maxStudents === Infinity ? 9999 : product.maxStudents;
  // آبل وGoogle ما يرسلان المبلغ المحصَّل فعلياً بردّ التحقق (خلاف Tap، اللي
  // يمرّره صراحةً) — فكانت لوحة الإدمن تعرض «−» لكل مشتريات المتجرين رغم
  // إنهما فعليتان ومدفوعتان. السعر ثابت لكل منتج بالدفعة الواحدة (ما فيه
  // عروض أو خصومات)، فسعر الكتالوج هو المبلغ الحقيقي المحصَّل.
  const amount = amountKwd ?? product.priceKwd;
  const sb = supabaseAdmin();
  const { error: pErr } = await sb.from("app_purchases").insert({
    mother_id: motherId,
    platform,
    product_id: productId,
    transaction_id: transactionId,
    max_students: maxStudents,
    amount_kwd: amount,
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
