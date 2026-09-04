import { supabaseAdmin } from "./supabase";
import { APP_PRODUCTS } from "./appPlans";

// مفتاح الإيقاف الكامل — بدون هذين المتغيرين، اشتراك التطبيق الشامل معطّل
// تماماً ولا يؤثر على أي مستخدم، حتى لو الكود منشور بالمستودع.
//
//   APP_PAYWALL_ENABLED    = "true" لتفعيل الميزة أصلاً (لسا مو إلزامية)
//   APP_PAYWALL_ENFORCE_AT = تاريخ/وقت ISO — قبل، الاستخدام مجاني مع تنبيه؛
//                            بعده، يُطلب اشتراك فعلياً
//
// هذا يفصل بين ثلاث مراحل بمتغيّر بيئة واحد بدون أي نشر جديد للكود:
// معطّل بالكامل → مفعّل بفترة سماح مع تنبيه → مفعّل بإلزام.
export function appPaywallEnabled() {
  return process.env.APP_PAYWALL_ENABLED === "true";
}

function enforceAt() {
  const raw = process.env.APP_PAYWALL_ENFORCE_AT;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// الحالة الحالية للميزة — تستخدمها الواجهة لتقرر تعرض شريط تنبيه أو تمنع
// الدخول:
//   "off"      — معطّلة بالكامل، كل شي مجاني (الوضع الحالي والافتراضي)
//   "grace"    — مفعّلة لكن قبل تاريخ الإلزام: مجاني مع تنبيه بالتاريخ القادم
//   "enforced" — بعد تاريخ الإلزام: يُطلب اشتراك فعلياً
export function appPaywallState() {
  if (!appPaywallEnabled()) return { phase: "off", enforceAt: null };
  const at = enforceAt();
  if (!at) return { phase: "off", enforceAt: null }; // مفعّلة بلا تاريخ = لسا ما قررنا التوقيت، نتصرف كمعطّلة
  return { phase: Date.now() >= at.getTime() ? "enforced" : "grace", enforceAt: at.toISOString() };
}

// هل عند ولي الأمر وصول لكامل التطبيق؟ true دائماً لو الميزة مو مُلزمة بعد
// (معطّلة أو بفترة سماح) — الإلزام الفعلي يبدأ بس بمرحلة "enforced".
export async function hasAppAccess(motherId) {
  const { phase, enforceAt: at } = appPaywallState();
  if (phase !== "enforced") return { allowed: true, phase, enforceAt: at };

  const sb = supabaseAdmin();
  const [{ data: sub }, { count: studentsCount }] = await Promise.all([
    sb.from("app_subscriptions").select("*").eq("mother_id", motherId).maybeSingle(),
    sb.from("children").select("*", { count: "exact", head: true }).eq("mother_id", motherId),
  ]);

  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // بتوقيت الكويت
  const active = sub?.plan === "active" && sub?.period_end && sub.period_end >= today;
  const covered = active && sub.max_students >= (studentsCount || 0);

  return { allowed: covered, phase, subscription: sub || null, studentsCount: studentsCount || 0 };
}

// نمنح الاشتراك بعد تحقق ناجح من الإيصال. المنح مرتبط بمعرّف المعاملة
// (فريد بجدول app_purchases) عشان إعادة إرسال نفس الإيصال ما تمنح مرتين.
export async function grantAppSubscription({ motherId, platform, productId, transactionId, amountKwd = null, raw = null }) {
  const product = APP_PRODUCTS[productId];
  if (!product) return { ok: false, error: "منتج غير معروف" };

  const sb = supabaseAdmin();
  const { error: pErr } = await sb.from("app_purchases").insert({
    mother_id: motherId,
    platform,
    product_id: productId,
    transaction_id: transactionId,
    max_students: product.maxStudents === Infinity ? 9999 : product.maxStudents,
    amount_kwd: amountKwd,
    raw,
  });
  if (pErr) {
    if (pErr.code === "23505") return { ok: true, duplicate: true }; // نفس المعاملة سبق منحها
    return { ok: false, error: pErr.message };
  }

  const start = new Date(Date.now() + 3 * 3600e3);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);

  const { error } = await sb.from("app_subscriptions").upsert(
    {
      mother_id: motherId,
      plan: "active",
      max_students: product.maxStudents === Infinity ? 9999 : product.maxStudents,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mother_id" }
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true, maxStudents: product.maxStudents };
}
