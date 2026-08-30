#!/usr/bin/env node
// يبني فهرس دروس المنهج (عناوين الوحدات والدروس) ويخزّنه بجدول curriculum_index.
//
// ليش سكربت محلي مو مسار API؟ كتب الوزارة أحجامها كبيرة (بعضها ٩٠+ ميجا)،
// وتنزيلها ومعالجتها يتجاوز حدود وقت وذاكرة الدوال بـVercel. وكمان مكتبة
// الوزارة ما تنفتح إلا من شبكة تسمح بها.
//
// نرسل صفحات الفهرس فقط (أول وآخر صفحات الكتاب) للذكاء الاصطناعي — مو الكتاب
// كامل — عشان التكلفة تبقى بسيطة. ما نخزّن أي ملف كتاب، فقط عناوين الدروس.
//
// التشغيل:
//   export SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  ANTHROPIC_API_KEY=...
//   node scripts/build-curriculum-index.mjs --grade 3            # صف واحد (للتجربة)
//   node scripts/build-curriculum-index.mjs                      # كل الصفوف
//   node scripts/build-curriculum-index.mjs --grade 3 --dry-run  # بدون كتابة بقاعدة البيانات

import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const MOE_BASE = "https://elibrary.moe.edu.kw";
const EDUCATION_TYPE_GENERAL = 8;
const MOE_YEAR = 2023;

const GRADE_TO_MOE = {
  1: { stageId: 24, gradeId: 55 }, 2: { stageId: 24, gradeId: 56 },
  3: { stageId: 24, gradeId: 57 }, 4: { stageId: 24, gradeId: 58 },
  5: { stageId: 24, gradeId: 59 }, 6: { stageId: 15, gradeId: 20 },
  7: { stageId: 15, gradeId: 21 }, 8: { stageId: 15, gradeId: 22 },
  9: { stageId: 15, gradeId: 23 }, 10: { stageId: 17, gradeId: 27 },
  11: { stageId: 17, gradeId: 28 }, 12: { stageId: 17, gradeId: 29 },
};

// الفهرس عادةً بأول الكتاب، وبعض الكتب تحطه بالآخر — فنرسل الطرفين.
const HEAD_PAGES = 12;
const TAIL_PAGES = 6;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // هامش تحت حد ٣٢ ميجا للطلب

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};
const onlyGrade = argValue("--grade") ? Number(argValue("--grade")) : null;
const dryRun = args.includes("--dry-run");

