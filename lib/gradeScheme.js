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
  // المواد العملية (موسيقى · حاسوب · بدنية · فنية · دراسات عملية):
  // ثلاثة بنود بس — ولا اختبار قصير ولا امتحان نهاية فصل ولا تقسيم فترتين.
  middle_practical: {
    key: "middle_practical",
    name: "مواد عملية",
    total: 100,
    items: [
      { key: "tests_projects", label: "اختبارات ومشاريع", max: 60 },
      { key: "conduct_tools", label: "السلوك والتعامل مع الأدوات", max: 20 },
      { key: "participation", label: "المشاركة والتفاعل", max: 20 },
    ],
  },
  // الطريق السريع: رقم واحد. أم عندها ٨ مواد × ١٠ بنود = ٨٠ رقماً بالفصل،
  // وأغلبهن ما تعرف إلا المجموع اللي بالتقرير — فاللي تبي التفصيل تاخذه،
  // واللي تبي الحرف والـGPA بس تكتب رقماً واحداً. وهو كذلك يغطي أي مادة
  // ما عندنا قالبها (ومدرسة تختلف تقسيمتها عن ورقة الوزارة).
  middle_quick: {
    key: "middle_quick",
    name: "مجموع المادة فقط",
    total: 100,
    items: [{ key: "total_100", label: "مجموع المادة", max: 100 }],
  },
};

export const MIDDLE_SCHEME_KEYS = ["middle_academic", "middle_science", "middle_practical", "middle_quick"];

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
  if (PRACTICAL_HINTS.some((h) => s.includes(h))) return "middle_practical";
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
