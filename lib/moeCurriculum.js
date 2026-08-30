// ربط صف الطالب/ة الرقمي (١-١٢) بمعرّفات مكتبة وزارة التربية الإلكترونية
// (elibrary.moe.edu.kw) — API عام بدون تسجيل دخول.
const MOE_BASE = "https://elibrary.moe.edu.kw";
const EDUCATION_TYPE_GENERAL = 8; // التعليم العام

const GRADE_TO_MOE = {
  1: { stageId: 24, gradeId: 55 },
  2: { stageId: 24, gradeId: 56 },
  3: { stageId: 24, gradeId: 57 },
  4: { stageId: 24, gradeId: 58 },
  5: { stageId: 24, gradeId: 59 },
  6: { stageId: 15, gradeId: 20 },
  7: { stageId: 15, gradeId: 21 },
  8: { stageId: 15, gradeId: 22 },
  9: { stageId: 15, gradeId: 23 },
  10: { stageId: 17, gradeId: 27 },
  11: { stageId: 17, gradeId: 28 },
  12: { stageId: 17, gradeId: 29 },
};

export function moeGradeInfo(grade) {
  return GRADE_TO_MOE[grade] || null;
}

// الفصل الدراسي الحالي بالكويت: أغسطس–يناير = الأول، فبراير–يونيو = الثاني.
// يوليو (إجازة صيفية) يُحسب كالفصل الأول تمهيداً للعام الجديد.
export function kuwaitTerm() {
  const month = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCMonth() + 1; // 1-12
  return month >= 2 && month <= 6 ? 2 : 1;
}

export async function fetchMoeSubjects(gradeId) {
  const res = await fetch(`${MOE_BASE}/api/LibraryLookups/EducationSubjects/${gradeId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map((s) => ({ id: s.value, name: (s.text || "").trim() }));
}

export async function searchMoeLibrary({ stageId, gradeId, subjectId, term }) {
  const res = await fetch(`${MOE_BASE}/api/librarysearch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      BooksFor: 1,
      MoeYear: 2023,
      EducationTypeID: EDUCATION_TYPE_GENERAL,
      EducationStageID: stageId,
      EducationGradeID: gradeId,
      EducationSubjectID: subjectId,
      Term: term,
    }),
  });
  if (!res.ok) return { books: [], videos: [], examFiles: [] };
  return res.json();
}

export function moeBookFileUrl(bookFileID) {
  return `${MOE_BASE}/api/File/preview/book/${bookFileID}`;
}

export function moeExamFileUrl(educationExamFileID) {
  return `${MOE_BASE}/api/File/download/examfile/${educationExamFileID}`;
}

const arNormalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ْـ]/g, ""); // تشكيل وتطويل

const arWords = (s) => arNormalize(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const arStem = (w) => w.replace(/^ال/, "");

// ولي الأمر يكتب بالعامية ("عربي"، "انجليزي") بينما اسم المادة الرسمي
// ("اللغة العربية") فيه أل التعريف وتاء التأنيث — فنطابق على الجذر بالبادئة
// بدل التطابق الحرفي.
function wordsRelated(a, b) {
  const x = arStem(a);
  const y = arStem(b);
  if (x.length < 3 || y.length < 3) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.startsWith(short);
}

// تطابق المادة بين نص السؤال وأسماء المواد الرسمية، عشان نجيب مواد الوزارة
// الصح بدون ما نطلب من ولي الأمر يختار المادة يدوياً.
//
// الكلمة المشتركة بين أكثر من مادة ("اللغة" بالعربية والإنجليزية، "التربية"
// بالإسلامية والفنية والبدنية) ما تميّز مادة عن غيرها، فنستبعدها من الترجيح
// ونعتمد على الكلمات المميِّزة. لو ما فيه كلمة مميِّزة، ما نرجّح مادة إلا لو
// المطابقة العامة تحتمل مادة وحدة فقط — التخمين الغلط أضر من عدم الترجيح،
// لأنه يخلي المعلم الذكي يجاوب بمادة ثانية غير اللي سأل عنها ولي الأمر.
export function matchSubjectFromText(text, subjects) {
  if (!text || !Array.isArray(subjects) || subjects.length === 0) return null;
  const textWords = arWords(text);
  if (textWords.length === 0) return null;

  const sharedCount = new Map();
  const subjectWords = subjects.map((s) => {
    const ws = [...new Set(arWords(s.name).filter((w) => arStem(w).length >= 3))];
    for (const stem of new Set(ws.map(arStem))) {
      sharedCount.set(stem, (sharedCount.get(stem) || 0) + 1);
    }
    return ws;
  });

  let best = null;
  let bestScore = 0;
  const genericMatches = [];

  subjects.forEach((s, i) => {
    let score = 0;
    let matchedGeneric = false;
    for (const w of subjectWords[i]) {
      if (!textWords.some((t) => wordsRelated(t, w))) continue;
      if (sharedCount.get(arStem(w)) > 1) matchedGeneric = true;
      else score += arStem(w).length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
    if (matchedGeneric) genericMatches.push(s);
  });

  if (best) return best;
  return genericMatches.length === 1 ? genericMatches[0] : null;
}
