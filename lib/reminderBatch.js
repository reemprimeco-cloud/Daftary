import { mapPool, CONCURRENCY, deliverToMother } from "@/lib/pushDelivery";

// منطق الإرسال المشترك بين كرونات التذكير. كان كله داخل كرون الصباح، ولما
// صارت اختبارات تتذكّر بالعصر كذلك (قرار صاحبة التطبيق ٢٣ سبتمبر) احتاجه
// كرون المساء أيضاً — والنسخ بدل المشاركة يعني قاعدتين للتجميع ومنع
// التكرار تفترقان بصمت.

// التذكير يوصل لكل أولياء أمور العائلة (الأم والأب) لا لمن أنشأ الصف وحده.
// خريطة وحدة لكل تشغيلة بدل استعلام لكل عائلة — الجدول صغير والكرون يومي.
export async function loadFamilyParents(sb) {
  const { data } = await sb.from("mothers").select("id, family_id");
  const map = new Map();
  for (const m of data || []) {
    if (!m.family_id) continue;
    if (!map.has(m.family_id)) map.set(m.family_id, []);
    map.get(m.family_id).push(m.id);
  }
  return map;
}

// إرسال رسالة مجمّعة لكل ولي أمر بالعائلة، مع سجل مستقل لكل واحد — القيد
// بالقاعدة صار (task_id, kind, mother_id)، فسجل الأم ما يمنع وصول الأب.
// today: للرسائل اللي ما لها مهمة (تسميع، مستلزمات) نمنع التكرار بفحص
// سجل اليوم لنفس ولي الأمر.
export async function deliverToFamily(sb, parentIds, { title, text, kind, today, taskIds = [null] }) {
  let sent = 0;
  for (const motherId of parentIds || []) {
    if (today) {
      const { data: already } = await sb
        .from("reminder_log")
        .select("id")
        .eq("mother_id", motherId)
        .eq("kind", kind)
        .gte("sent_at", `${today}T00:00:00+03:00`)
        .limit(1);
      if (already?.length) continue;
    }
    if (!(await deliverToMother(sb, motherId, title, text))) continue;
    await sb.from("reminder_log").insert(taskIds.map((taskId) => ({ mother_id: motherId, task_id: taskId, kind })));
    sent += taskIds.length;
  }
  return sent;
}

// «واجبان» / «٥ واجبات» / «١٢ واجباً» — عربية سليمة بدل «5 واجب».
export function countTasks(n) {
  if (n === 2) return "واجبان";
  if (n <= 10) return `${n} واجبات`;
  return `${n} واجباً`;
}

// نص الإشعار المجمّع: المواد بأسمائها كما بالخطة (والنوع لو مو واجباً عادياً)،
// ولكل طالب/ة سطر لو الأم عندها أكثر من واحد بنفس الإشعار.
export function groupedText(tasks, kind, groupFn) {
  const byChild = new Map();
  for (const t of tasks) {
    const name = t.children?.name || "";
    if (!byChild.has(name)) byChild.set(name, []);
    byChild.get(name).push(t);
  }
  const label = (t) => (kind.startsWith("exam") || t.type === "واجب" ? t.subject : `${t.subject} (${t.type})`);
  if (byChild.size === 1) {
    const [name, list] = [...byChild.entries()][0];
    return groupFn(name, list.map(label).join("، "), list.length);
  }
  const lines = [...byChild.entries()].map(([name, list]) => `${name}: ${list.map(label).join("، ")}`);
  return groupFn("أبنائك", `\n${lines.join("\n")}`, tasks.length);
}

// إشعار واحد لكل ولي أمر لكل نوع، مو إشعار لكل واجب: خطة فيها خمسة واجبات
// ليوم الخميس كانت تطلّع خمسة إشعارات متتالية بنفس الدقيقة (طلب صاحبة
// التطبيق ١٦ سبتمبر). التكرار يبقى ممنوعاً بسجل reminder_log لكل واجب،
// ولكل ولي أمر على حدة: سجل الأم ما يمنع وصول التذكير للأب.
export async function sendTaskBatch(sb, parents, { rows, kind, title, groupTitle, textFn, groupFn }) {
  if (!rows?.length) return 0;

  const { data: logged } = await sb
    .from("reminder_log")
    .select("task_id, mother_id")
    .eq("kind", kind)
    .in("task_id", rows.map((t) => t.id));
  const already = new Set((logged || []).map((r) => `${r.task_id}|${r.mother_id}`));

  const byFamily = new Map();
  for (const t of rows) {
    const familyId = t.children?.family_id;
    if (!familyId) continue;
    if (!byFamily.has(familyId)) byFamily.set(familyId, []);
    byFamily.get(familyId).push(t);
  }

  const results = await mapPool([...byFamily.entries()], CONCURRENCY, async ([familyId, familyTasks]) => {
    let count = 0;
    for (const motherId of parents.get(familyId) || []) {
      const tasks = familyTasks.filter((t) => !already.has(`${t.id}|${motherId}`));
      if (!tasks.length) continue;
      const text = tasks.length === 1 ? textFn(tasks[0]) : groupedText(tasks, kind, groupFn);
      const heading = tasks.length === 1 ? title : groupTitle || title;
      if (!(await deliverToMother(sb, motherId, heading, text))) continue;
      await sb.from("reminder_log").insert(tasks.map((t) => ({ mother_id: motherId, task_id: t.id, kind })));
      count += tasks.length;
    }
    return count;
  });
  return results.reduce((a, b) => a + b, 0);
}

