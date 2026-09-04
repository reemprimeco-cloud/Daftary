// اشتراك التطبيق الشامل — منفصل تماماً عن اشتراك المعلم الذكي (lib/plans.js).
// هذا يغطي كل التطبيق (الجداول، الواجبات، الحفظ، الدرجات...)، وذاك يبقى
// خاصاً بميزة المعلم الذكي وحدها.
//
// آبل ما تسمح تشترين نفس منتج الاشتراك أكثر من مرة على نفس الحساب، فما
// نقدر نسوي "ادفعي ٢ د.ك كل ما تضيفين طالب" كشراء متكرر لنفس المنتج.
// الحل: منتج منفصل لكل عدد طلاب بالضبط، وكلها بنفس Subscription Group —
// فلما تضيف الأم طالباً، تترقّى بضغطة وآبل تحسب الفرق تلقائياً (upgrade
// داخل المجموعة، مو شراء منفصل).
//
// السعر خطي: ٢ د.ك للطالب الواحد، بسقف عند ٧ طلاب فأكثر — بدون السقف
// نحتاج منتجاً لكل رقم ممكن نظرياً بلا نهاية.
export const APP_PLAN = {
  PRICE_PER_STUDENT_KWD: 2,
  MAX_TIER: 7,
};

function tierProductId(n) {
  return `app.reemora.daftary.access.students${n}`;
}

// أرقام عربية-هندية — نفس أسلوب بقية التطبيق (٦٠٠ سؤال، ١٠٠٠ سؤال...)
// بدل الأرقام اللاتينية الافتراضية من template literals.
function arabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
}

// المنتجات السبعة — واحد لكل عدد طلاب بالضبط من ١ لين ٦، والسابع سقف
// ثابت (٧ فأكثر) بدل منتج لكل رقم بلا حدود.
export const APP_PRODUCTS = Object.fromEntries(
  Array.from({ length: APP_PLAN.MAX_TIER }, (_, i) => i + 1).map((n) => {
    const isCeiling = n === APP_PLAN.MAX_TIER;
    return [
      tierProductId(n),
      {
        kind: "subscription",
        maxStudents: isCeiling ? Infinity : n,
        priceKwd: n * APP_PLAN.PRICE_PER_STUDENT_KWD,
        label: isCeiling ? `${arabicDigits(n)} طلاب فأكثر` : n === 1 ? "طالب واحد" : n === 2 ? "طالبان" : `${arabicDigits(n)} طلاب`,
      },
    ];
  })
);

// الباقات مرتبة تصاعدياً — تستخدمها الواجهة والتوصية بالباقة المناسبة.
export const APP_TIERS = Object.entries(APP_PRODUCTS)
  .map(([productId, p]) => ({ productId, ...p }))
  .sort((a, b) => a.priceKwd - b.priceKwd);

// أصغر باقة تكفي عدد الطلاب الحالي — تستخدمها الواجهة تقترح المنتج
// المناسب وقت الترقية (إضافة طالب يتجاوز الباقة الحالية).
export function appTierFor(studentsCount) {
  const n = Math.max(1, studentsCount);
  return APP_TIERS.find((t) => n <= t.maxStudents) || APP_TIERS.at(-1);
}
