// تحويل الدرجات القديمة الحرة إلى بنودها (طلبها ٢٥ أكتوبر):
// «الي سجلوا درجات امتحان حالية لا تمسحها، بس حوّلها للبند المناسب…
//  وإذا ماله اسم واضح خله مثل ما هو بدون لمس».
//
// **التحويل محافظ بالقصد** — ثلاثة شروط كلها لازمة:
//   ١) اسم الاختبار يطابق اسم بند بقالب صف الطالب/ة (مطابقة تامة أو بداية).
//   ٢) `max_score` يساوي درجة البند بالضبط — وإلا صار ٨ من ١٠ يُعرض ٨ من ٢٠.
//   ٣) لو البند بفترتين (مشروع ١/٢) تحسمها `period`؛ وإلا يبقى الصف كما هو.
// والفصل «الأول» يقين لا تخمين: كل الصفوف بالقاعدة من ١٤ أغسطس إلى ٢٥
// أكتوبر ٢٠٢٦ — أي داخل الفصل الدراسي الأول.
import { SCHEMES, schemeKeyFor, DEFAULT_SUBJECTS } from "/home/user/Daftary/lib/gradeScheme.js";

const rows = JSON.parse(process.argv[2]);
const norm = (s) => (s || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

function subjectKey(stageList, name) {
  const n = norm(name);
  for (const d of stageList) if (d.hints.some((h) => n.includes(h))) return d.key;
  return null;
}

const plan = [];
const skipped = [];
for (const r of rows) {
  const stage = r.grade <= 5 ? "ابتدائي" : r.grade <= 9 ? "متوسط" : "ثانوي";
  const key = subjectKey(DEFAULT_SUBJECTS[stage] || [], r.subject);
  const schemeKey = schemeKeyFor(r.grade, key, r.subject);
  const scheme = SCHEMES[schemeKey];
  const name = norm(r.exam_name);
  if (!name) { skipped.push([r.id, r.subject, r.exam_name, "بلا اسم"]); continue; }

  let cands = scheme.items.filter((i) => {
    const l = norm(i.label);
    return (l === name || l.startsWith(name + " ") || l.startsWith(name + "(")) && Number(i.max) === Number(r.max_score);
  });
  if (cands.length > 1 && r.period) {
    const want = r.period.includes("الأولى") ? "_1" : r.period.includes("الثانية") ? "_2" : null;
    if (want) cands = cands.filter((i) => i.key.endsWith(want));
  }
  if (cands.length !== 1) {
    skipped.push([r.id, r.subject, r.exam_name, cands.length ? `${cands.length} احتمالات` : `ما طابق قالب ${schemeKey}`]);
    continue;
  }
  plan.push({ id: r.id, subject: r.subject, name: r.exam_name, score: `${r.score}/${r.max_score}`,
              scheme: schemeKey, item: cands[0].key, label: cands[0].label });
}

console.log("=== يتحوّل ===");
for (const p of plan) console.log(` ${p.subject} · «${p.name}» ${p.score} → ${p.label} [${p.scheme}.${p.item}]`);
console.log(`\n=== يبقى كما هو (${skipped.length}) ===`);
for (const s of skipped) console.log(` ${s[1]} · ${s[2] === null ? "(بلا اسم)" : "«" + s[2] + "»"} — ${s[3]}`);

console.log("\n=== SQL ===");
for (const p of plan) {
  console.log(`update exam_grades set item='${p.item}', scheme='${p.scheme}', semester='الفصل الأول' where id='${p.id}' and item is null;`);
}
