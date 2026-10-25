// توزيع الدرجات ونظام GPA — المرحلة المتوسطة (الصفوف ٦–٩).
//
// الأرقام كلها منقولة حرفياً من أوراق وزارة التربية اللي أرسلتها صاحبة
// التطبيق (٢٥ أكتوبر ٢٠٢٦). **ما فيه رقم مشتق ولا مفترض**: لو بند ما كان
// مكتوباً بالورقة ما يدخل هنا، واللي مكتوب يدخل كما هو حتى لو بدا غريباً
// (مثل انقسام غير متساوٍ ٣ + ٢).
//
// الابتدائي (١–٥) له أوراقه المستقلة وكل مادة فيه ببنودها الخاصة — يُضاف
// بدفعة لاحقة، وقرار صاحبة التطبيق كان: «ابدأ بالمتوسط وانشر أجربه، وبعدها
// نعدّل الابتدائي وننشر».

// ———————————————————————————————————————————————
// جدول GPA — المتوسط
// ———————————————————————————————————————————————
// عشرة تصنيفات بلا علامات ناقص. (وصل جدولان بنفس اليوم أحدهما بـ١٤ تصنيفاً
// مع A−/B−/C−/D−؛ أكدت صاحبة التطبيق إن المعتمد للمتوسط هو هذا.)
//
// **بلا تدوير** (قرارها ٢٥ أكتوبر: «مافي تدوير، الأرقام ثابتة»): الدرجة
// تنزل بالتصنيف اللي وصلته فعلاً، فـ٨٩٫٥ تبقى B+ لأنها ما بلغت ٩٠. التدوير
// معناه البرنامج يعطي الطالب/ة حرفاً ما أعطته إياه المدرسة.
export const GPA_MIDDLE = [
  { min: 95, letter: "A+", label: "ممتاز مرتفع", points: 4.0 },
  { min: 90, letter: "A", label: "ممتاز", points: 3.7 },
  { min: 85, letter: "B+", label: "جيد جدا مرتفع", points: 3.45 },
  { min: 80, letter: "B", label: "جيد جدا", points: 3.2 },
  { min: 75, letter: "C+", label: "جيد مرتفع", points: 2.95 },
  { min: 70, letter: "C", label: "جيد", points: 2.7 },
  { min: 65, letter: "D+", label: "مقبول مرتفع", points: 2.45 },
  { min: 60, letter: "D", label: "مقبول", points: 2.2 },
  { min: 50, letter: "E", label: "مجتاز", points: 1.95 },
  { min: 0, letter: "F", label: "راسب", points: 0.0 },
];

// النجاح من ٥٠ («النهاية الصغرى ٥٠ لجميع المجالات الدراسية») — ومطابق
// لحد E/F بالجدول، فما نحتاج ثابتاً ثانياً يفترق عنه بصمت.
export function gpaFor(percent, scale = GPA_MIDDLE) {
  if (percent == null || !Number.isFinite(percent)) return null;
  return scale.find((b) => percent >= b.min) || scale[scale.length - 1];
}

export const SEMESTERS = ["الفصل الأول", "الفصل الثاني"];
export const PART_1 = "الفترة الأولى";
export const PART_2 = "الفترة الثانية";

// ———————————————————————————————————————————————
// قوالب المتوسط
// ———————————————————————————————————————————————
// `key` ثابت للأبد — هو اللي ينحفظ بعمود exam_grades.item، فتغييره يعني
// درجات محفوظة ما تلقى بندها. التسمية المعروضة تتغير بحرية، المفتاح لا.
const WORK_ITEMS = [
  { key: "participation_1", group: "الأعمال", label: "المشاركة", part: PART_1, max: 4 },
  { key: "participation_2", group: "الأعمال", label: "المشاركة", part: PART_2, max: 4 },
  { key: "homework_1", group: "الأعمال", label: "الواجبات", part: PART_1, max: 4 },
  { key: "homework_2", group: "الأعمال", label: "الواجبات", part: PART_2, max: 4 },
  { key: "conduct_1", group: "الأعمال", label: "السلوك", part: PART_1, max: 3 },
  { key: "conduct_2", group: "الأعمال", label: "السلوك", part: PART_2, max: 3 },
  { key: "project_1", group: "الأعمال", label: "المشروع", part: PART_1, max: 4 },
  { key: "project_2", group: "الأعمال", label: "المشروع", part: PART_2, max: 4 },
];

