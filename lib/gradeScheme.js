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
const SUB = (name, hints, periods) => ({ name, hints, periods });

export const DEFAULT_SUBJECTS = {
  متوسط: [
    SUB("اللغة العربية", ["عرب"], 6),
    SUB("اللغة الإنجليزية", ["انجليز", "english"], 6),
    SUB("الرياضيات", ["رياضيات"], 5),
    SUB("العلوم", ["علوم"], 4),
    SUB("التربية الإسلامية", ["اسلام"], 3),
    SUB("الاجتماعيات", ["اجتماع", "وطني"], 2),
    SUB("الحاسوب", ["حاسوب", "حاسب"], 2),
    SUB("التربية البدنية", ["بدني", "رياضه", "رياضيه"], 2),
    SUB("التربية الفنية", ["فني"], 2),
    SUB("الدراسات العملية", ["عمليه", "اقتصاد", "منزل"], 2),
    SUB("التربية الموسيقية", ["موسيق"], 1),
    // ما ظهر إلا بجدولين من ١٥ — تُدرج لأن لها ورقة درجات مستقلة، وبلا
    // وزن مقيس فتاخذ «وزن مقدَّر» إلا لو كانت بجدول الطالب/ة.
    SUB("القرآن الكريم", ["قران", "تلاوه", "تجويد"], 0),
  ],
  ابتدائي: [
    SUB("اللغة العربية", ["عرب"], 7),
    SUB("الرياضيات", ["رياضيات"], 5),
    SUB("اللغة الإنجليزية", ["انجليز", "english"], 5),
    SUB("التربية الإسلامية", ["اسلام"], 4),
    SUB("التربية البدنية", ["بدني", "رياضه", "رياضيه"], 3),
    SUB("الاجتماعيات", ["اجتماع", "وطني"], 2),
    SUB("العلوم", ["علوم"], 2),
    SUB("التربية الفنية", ["فني"], 2),
    SUB("التربية الموسيقية", ["موسيق"], 2),
    SUB("الحاسوب", ["حاسوب", "حاسب"], 1),
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
export function subjectCatalog(stage, schedulePeriods = {}, extraNames = []) {
  const defaults = DEFAULT_SUBJECTS[stage] || [];
  const inSchedule = Object.keys(schedulePeriods).filter(Boolean);
  const used = new Set();
  const out = [];

  for (const d of defaults) {
    const match = inSchedule.find((s) => {
      if (used.has(s)) return false;
      const n = normalizeAr(s);
      return d.hints.some((h) => n.includes(h));
    });
    if (match) {
      used.add(match);
      out.push({ name: match, weight: schedulePeriods[match], weightSource: "schedule" });
    } else {
      out.push({
        name: d.name,
        weight: d.periods || 1,
        weightSource: d.periods ? "typical" : "none",
      });
    }
  }

  // مواد بجدولها ما طابقت قائمتنا (مدرسة تختلف، أو ثانوي) — تنضاف كما هي
  for (const s of inSchedule) {
    if (used.has(s)) continue;
    out.push({ name: s, weight: schedulePeriods[s], weightSource: "schedule" });
  }
  // ومواد كتبتها الأم بنفسها أو لها درجة محفوظة
  for (const s of extraNames) {
    if (!s || out.some((x) => x.name === s)) continue;
    out.push({ name: s, weight: schedulePeriods[s] || 1, weightSource: schedulePeriods[s] ? "schedule" : "none" });
  }
  return out;
}
