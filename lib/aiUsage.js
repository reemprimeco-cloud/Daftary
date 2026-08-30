import { supabaseAdmin } from "./supabase";

// أسعار الرموز بالدولار لكل مليون. لو غيّرنا النموذج، نضيف سطره هنا —
// وإلا تُحتسب التكلفة صفراً وتبان بالتقارير كخلل واضح بدل رقم مضلّل.
const PRICING = {
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export function usageCostUsd(model, usage = {}) {
  const p = PRICING[model];
  if (!p) return 0;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cRead = usage.cache_read_input_tokens || 0;
  const cWrite = usage.cache_creation_input_tokens || 0;
  return (
    (inTok * p.input + outTok * p.output + cRead * p.cacheRead + cWrite * p.cacheWrite) / 1e6
  );
}

// نسجّل الاستهلاك الفعلي المرتجع من الـAPI (مو تقديراً) عشان نقدر نسعّر
// الاشتراك على أرقام حقيقية. التسجيل ما يوقف الطلب أبداً لو فشل — قياس
// فاشل أهون من رد ضائع على ولي الأمر.
export async function logAiUsage({
  motherId = null,
  childId = null,
  feature,
  model,
  usage,
  hadImage = false,
  attachments = 0,
}) {
  try {
    await supabaseAdmin().from("ai_usage").insert({
      mother_id: motherId,
      child_id: childId,
      feature,
      model,
      input_tokens: usage?.input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
      cache_read_tokens: usage?.cache_read_input_tokens || 0,
      cache_write_tokens: usage?.cache_creation_input_tokens || 0,
      cost_usd: usageCostUsd(model, usage),
      had_image: hadImage,
      attachments,
    });
  } catch (e) {
    console.error("logAiUsage failed:", e?.message || e);
  }
}