const QUIZ = { key: "quiz", label: "الاختبار القصير", max: 20, note: "الأسبوع السادس" };

export const SCHEMES = {
  // كل المواد النظرية: أعمال ٣٠ + قصير ٢٠ + نهاية الفصل ٥٠
  middle_academic: {
    key: "middle_academic",
    name: "مواد أكاديمية",
    total: 100,
    items: [...WORK_ITEMS, QUIZ, { key: "final", label: "امتحان نهاية الفصل", max: 50 }],
  },
  // العلوم: نفس الأعمال والقصير، بس الـ٥٠ تنقسم نظري ٤٠ + عملي ١٠
  middle_science: {
    key: "middle_science",
    name: "العلوم",
    total: 100,
    items: [
      ...WORK_ITEMS,
      QUIZ,
      { key: "final_theory", label: "الامتحان النظري", max: 40 },
      { key: "final_practical", label: "الامتحان العملي", max: 10 },
    ],
  },
  // خانة واحدة من ١٠٠ تكتب فيها الأم الدرجة النهائية.
  //
  // **وهذا قالب المواد العملية** (موسيقى · حاسوب · بدنية · فنية · دراسات
  // عملية) بقرارها ٢٥ أكتوبر: «المواد العملية حط فقط ١٠٠ والأم تحط الدرجة
  // النهائية» — وصلت ورقتها بتفصيل ٦٠/٢٠/٢٠ لكنها اختارت الخانة الواحدة.
  //
  // ويغطي كذلك أي مادة ما عندنا قالبها، وأي مدرسة تختلف تقسيمتها عن ورقة
  // الوزارة، والمراحل اللي بنودها ما وصلت بعد.
  middle_quick: {
    key: "middle_quick",
    name: "الدرجة النهائية من ١٠٠",
    total: 100,
    items: [{ key: "total_100", label: "الدرجة النهائية", max: 100 }],
  },
};

export const MIDDLE_SCHEME_KEYS = ["middle_academic", "middle_science", "middle_quick"];

