import { kuwaitWeekMap } from "./kuwaitDate";

// القيم الوحيدة اللي تقبلها القاعدة (tasks_type_check).
const TASK_TYPES = new Set(["واجب", "حفظ", "اختبار", "مشروع", "درس"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cleanDate = (v) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
const text = (v) => {
  const s = v == null ? "" : String(v).trim();
  return s || null;
};
// رقم آية: عدد صحيح موجب معقول فقط، وأي شي غيره يبقى null بدل ما يُخمَّن.
const ayah = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 300 ? n : null;
};

// تطبيق مسودة خطة أسبوعية على جداول الطالب/ة. كان هذا المنطق داخل
// upload-schedule يشتغل مباشرة بعد التحليل؛ انفصل هنا لما دخلت خطوة مراجعة
// الأم قبل الحفظ — نفس القواعد بالضبط بلا تغيير:
// - الهوية = المادة + النوع + الموعد، فإعادة رفع نفس الخطة تحدّث بدل ما تكرر.
// - المنجز (done) يدخل بالمطابقة، وإلا صار له نسخة ثانية غير منجزة.
// - الحفظ ما يتكرر لو مرجعه موجود أصلاً وغير منجز.
export async function applyPlanItems(sb, childId, items, sourceId = null) {
  const { data: activeTasks } = await sb
    .from("tasks").select("id, subject, type, due_date, edited_by_user").eq("child_id", childId).in("status", ["active", "done"]);
  const taskKey = (s, t, d) => `${s}|${t}|${d || ""}`;
  const known = new Map((activeTasks || []).map((t) => [taskKey(t.subject, t.type, t.due_date), t]));

  let addedTasks = 0;
  let updatedTasks = 0;
  let addedReqs = 0;
  let updatedReqs = 0;
  let addedMemorization = 0;

  // لربط المستلزم بمهمته: المادة ← معرّفات مهامها بهذي الرفعة. الربط يصير
  // فقط لو المادة عندها مهمة وحدة بالضبط — أكثر من وحدة يعني الربط غامض،
  // والغامض يبقى بلا ربط بدل ما نخمّن مهمة من بينها.
  const bySubject = new Map();
  const remember = (subject, id) => {
    if (!id) return;
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(id);
  };

  for (const e of items.tasks || []) {
    const subject = text(e.subject);
    if (!subject) continue;
    const dueDate = cleanDate(e.dueDate);
    const details = text(e.details);
    const type = TASK_TYPES.has(e.type) ? e.type : "واجب";

    const key = taskKey(subject, type, dueDate);
    const existing = known.get(key);
    if (existing) {
      // تعديل الأم يتقدّم: صف عدّلته بنفسها ما تكتب فوقه قراءة جديدة لنفس
      // الخطة. بدون هذا كانت إعادة الرفع تمسح تصحيحها وترجّع نص النموذج.
      remember(subject, existing.id);
      if (!existing.edited_by_user) {
        await sb.from("tasks").update({ details, source_text: text(e.sourceText) }).eq("id", existing.id);
        updatedTasks++;
      }
    } else {
      const { data: inserted } = await sb.from("tasks").insert({
        child_id: childId,
        subject,
        type,
        due_date: dueDate,
        details,
        status: "active",
        source: "image",
        source_text: text(e.sourceText),
        source_id: sourceId,
        edited_by_user: !!e.editedByUser,
      }).select("id").single();
      if (inserted) {
        known.set(key, { id: inserted.id, edited_by_user: !!e.editedByUser });
        remember(subject, inserted.id);
      }
      addedTasks++;
    }
  }

  const { data: openReqs } = await sb
    .from("requirements").select("id, item, edited_by_user").eq("child_id", childId).eq("bought", false);
  const knownReqs = new Map((openReqs || []).map((r) => [r.item, r]));

  for (const r of items.requirements || []) {
    const item = text(r.item);
    if (!item) continue;
    const dueDate = cleanDate(r.dueDate);
    const related = bySubject.get(text(r.relatedSubject) || "");
    const taskId = related?.length === 1 ? related[0] : null;
    const existing = knownReqs.get(item);
    if (existing) {
      if (!existing.edited_by_user) {
        await sb.from("requirements").update({ due_date: dueDate, source_text: text(r.sourceText), task_id: taskId }).eq("id", existing.id);
        updatedReqs++;
      }
    } else {
      const { data: inserted } = await sb.from("requirements").insert({
        child_id: childId,
        item,
        due_date: dueDate,
        bought: false,
        source_text: text(r.sourceText),
        source_id: sourceId,
        task_id: taskId,
        edited_by_user: !!r.editedByUser,
      }).select("id").single();
      if (inserted) knownReqs.set(item, { id: inserted.id, edited_by_user: !!r.editedByUser });
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
        // المرجع يبقى كما كُتب بالصورة، والحقول المنظّمة جنبه لا بدلاً عنه.
        reference,
        details: text(m.details),
        surah: text(m.surah),
        from_ayah: ayah(m.fromAyah),
        to_ayah: ayah(m.toAyah),
        recite_on: cleanDate(m.reciteOn),
        source_text: text(m.sourceText),
        source_id: sourceId,
        edited_by_user: !!m.editedByUser,
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