for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]) {
  if (!process.env[key]) {
    console.error(`✗ متغير البيئة ${key} غير معرّف`);
    process.exit(1);
  }
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function moeJson(path, body) {
  const res = await fetch(`${MOE_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

// نقتطع صفحات الفهرس من الكتاب بدل ما نرسله كامل — الكتاب الكامل يتجاوز حد
// حجم الطلب، وتكلفة قراءته بالكامل عالية بلا داعي.
async function extractIndexPages(pdfBytes) {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const wanted = new Set();
  for (let i = 0; i < Math.min(HEAD_PAGES, total); i++) wanted.add(i);
  for (let i = Math.max(0, total - TAIL_PAGES); i < total; i++) wanted.add(i);

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, [...wanted].sort((a, b) => a - b));
  pages.forEach((p) => out.addPage(p));
  return { bytes: Buffer.from(await out.save()), totalPages: total };
}

async function askClaudeForLessons(pdfBuffer, { grade, subjectName, term, bookTitle }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBuffer.toString("base64") },
            title: bookTitle,
          },
          {
            type: "text",
            text: `هذي صفحات من كتاب "${bookTitle}" — مادة ${subjectName}، الصف ${grade}، الفصل الدراسي ${term} (منهج الكويت).

استخرجي فهرس الوحدات والدروس كما هو مكتوب بالكتاب حرفياً — بدون تغيير الصياغة ولا إضافة دروس من عندك.

أرجعي JSON فقط بهذا الشكل، بدون أي نص قبله أو بعده:
{"lessons":[{"unit":"اسم الوحدة أو الفصل","title":"عنوان الدرس"}]}

- لو الدرس ما ينتمي لوحدة، خلي unit فاضية "".
- لو ما لقيتِ فهرساً واضحاً بهذي الصفحات، أرجعي {"lessons":[]}.`,
          },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content || []).find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  return Array.isArray(parsed.lessons) ? parsed.lessons : [];
}

async function processBook({ grade, gradeInfo, subject, term, book }) {
  const label = `صف ${grade} | ${subject.name} | ف${term} | ${book.fileDescription}`;
  const pdfRes = await fetch(`${MOE_BASE}/api/File/preview/book/${book.bookFileID}`);
  if (!pdfRes.ok) throw new Error(`تحميل الكتاب فشل: HTTP ${pdfRes.status}`);
  const full = Buffer.from(await pdfRes.arrayBuffer());

  const { bytes, totalPages } = await extractIndexPages(full);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`صفحات الفهرس كبيرة (${(bytes.byteLength / 1048576).toFixed(1)}MB)`);
  }
  console.log(`   الكتاب ${(full.byteLength / 1048576).toFixed(1)}MB / ${totalPages} صفحة → أرسلنا ${(bytes.byteLength / 1048576).toFixed(1)}MB`);

  const lessons = await askClaudeForLessons(bytes, {
    grade, subjectName: subject.name, term, bookTitle: book.fileDescription,
  });
  if (!lessons.length) {
    console.log(`   ⚠️  ما انستخرج فهرس — ${label}`);
    return 0;
  }

  if (!dryRun) {
    const { error } = await sb.from("curriculum_index").upsert({
      grade,
      subject_id: subject.id,
      subject_name: subject.name,
      term,
      book_title: book.fileDescription,
      book_file_id: book.bookFileID,
      lessons,
      updated_at: new Date().toISOString(),
    }, { onConflict: "grade,subject_id,term" });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
  console.log(`   ✅ ${lessons.length} درس — ${label}`);
  return lessons.length;
}

async function main() {
  const grades = onlyGrade ? [onlyGrade] : Object.keys(GRADE_TO_MOE).map(Number);
  let totalLessons = 0;
  const failures = [];

  for (const grade of grades) {
    const gradeInfo = GRADE_TO_MOE[grade];
    if (!gradeInfo) { console.error(`✗ صف غير معروف: ${grade}`); continue; }

    const subjectsRes = await moeJson(`/api/LibraryLookups/EducationSubjects/${gradeInfo.gradeId}`);
    const subjects = (subjectsRes.data || []).map((s) => ({ id: s.value, name: (s.text || "").trim() }));
    console.log(`\n━━ الصف ${grade} — ${subjects.length} مادة`);

    for (const subject of subjects) {
      for (const term of [1, 2]) {
        let results;
        try {
          results = await moeJson("/api/librarysearch", {
            BooksFor: 1, MoeYear: MOE_YEAR, EducationTypeID: EDUCATION_TYPE_GENERAL,
            EducationStageID: gradeInfo.stageId, EducationGradeID: gradeInfo.gradeId,
            EducationSubjectID: subject.id, Term: term,
          });
        } catch (e) {
          failures.push(`صف ${grade}/${subject.name}/ف${term}: بحث — ${e.message}`);
          continue;
        }

        const books = results.books || [];
        if (!books.length) continue;

        // الكتاب الأكبر عادةً هو كتاب المنهج نفسه، مو الكراسة المرافقة له.
        const book = books.reduce((a, b) =>
          (b.fileDescription || "").length > (a.fileDescription || "").length ? b : a, books[0]);

        try {
          totalLessons += await processBook({ grade, gradeInfo, subject, term, book });
        } catch (e) {
          console.log(`   ✗ ${subject.name} ف${term}: ${e.message}`);
          failures.push(`صف ${grade}/${subject.name}/ف${term}: ${e.message}`);
        }
      }
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`إجمالي الدروس المستخرجة: ${totalLessons}${dryRun ? " (تجربة — بدون حفظ)" : ""}`);
  if (failures.length) {
    console.log(`\nفشل ${failures.length}:`);
    failures.forEach((f) => console.log(`  • ${f}`));
  }
}

main().catch((e) => { console.error("خطأ غير متوقع:", e); process.exit(1); });