// تذكيرات الاختبار: أربعة لكل اختبار — قبل يومين وقبل يوم، وكل واحد منهما
// مرتين (صبح ٨ وعصر ٣). قرار صاحبة التطبيق ٢٣ سبتمبر، وبنفس القرار انلغى
// تذكير يوم الاختبار نفسه: صبح الاختبار ما عاد فيه وقت مذاكرة، والأربعة
// اللي قبله تكفي.
// كل نوع بمفتاح `kind` مستقل، فسجل reminder_log يمنع تكرار كل واحد على
// حدة — بلا هذا كان الصبح والعصر يتقاسمان سجلاً واحداً فيوصل أحدهما فقط.
export const EXAM_ROUNDS = {
  morning: [
    {
      offset: 2,
      kind: "exam_2_days_before",
      title: "اختبار بعد يومين",
      groupTitle: "اختبارات بعد يومين",
      textFn: (t) => `⏰ بعد يومين اختبار ${t.subject} لـ ${t.children.name} — ابدئي المذاكرة من الحين 📚`,
      groupFn: (who, list) => `⏰ بعد يومين اختبارات لـ ${who}: ${list} — ابدئي المذاكرة من الحين 📚`,
    },
    {
      offset: 1,
      kind: "exam_day_before",
      title: "تذكير اختبار غداً",
      groupTitle: "اختبارات غداً",
      textFn: (t) => `⏰ تذكير: اختبار ${t.subject} لـ ${t.children.name} غداً — وقت المذاكرة 📚`,
      groupFn: (who, list) => `⏰ غداً اختبارات لـ ${who}: ${list} — وقت المذاكرة 📚`,
    },
  ],
  evening: [
    {
      offset: 2,
      kind: "exam_2_days_before_pm",
      title: "اختبار بعد يومين",
      groupTitle: "اختبارات بعد يومين",
      textFn: (t) => `🌙 تذكير المساء: اختبار ${t.subject} لـ ${t.children.name} بعد يومين — خذي منه جزءاً اليوم 📚`,
      groupFn: (who, list) => `🌙 تذكير المساء: بعد يومين اختبارات لـ ${who}: ${list} 📚`,
    },
    {
      offset: 1,
      kind: "exam_day_before_pm",
      title: "اختبار غداً",
      groupTitle: "اختبارات غداً",
      textFn: (t) => `🌙 تذكير المساء: اختبار ${t.subject} لـ ${t.children.name} غداً — راجعي معه قبل النوم 📚`,
      groupFn: (who, list) => `🌙 تذكير المساء: غداً اختبارات لـ ${who}: ${list} — راجعي معهم قبل النوم 📚`,
    },
  ],
};

// يوم بعد `offset` يوماً بتوقيت الكويت، بصيغة YYYY-MM-DD.
export function dateOffset(kuwaitNowDate, days) {
  const d = new Date(kuwaitNowDate.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// التسميع اللي مكتوب له موعد بالخطة ياخذ نفس قاعدة بقية المواعيد: تذكير
// قبله بيوم وتذكير يومه. اللي بلا موعد يبقى على تذكير السبت والثلاثاء.
// مجمّع لكل ولي أمر (reminder_log.task_id يخص المهام، فنمنع التكرار باليوم).
// مشترك لأن تذكير «غداً» بكرون الصباح وتذكير «اليوم» انتقل لكرون ٦ الصبح
// (قرار صاحبة التطبيق ٢٣ سبتمبر).
export async function sendRecitationFor(sb, parents, { date, kind, title, phrase, today }) {
  const { data: due } = await sb
    .from("memorization")
    .select("reference, children(family_id, name)")
    .eq("done", false)
    .eq("recite_on", date);

  const byFamily = new Map();
  for (const m of due || []) {
    const familyId = m.children?.family_id;
    if (!familyId) continue;
    const entry = byFamily.get(familyId) || { refs: [], names: new Set() };
    entry.refs.push(m.reference);
    entry.names.add(m.children.name);
    byFamily.set(familyId, entry);
  }

  const results = await mapPool([...byFamily.entries()], CONCURRENCY, async ([familyId, { refs, names }]) => {
    const who = names.size === 1 ? [...names][0] : "أبنائك";
    return deliverToFamily(sb, parents.get(familyId), {
      title,
      text: `🕌 ${phrase} ${who}: ${refs.join("، ")}`,
      kind,
      today,
    });
  });
  return results.reduce((a, b) => a + b, 0);
}

export async function sendExamRounds(sb, parents, rounds, kuwaitNowDate) {
  let sent = 0;
  for (const round of rounds) {
    const { data: rows } = await sb
      .from("tasks")
      .select("*, children(family_id, name)")
      .eq("type", "اختبار")
      .eq("status", "active")
      .eq("due_date", dateOffset(kuwaitNowDate, round.offset));
    sent += await sendTaskBatch(sb, parents, { rows: rows || [], ...round });
  }
  return sent;
}