function normalizeAr(s) {
  return (s || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}

// تخمين القالب من اسم المادة — **تخمين معلَن لا صامت**: الواجهة تعرض اسم
// القالب المختار مع زر تبديل، لأن أسماء المواد تجي من جدول حصص المدرسة
// نفسها (مستخرجة من صورة) فما نقدر نحصرها بقائمة مغلقة.
//
// «رياضه» (الرياضة) و«رياضيه» (التربية الرياضية) ما تتطابقان مع «رياضيات»
// بعد التطبيع — فُحصت الثلاثة، ما فيه تداخل.
const PRACTICAL_HINTS = ["موسيق", "حاسوب", "حاسب", "بدني", "فني", "عمليه", "رياضه", "رياضيه"];

export function guessScheme(subject) {
  const s = normalizeAr(subject);
  if (!s) return "middle_academic";
  if (s.includes("علوم")) return "middle_science";
  // المواد العملية: خانة واحدة من ١٠٠ (قرارها ٢٥ أكتوبر)
  if (PRACTICAL_HINTS.some((h) => s.includes(h))) return "middle_quick";
  return "middle_academic";
}

export function schemeFor(key) {
  return SCHEMES[key] || SCHEMES.middle_academic;
}

export function itemIn(schemeKey, itemKey) {
  return schemeFor(schemeKey).items.find((i) => i.key === itemKey) || null;
}

// ———————————————————————————————————————————————
// الحساب
// ———————————————————————————————————————————————
// **الخانة الفاضية ≠ صفر.** لو حسبناها صفراً شافت الأم بالأسبوع السادس
// «٢٦٪» وانصدمت، وبنتها ما ناقصها شي — باقي ٧٠ درجة ما رصدتها المعلمة
// أصلاً. فنرجّع `entered` (المدخَل) و`enteredMax` (من كم) منفصلين عن
// `total`، والواجهة تقول المتبقي صراحةً.
export function summarize(schemeKey, scores) {
  const scheme = schemeFor(schemeKey);
  let entered = 0;
  let enteredMax = 0;
  let count = 0;
  for (const item of scheme.items) {
    const v = scores?.[item.key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    entered += n;
    enteredMax += item.max;
    count += 1;
  }
  const complete = count === scheme.items.length;
  // النسبة من ١٠٠ ما تُحسب إلا لما تكتمل المادة — وإلا صارت نسبة كاذبة
  // تُبنى عليها علامة GPA غلط.
  const percent = complete ? (entered / scheme.total) * 100 : null;
  return {
    entered,
    enteredMax,
    remaining: scheme.total - enteredMax,
    complete,
    percent,
    gpa: complete ? gpaFor(percent) : null,
  };
}

// نتيجة السنة = (معدل الفصل الأول + معدل الفصل الثاني) ÷ ٢ — كما هي مكتوبة
// بورقة الوزارة. ما تُحسب إلا لو الفصلان مكتملان.
export function yearResult(firstPercent, secondPercent) {
  if (firstPercent == null || secondPercent == null) return null;
  const percent = (firstPercent + secondPercent) / 2;
  return { percent, gpa: gpaFor(percent) };
}

// ———————————————————————————————————————————————
// الدرجة النهائية لكل المواد + المعدل الموزون (طلبها ٢٥ أكتوبر)
// ———————————————————————————————————————————————
// **المعدل موزون بعدد الحصص الأسبوعية لا متوسط حسابي عادي** — صحّحته
// صاحبة التطبيق: المدرسة تحسب (درجة المادة × عدد حصصها) ÷ مجموع الحصص،
// فمادة بخمس حصص تثقل أكثر من مادة بحصتين. مثالها: رياضيات ٩٠ بخمس حصص
// وبدنية ١٠٠ بحصتين = (٤٥٠ + ٢٠٠) ÷ ٧ = ٩٢٫٨٥٪ — والمتوسط العادي كان
// يعطي ٩٥٪، وهذا بالضبط سبب اختلاف رقمنا عن الشهادة.
//
// **والوزن يُقرأ من جدول حصص الطالب/ة نفسه** (`class_schedule`) لا يُسأل
// عنه ولا يُفترض — عدد مرات المادة بالأسبوع هو وزنها.
//
// **المواد الناقصة ما تدخل الحساب ولا تُحسب صفراً** (ولا حصصها تدخل
// المقام): مادة ما رصدت المعلمة نهائيها بعد تنزّل المعدل بالغلط وتخوّف
// الأم بلا سبب.
export function overall(list) {
  const done = (list || []).filter((x) => x && x.percent != null && x.gpa);
  if (!done.length) return null;
  // مادة مكتوبة بإيد الأم وما هي بجدول الحصص: وزنها ١ بدل ما تطيح من
  // الحساب — والواجهة تعلّمها عشان تعرف الأم إن وزنها مقدَّر.
  const w = (x) => (Number(x.weight) > 0 ? Number(x.weight) : 1);
  const totalWeight = done.reduce((a, b) => a + w(b), 0);
  const weighted = done.reduce((a, b) => a + b.percent * w(b), 0) / totalWeight;
  return {
    count: done.length,
    total: (list || []).length,
    totalWeight,
    percent: weighted,
    band: gpaFor(weighted),
    // هل عندنا حصص حقيقية لكل المواد المحسوبة؟ لو لا، الرقم تقديري
    allWeighted: done.every((x) => Number(x.weight) > 0),
  };
}

// ———————————————————————————————————————————————
// قائمة المواد: كل المواد تُدرج لا اللي بجدول الحصص وحدها
// ———————————————————————————————————————————————
// طلبها ٢٥ أكتوبر: «وين باقي المواد الأساسية… ادرج جميع المواد بالقائمة
// والأم تدخل الدرجة». القائمة كانت تجي من `class_schedule` وحده، فأم ما
// رفعت جدولاً — أو جدولها ناقص مادة — ما تشوف المادة أصلاً.
//
// **الأسماء والأوزان مقيسة من جداول الحصص الحقيقية بقاعدتنا** (٣٦ جدول
// ابتدائي + ١٥ متوسط، ٢٥ أكتوبر ٢٠٢٦) لا مكتوبة من الذاكرة: الوزن هو
// العدد الأكثر تكراراً لحصص المادة بالأسبوع.
const SUB = (key, name, hints, periods) => ({ key, name, hints, periods });

export const DEFAULT_SUBJECTS = {
  متوسط: [
    SUB("arabic", "اللغة العربية", ["عرب"], 6),
    SUB("english", "اللغة الإنجليزية", ["انجليز", "english"], 6),
    SUB("math", "الرياضيات", ["رياضيات"], 5),
    SUB("science", "العلوم", ["علوم"], 4),
    SUB("islamic", "التربية الإسلامية", ["اسلام"], 3),
    SUB("social", "الاجتماعيات", ["اجتماع", "وطني"], 2),
    SUB("computer", "الحاسوب", ["حاسوب", "حاسب"], 2),
    SUB("pe", "التربية البدنية", ["بدني", "رياضه", "رياضيه"], 2),
    SUB("art", "التربية الفنية", ["فني"], 2),
    SUB("practical", "الدراسات العملية", ["عمليه", "اقتصاد", "منزل"], 2),
    SUB("music", "التربية الموسيقية", ["موسيق"], 1),
    // ما ظهر إلا بجدولين من ١٥ — تُدرج لأن لها ورقة درجات مستقلة، وبلا
    // وزن مقيس فتاخذ «وزن مقدَّر» إلا لو كانت بجدول الطالب/ة.
    SUB("quran", "القرآن الكريم", ["قران", "تلاوه", "تجويد"], 0),
  ],
  ابتدائي: [
    SUB("arabic", "اللغة العربية", ["عرب"], 7),
    SUB("math", "الرياضيات", ["رياضيات"], 5),
    SUB("english", "اللغة الإنجليزية", ["انجليز", "english"], 5),
    SUB("islamic", "التربية الإسلامية", ["اسلام"], 4),
    SUB("pe", "التربية البدنية", ["بدني", "رياضه", "رياضيه"], 3),
    SUB("social", "الاجتماعيات", ["اجتماع", "وطني"], 2),
    SUB("science", "العلوم", ["علوم"], 2),
    SUB("art", "التربية الفنية", ["فني"], 2),
    SUB("music", "التربية الموسيقية", ["موسيق"], 2),
    SUB("computer", "الحاسوب", ["حاسوب", "حاسب"], 1),
  ],
  // الثانوي مواده تختلف (فيزياء، كيمياء، أحياء…) وما عندنا إلا ثلاثة
  // جداول — فما نفرض عليه قائمة، يبقى على جدوله وإضافته اليدوية.
  ثانوي: [],
};

// **«وطني» و«الاجتماعيات» مادة وحدة باسمين**: ولا طالب/ة بالقاعدة عنده
// الاثنان معاً (فُحص) — فدمجهما ما يخسّر مادة.
//
// ترجّع قائمة موحّدة: اسم الأم من جدولها يتقدّم على اسمنا، ووزنها الفعلي
// يتقدّم على الوزن المقيس. ما فيه تكرار — مادة بجدولها باسم «عربي» ما
// تطلع مرتين مع «اللغة العربية».
// القالب الرسمي لكل (مجموعة صفوف + مادة). المادة اللي ما لها قالب —
// العملية والقرآن وأي مادة خارج القائمة — تاخذ الخانة الوحدة من ١٠٠.
//
// **العلوم بالابتدائي لسه بالخانة الوحدة**: أرقام كشفها واضحة (٦٠ و٨٠)
// لكن أسماء أعمدته مكتوبة عمودياً بالصورة وما انقرأت بثقة، وتخمين اسم
// بند جنب درجته يخلي الأم تكتب رقماً بالخانة الغلط.
const SCHEME_BY_GROUP = {
  p13: { arabic: "p13_arabic", english: "p13_english", math: "p13_math", islamic: "p13_islamic", social: "p13_social" },
  p45: { arabic: "p45_arabic", english: "p45_english", math: "p45_math", islamic: "p45_islamic", social: "p45_social" },
  middle: { science: "middle_science", arabic: "middle_academic", english: "middle_academic",
            math: "middle_academic", islamic: "middle_academic", social: "middle_academic", quran: "middle_academic" },
};

export function gradeGroup(grade) {
  const g = Number(grade);
  if (g >= 1 && g <= 3) return "p13";
  if (g >= 4 && g <= 5) return "p45";
  if (g >= 6 && g <= 9) return "middle";
  return null;
}

export function schemeKeyFor(grade, subjectKey, subjectName) {
  const group = gradeGroup(grade);
  const byKey = group && subjectKey ? SCHEME_BY_GROUP[group]?.[subjectKey] : null;
  if (byKey) return byKey;
  // مادة ما هي بالقائمة: نخمّن من اسمها للمتوسط وحده (قوالبه بالاسم)،
  // وغيره ياخذ الخانة الوحدة بدل قالب مرحلة ثانية.
  if (group === "middle" && subjectName) return guessScheme(subjectName);
  return "middle_quick";
}

export function subjectCatalog(stage, schedulePeriods = {}, extraNames = [], grade = null) {
  const defaults = DEFAULT_SUBJECTS[stage] || [];
  const inSchedule = Object.keys(schedulePeriods).filter(Boolean);
  const used = new Set();
  const out = [];
  const add = (name, weight, weightSource, key) =>
    out.push({ name, weight, weightSource, key: key || null, scheme: schemeKeyFor(grade, key, name) });

  for (const d of defaults) {
    const match = inSchedule.find((s) => {
      if (used.has(s)) return false;
      const n = normalizeAr(s);
      return d.hints.some((h) => n.includes(h));
    });
    if (match) {
      used.add(match);
      add(match, schedulePeriods[match], "schedule", d.key);
    } else {
      add(d.name, d.periods || 1, d.periods ? "typical" : "none", d.key);
    }
  }

  // مواد بجدولها ما طابقت قائمتنا (مدرسة تختلف، أو ثانوي) — تنضاف كما هي
  for (const s of inSchedule) {
    if (used.has(s)) continue;
    add(s, schedulePeriods[s], "schedule", null);
  }
  // ومواد كتبتها الأم بنفسها أو لها درجة محفوظة
  for (const s of extraNames) {
    if (!s || out.some((x) => x.name === s)) continue;
    add(s, schedulePeriods[s] || 1, schedulePeriods[s] ? "schedule" : "none", null);
  }
  return out;
}

// ———————————————————————————————————————————————
// قوالب المرحلة الابتدائية (أوراقها وصلت ٢٥ أكتوبر)
// ———————————————————————————————————————————————
// مجموعتا صفوف بقرارها: **١–٣ نفس الحسبة، و٤–٥ حسبة ثانية**.
//
// | | ١–٣ | ٤–٥ |
// |---|---|---|
// | التقييم البنائي | ٨٠ | ٦٠ |
// | الاختبارات | اختباران × ١٠ | تقييم نهائي ٤٠ |
//
// و**كل مادة ببنودها الخاصة** — عكس المتوسط اللي قالب واحد لكل المواد.
//
// `name` هنا للتوثيق والاختبارات فقط. **الواجهة تعرض صف الطالب/ة نفسه**
// («توزيع درجات الصف ٥») لا مجموعة الصفوف — عنوان عام يخلي الأم تتأكد
// إن هذا توزيع بنتها ولا توزيع صف ثاني (طلبها ٢٥ أكتوبر).
// الأرقام منقولة حرفياً من كشوف الوزارة، والبنود بمستوى الكشف نفسه (لا
// بتفصيل البنود الفرعية: الأم تاخذ من المعلمة مجموع البند لا أجزاءه).
const P = (key, label, max) => ({ key, label, max });

const PRIMARY = {
  // —— الصفوف ٤–٥: بنائي ٦٠ + نهائي ٤٠ ——
  p45_arabic: {
    name: "اللغة العربية · الصفان ٤ و٥",
    items: [
      P("participation", "المشاركة والتفاعل", 10),
      P("eapps", "التطبيقات الإلكترونية والممارسات", 10),
      P("project", "المشروع", 10),
      P("homework", "الواجبات والأنشطة", 10),
      P("conduct", "السلوك والأدوات", 5),
      // كشف العربي ياخذ **معدل** الإملاءين (كل واحد من ٥) لا مجموعهما
      P("worksheets", "أوراق العمل التقييمية (معدل الإملاءين)", 5),
      P("quiz", "اختبار قصير (مجموع الاختبارين)", 10),
      P("final_1", "التقييم النهائي · الورقة الأولى", 10),
      P("final_2", "التقييم النهائي · الورقة الثانية", 30),
    ],
  },
  p45_english: {
    name: "اللغة الإنجليزية · الصفان ٤ و٥",
    items: [
      P("participation", "المشاركة والتفاعل", 10),
      P("homework", "الواجبات والأنشطة", 10),
      P("worksheets", "أوراق العمل التقييمية", 10),
      P("projects", "المشاريع والمهارات", 10),
      P("quiz", "الاختبارات القصيرة", 10),
      P("conduct", "السلوك والأدوات", 5),
      P("eapps", "التطبيقات الإلكترونية", 5),
      P("final", "التقييم النهائي", 40),
    ],
  },
  p45_math: {
    name: "الرياضيات · الصفان ٤ و٥",
    items: [
      P("participation", "المشاركة والتفاعل (الفترتان)", 10),
      P("homework", "الواجبات (الفترتان)", 5),
      P("eapps", "التطبيقات الإلكترونية (الفترتان)", 4),
      P("classwork", "التطبيقات والممارسات داخل الفصل (الفترتان)", 6),
      P("worksheets", "ورقة تقويمية (الفترتان)", 10),
      P("quiz", "اختبار قصير", 10),
      P("conduct", "الأدوات والسلوك", 5),
      P("projects", "المشاريع (٤ مشاريع × ٢٫٥)", 10),
      P("final", "التقييم النهائي", 40),
    ],
  },
  p45_islamic: {
    name: "التربية الإسلامية · الصفان ٤ و٥",
    items: [
      P("participation", "المشاركة والتفاعل", 10),
      P("worksheets", "ورقة عمل", 10),
      P("quiz", "اختبار قصير", 10),
      P("projects", "مشاريع", 10),
      P("conduct", "السلوك والأدوات", 5),
      P("homework", "الواجبات والأنشطة", 5),
      P("hadith", "حفظ الحديث الشريف", 5),
      P("eapps", "التطبيقات الإلكترونية", 5),
      P("final", "التقييم النهائي (اختبار شفوي)", 40),
    ],
  },
  p45_social: {
    name: "الاجتماعيات (وطني) · الصفان ٤ و٥",
    items: [
      P("participation", "المشاركة والتفاعل", 10),
      P("skills", "تطبيقات ومهارات", 10),
      P("homework", "الواجبات المنزلية", 10),
      P("quiz", "اختبار قصير", 10),
      P("project", "المشروع", 10),
      P("worksheets", "ورقة عمل", 5),
      P("conduct", "السلوك والأدوات", 5),
      P("final", "التقييم النهائي", 40),
    ],
  },

  // —— الصفوف ١–٣: بنائي ٨٠ + اختباران ١٠+١٠ ——
  p13_arabic: {
    name: "اللغة العربية · الصفوف ١–٣",
    items: [
      P("participation", "المشاركة والتفاعل", 10),
      P("homework", "الواجبات والأنشطة", 10),
      P("conduct", "السلوك والأدوات", 10),
      P("worksheets", "أوراق العمل التقييمية (إملاءان × ٥)", 10),
      P("quiz", "اختبار قصير (اختباران × ٥)", 10),
      P("projects", "المشاريع والمهارات", 20),
      P("eapps", "التطبيقات الإلكترونية", 5),
      P("oral", "الاختبار الشفوي", 5),
      P("exam_1", "الاختبار الأول", 10),
      P("exam_2", "الاختبار الثاني", 10),
    ],
  },
  p13_english: {
    name: "اللغة الإنجليزية · الصفوف ١–٣",
    items: [
      P("participation", "المشاركة والتفاعل", 10),
      P("homework", "الواجبات والأنشطة", 10),
      P("conduct", "السلوك والأدوات", 10),
      P("worksheets", "أوراق العمل التقييمية", 10),
      P("quiz", "الاختبارات القصيرة", 10),
      P("projects", "المشاريع والمهارات", 20),
      P("eapps", "التطبيقات الإلكترونية", 5),
      P("oral", "الاختبار الشفوي", 5),
      P("exam_1", "الاختبار الأول", 10),
      P("exam_2", "الاختبار الثاني", 10),
    ],
  },
  p13_math: {
    name: "الرياضيات · الصفوف ١–٣",
    items: [
      P("followup", "متابعة وتقييم مستمر (الفترتان)", 40),
      P("projects", "مشاريع (الفترتان)", 20),
      P("quiz", "اختبار قصير (الفترتان)", 10),
      P("worksheets", "ورقة تقويمية (الفترتان)", 10),
      P("exam_1", "الاختبار الأول", 10),
      P("exam_2", "الاختبار الثاني", 10),
    ],
  },
  p13_islamic: {
    name: "التربية الإسلامية · الصفوف ١–٣",
    items: [
      P("conduct", "السلوك والآداب", 10),
      P("participation", "المشاركة والتفاعل", 10),
      P("homework", "الواجبات والأنشطة", 10),
      P("hadith", "حفظ الحديث الشريف", 10),
      P("worksheets", "ورقة عمل (١–٢)", 10),
      P("quiz", "اختبار قصير (١–٢)", 10),
      P("projects", "مشاريع ومهارات", 10),
      P("eapps", "التطبيقات الإلكترونية", 5),
      P("oral", "اختبار شفوي", 5),
      P("exam_1", "الاختبار الأول", 10),
      P("exam_2", "الاختبار الثاني", 10),
    ],
  },
  p13_social: {
    name: "الاجتماعيات (وطني) · الصفوف ١–٣",
    items: [
      P("participation", "المشاركة والتفاعل", 10),
      P("conduct", "السلوك والأدوات", 10),
      P("homework", "الواجبات والأنشطة", 10),
      P("worksheets", "ورقة عمل تقييمية", 10),
      P("quiz", "اختبار قصير", 10),
      P("projects", "مشاريع ومهارات", 20),
      P("eapps", "التطبيقات الإلكترونية", 5),
      P("oral", "اختبار شفوي", 5),
      P("exam_1", "الاختبار الأول", 10),
      P("exam_2", "الاختبار الثاني", 10),
    ],
  },
};

for (const [key, def] of Object.entries(PRIMARY)) {
  SCHEMES[key] = { key, name: def.name, total: 100, items: def.items };
}
