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

// تطابق بسيط بالكلمات المفتاحية بين نص السؤال وأسماء المواد الرسمية،
// عشان نعرف نجيب مواد المادة الصح بدون ما نطلب من ولي الأمر يختارها يدوياً.
export function matchSubjectFromText(text, subjects) {
  if (!text) return null;
  const normalized = text.replace(/[إأآا]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  let best = null;
  for (const s of subjects) {
    const name = s.name.replace(/[إأآا]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    const words = name.split(/\s+/).filter((w) => w.length >= 3);
    if (words.some((w) => normalized.includes(w))) {
      best = s;
      break;
    }
  }
  return best;
}
