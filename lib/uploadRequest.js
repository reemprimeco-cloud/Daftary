"use client";

// إرسال رفعة صور بطريقة تصمد لانقطاع الاتصال. التحليل يطول ٤٥–٦٠ ثانية،
// وجهاز الأم يقطع الطلب قبلها كثيراً (قفل الشاشة، ضعف الشبكة) فيطلع
// «Load failed» — والخادم يكون أكمل وحفظ فعلاً. الطريقة: نولّد معرّف مهمة
// ونرسله مع الصور، ونراقب بالتوازي: لو رجع رد الطلب مباشرة نعتمده، ولو
// انقطع نستعلم عن المهمة كل ثوانٍ لين يكتب الخادم نتيجتها (نفس الرد اللي
// كان بيوصل لو ما انقطع). والمؤقتات تتجمد بالخلفية وترجع مع فتح التطبيق،
// فالاستعلام يكمل من نفسه.

const POLL_MS = 3000;
// أقصى انتظار: مهلة دالة الخادم (١٢٠ ث) + رفع الصور — بعدها ما فيه أمل.
const MAX_WAIT_MS = 4 * 60 * 1000;
// ما نستعلم قبلها: الرد المباشر غالباً يوصل، والاستعلام المبكر كلفة بلا فائدة.
const FIRST_POLL_MS = 8000;
// بعد انقطاع الاتصال، لو المهمة غير موجودة بالخادم بعد هذا العدد من
// الاستعلامات فالصور ما وصلته أصلاً (انقطع أثناء الرفع).
const MISSING_LIMIT = 3;

const TICK = Symbol("tick");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function newJobId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function finish({ ok, data }) {
  if (!ok) {
    // الخطوات العملية تضيع لو مرّرنا النص وحده — نعلّقها على الخطأ نفسه.
    const err = new Error(data?.error || "تعذّر التحليل، جربي مرة ثانية.");
    err.tips = data?.tips || [];
    throw err;
  }
  return data || {};
}

export async function postUpload(endpoint, body, { fetchImpl = fetch, now = Date.now, wait = sleep } = {}) {
  const jobId = newJobId();
  const started = now();
  let netErr = null;

  const direct = fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, jobId }),
  })
    .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
    .catch((e) => { netErr = e; return null; });

  // بعد الانقطاع ما نراهن على الطلب المباشر أبداً — الاستعلام فقط.
  const never = new Promise(() => {});
  let pending = direct;
  let missing = 0;

  for (;;) {
    const r = await Promise.race([pending, wait(POLL_MS).then(() => TICK)]);
    if (r && r !== TICK) return finish(r);
    if (r === null) pending = never;

    if (now() - started >= FIRST_POLL_MS) {
      const job = await fetchImpl(`/api/upload-jobs/${jobId}`)
        .then(async (res) => (res.status === 404 ? { missing: true } : res.ok ? await res.json() : null))
        .catch(() => null);
      if (job && !job.missing && job.status && job.status !== "pending") {
        return finish({ ok: (job.httpStatus || 500) < 400, data: job.result });
      }
      if (netErr && job?.missing && ++missing >= MISSING_LIMIT) {
        throw new Error("انقطع الاتصال قبل ما توصل الصور. تأكدي من الشبكة وجربي مرة ثانية.");
      }
    }

    if (now() - started > MAX_WAIT_MS) {
      throw new Error(netErr
        ? "انقطع الاتصال أثناء التحليل وما قدرنا نجيب النتيجة. جربي مرة ثانية."
        : "التحليل طوّل أكثر من المعتاد. جربي مرة ثانية بعد شوي.");
    }
  }
}
