import { supabaseAdmin } from "@/lib/supabase";

// رفع الصور صار يطول ٤٥–٦٠ ثانية (فحص اتجاه + قراءة + تحقق)، والجهاز ما
// يصبر: قفل الشاشة أو ضعف الشبكة يقطع الطلب فتشوف الأم «Load failed» —
// بينما الخادم يكمّل ويحفظ فعلاً (شوهد ١٥ سبتمبر: أربع رفعات «فشلت» وكلها
// محفوظة). الحل: الجهاز يولّد معرّف مهمة ويرسله مع الصور، والخادم يسجّل
// النتيجة النهائية عليه، فلو انقطع الاتصال يسحبها الجهاز بالاستعلام بدل
// ما يعيد الرفع أو يعرض فشلاً كاذباً.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function jobIdFrom(body) {
  const id = body?.jobId;
  return typeof id === "string" && UUID_RE.test(id) ? id.toLowerCase() : null;
}

// المعرّف من العميل، فالإدراج فقط (بلا upsert): لو حاول أحد إعادة استخدام
// معرّف أم ثانية يفشل الإدراج بصمت ولا يُكتب فوق نتيجتها.
export async function openJob(jobId, motherId, endpoint) {
  if (!jobId || !motherId) return;
  const { error } = await supabaseAdmin()
    .from("upload_jobs")
    .insert({ id: jobId, mother_id: motherId, endpoint, status: "pending" });
  if (error) console.warn("upload_jobs open failed:", error.message);
}

// تُستدعى بالرد النهائي مهما كان (نجاح، خطأ، طلب تدوير) — فالجهاز يشوف
// نفس اللي كان بيشوفه لو الاتصال ما انقطع.
export async function closeJob(jobId, motherId, res) {
  if (!jobId || !motherId) return;
  const payload = await res.clone().json().catch(() => null);
  const status = payload?.needsRotation ? "rotate" : res.ok ? "done" : "error";
  const { error } = await supabaseAdmin()
    .from("upload_jobs")
    .update({ status, http_status: res.status, result: payload, finished_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("mother_id", motherId);
  if (error) console.warn("upload_jobs close failed:", error.message);
}
