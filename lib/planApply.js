import { kuwaitWeekMap } from "./kuwaitDate";

// القيم الوحيدة اللي تقبلها القاعدة (tasks_type_check).
const TASK_TYPES = new Set(["واجب", "حفظ", "اختبار", "مشروع", "درس"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cleanDate = (v) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
const text = (v) => {
  const s = v == null ? "" : String(v).trim();
  return s || null;
};

// تطبيق مسودة خطة أسبوعية على جداول الطالب/ة. كان هذا المنطق داخل
// upload-schedule يشتغل مباشرة بعد التحليل؛ انفصل هنا لما دخلت خطوة مراجعة
// الأم قبل الحفظ — نفس القواعد بالضبط بلا تغيير:
// - الهوية = المادة + النوع + الموعد، فإعادة رفع نفس الخطة تحدّث بدل ما تكرر.
// - المنجز (done) يدخل بالمطابقة، وإلا صار له نسخة ثانية غير منجزة.
// - الحفظ ما يتكرر لو مرجعه موجود أصلاً وغير منجز.
export async function applyPlanItems(sb, childId, items) {
  const { data: activeTasks } = await sb
    .from("tasks").select("id, subject, type, due_date").eq("child_id", childId).in("status", ["active", "done"]);
  const taskKey = (s, t, d) => `${s}|${t}|${d || ""}`;
  const known = new Map((activeTasks || []).map((t) => [taskKey(t.subject, t.type, t.due_date), t.id]));

  let addedTasks = 0;
  let updatedTasks = 0;
  let addedReqs = 0;
  let updatedReqs = 0;
  let addedMemorization = 0;

  for (const e of items.tasks || []) {
    const subject = text(e.subject);
    if (!subject) continue;
    const dueDate = cleanDate(e.dueDate);
    const details = text(e.details);
    const type = TASK_TYPES.has(e.type) ? e.type : "واجب";

    const key = taskKey(subject, type, dueDate);
    const existingId = known.get(key);
    if (existingId) {
      await sb.from("tasks").update({ details }).eq("id", existingId);
      updatedTasks++;
    } else {
      const { data: inserted } = await sb.from("tasks").insert({
        child_id: childId,
        subject,
        type,
        due_date: dueDate,
        details,
        status: "active",
        source: "image",
      }).select("id").single();
      if (inserted) known.set(key, inserted.id);
      addedTasks++;
    }
  }

  const { data: openReqs } = await sb
    .from("requirements").select("id, item").eq("child_id", childId).eq("bought", false);
  const knownReqs = new Map((openReqs || []).map((r) => [r.item, r.id]));

  for (const r of items.requirements || []) {
    const item = text(r.item);
    if (!item) continue;
    const dueDate = cleanDate(r.dueDate);
    const existingId = knownReqs.get(item);
    if (existingId) {
      await sb.from("requirements").update({ due_date: dueDate }).eq("id", existingId);
      updatedReqs++;
    } else {
      const { data: inserted } = await sb.from("requirements").insert({
        child_id: childId,
        item,
        due_date: dueDate,
        bought: false,
      }).select("id").single();
      if (inserted) knownReqs.set(item, inserted.id);
      addedReqs++;
    }
  }

  for (const m of items.memorization || []) {
    const reference = text(m.reference);
    if (!reference) continue;
    const kind = m.kind === "حديث" ? "حديث" : "آية";

    const { data: existingMem } = await sb
      .from("memorization")
      .select("id")
      .eq("child_id", childId)
      .eq("reference", reference)
      .eq("done", false)
      .maybeSingle();

    if (!existingMem) {
      await sb.from("memorization").insert({
        child_id: childId,
        kind,
        reference,
        details: text(m.details),
      });
      addedMemorization++;
    }
  }

  return { addedTasks, updatedTasks, addedReqs, updatedReqs, addedMemorization };
}

// عدّ العناصر الفعلي لشاشة المراجعة («تم العثور على ٨ عناصر») — محسوب من
// النتيجة نفسها، ما فيه أي رقم ثابت.
export function summarize(items) {
  const byType = (t) => (items.tasks || []).filter((e) => e.type === t).length;
  return {
    homework: byType("واجب"),
    exams: byType("اختبار"),
    projects: byType("مشروع"),
    lessons: byType("درس"),
    memorizationTasks: byType("حفظ"),
    requirements: (items.requirements || []).length,
    memorization: (items.memorization || []).length,
    total: (items.tasks || []).length + (items.requirements || []).length + (items.memorization || []).length,
  };
}

// رفعة خطة جديدة = فرصة تنظيف: المنجز من أسابيع فاتت (أو بلا تاريخ أصلاً —
// عبارات نسبية مثل «نهاية الفصل الدراسي») ما له داعٍ يبقى بالواجهة للأبد.
// الحذف نهائي وللمنجز فقط — غير المنجز (حتى لو قديم) يبقى كما هو.
export async function cleanupCompletedBeforeThisWeek(sb, childId) {
  const { sunday } = kuwaitWeekMap();
  await sb.from("tasks").delete().eq("child_id", childId).eq("status", "done").or(`due_date.is.null,due_date.lt.${sunday}`);
  // التسميع ما له تاريخ استحقاق بالقاعدة أصلاً، فكل منجز منه (من أي وقت
  // مضى) يعتبر «قديم» بمجرد رفع خطة جديدة.
  await sb.from("memorization").delete().eq("child_id", childId).eq("done", true);
}
