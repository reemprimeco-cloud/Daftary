// ثوابت الباقات — بلا أي استيراد من السيرفر، عشان الواجهة تقدر تستوردها
// بدون ما تسحب معها عميل Supabase الإداري لحزمة المتصفح.
//
// الباقة تُباع بعدد الأسئلة مو بعدد الطلاب: ولي الأمر يختار على قد استخدامه
// المتوقع، والرصيد ينقسم بالتساوي على أبنائه أياً كان عددهم. تكلفتنا مسقوفة
// بعدد الأسئلة نفسه، فعائلة من خمسة على باقة ٦٠٠ تكلّفنا نفس عائلة من واحد.
//
// السعر عشرة فلوس للسؤال بالباقتين، والتكلفة القياسية ~$0.015 للسؤال،
// وعمولة آبل ١٥٪ (برنامج الشركات الصغيرة) — أي هامش ~٤٦٪.
export const PLAN = {
  TRIAL_QUESTIONS: 10,
  CREDIT_PACK_QUESTIONS: 50,
  CREDIT_PACK_PRICE_KWD: 1,
};

// معرّفات منتجات آبل — لازم تطابق اللي بـApp Store Connect حرفياً،
// والاشتراكان لازم يكونان بنفس subscription group عشان الترقية بين
// الباقتين تشتغل بضغطة بدل إلغاء ثم شراء.
export const PRODUCTS = {
  "app.reemora.daftary.teacher.q600": {
    kind: "subscription", questions: 600, priceKwd: 6, label: "٦٠٠ سؤال",
  },
  "app.reemora.daftary.teacher.q1000": {
    kind: "subscription", questions: 1000, priceKwd: 10, label: "١٠٠٠ سؤال",
  },
  "app.reemora.daftary.teacher.credits50": {
    kind: "credits", questions: PLAN.CREDIT_PACK_QUESTIONS, priceKwd: PLAN.CREDIT_PACK_PRICE_KWD,
    label: "رصيد إضافي ٥٠ سؤال",
  },
};

// الباقات المعروضة بشاشة الاشتراك، مرتبة من الأصغر.
export const SUBSCRIPTION_TIERS = Object.entries(PRODUCTS)
  .filter(([, p]) => p.kind === "subscription")
  .map(([productId, p]) => ({ productId, ...p }))
  .sort((a, b) => a.questions - b.questions);

export const CREDIT_PRODUCT_ID = "app.reemora.daftary.teacher.credits50";

// ما نرشّح باقة حسب عدد الأبناء عمداً: الشاشة وحدة للجميع وما تتغير لو
// أضاف ولي الأمر ابناً أو حذف، والقسمة تُعرض كقاعدة ثابتة بسطر واحد بدل
// أرقام محسوبة تصير غلط أول ما يتغير العدد.

// قسمة الرصيد على الأبناء بالتساوي، والباقي يتوزع على الأوائل عشان ما
// تضيع أسئلة بالتقريب لأسفل.
export function splitPool(pool, count) {
  if (count <= 0) return [];
  const per = Math.floor(pool / count);
  const remainder = pool - per * count;
  return Array.from({ length: count }, (_, i) => per + (i < remainder ? 1 : 0));
}
