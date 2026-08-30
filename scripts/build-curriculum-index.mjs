#!/usr/bin/env node
// يبني فهرس دروس المنهج (عناوين الوحدات والدروس) ويخزّنه بجدول curriculum_index.
//
// ليش سكربت محلي مو مسار API؟ كتب الوزارة أحجامها كبيرة (بعضها ٩٠+ ميجا)،
// وتنزيلها ومعالجتها يتجاوز حدود وقت وذاكرة الدوال بـVercel. وكمان مكتبة
// الوزارة ما تنفتح إلا من شبكة تسمح بها.
//
// نرسل صفحات الفهرس فقط (أول ووسط وآخر الكتاب) للذكاء الاصطناعي — مو الكتاب
// كامل — عشان التكلفة تبقى بسيطة. ما نخزّن أي ملف كتاب، فقط عناوين الدروس.
//
// التشغيل:
//   export SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  ANTHROPIC_API_KEY=...
//   node scripts/build-curriculum-index.mjs --grade 3 --term 1 --dry-run  # تجربة
//   node scripts/build-curriculum-index.mjs --grade 3 --term 1            # صف وفصل
//   node scripts/build-curriculum-index.mjs                               # كل شي

import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { pathToFileURL } from "url";

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

// الفهرس عادةً بأول الكتاب، وبعضها يحطه بالآخر. وكتب الوزارة كثير منها
// "القسم الأول والقسم الثاني" مدموجين بملف واحد — وفهرس القسم الثاني يقع
// بمنتصف الملف، فناخذ عيّنة من الوسط كمان.
// صفحات هذي الكتب صور ممسوحة عالية الدقة، فنبدأ بأوسع نطاق وننزل تدريجياً
// لين الحجم يدخل تحت الحد.
const PAGE_BUDGETS = [
  { head: 10, middle: 8, tail: 6 },
  { head: 8, middle: 5, tail: 4 },
  { head: 5, middle: 4, tail: 3 },
  { head: 3, middle: 2, tail: 2 },
  { head: 2, middle: 1, tail: 1 },
];

// أقل عدد دروس نقبله. الأقل من كذا يعني الاقتطاع طاح على طرف الفهرس فما
// التقط إلا سطراً أو سطرين — وفهرس ناقص أضر من لا فهرس، لأن المعلم الذكي
// يعتمد عليه كأنه المنهج كامل.
const MIN_LESSONS = 4;

// كراسات التدريبات والخط ما فيها فهرس دروس — نأخّرها ونجرّب كتاب المنهج أول.
const WORKBOOK_HINTS = ["كراسة", "تدريبات", "الخط", "نشاط", "أنشطة", "handwriting", "workbook", "activity"];

// حد الطلب ٣٢ ميجا وترميز base64 يضخّم ~٣٣٪، فـ٢٢ ميجا خام ≈ ٢٩.٣ مرمّزة.
const MAX_PDF_BYTES = Number(process.env.MAX_PDF_MB || 22) * 1024 * 1024;

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};
const onlyGrade = argValue("--grade") ? Number(argValue("--grade")) : null;
// الفصل الثاني ما يحتاج قبل فبراير — استخراجه لاحقاً يوفّر نص الوقت والتكلفة.
const onlyTerm = argValue("--term") ? Number(argValue("--term")) : null;
const terms = onlyTerm ? [onlyTerm] : [1, 2];
const dryRun = args.includes("--dry-run");

function requireEnv() {
  for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]) {
    if (!process.env[key]) {
      console.error(`✗ متغير البيئة ${key} غير معرّف`);
      process.exit(1);
    }
  }
}

let sb = null;
const db = () => (sb ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
}));

async function moeJson(path, body) {
  const res = await fetch(`${MOE_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

// ————— المسار النصي (المفضّل) —————
// لو الكتاب فيه طبقة نص، نستخرجها محلياً بلا تكلفة ونرسل نصاً بدل صور:
// أرخص وأسرع، وبلا حد حجم — وأهم من كذا نقدر نلقى صفحة الفهرس بالبحث عن
// عناوينها بدل ما نخمّن مكانها بالاقتطاع.
const TOC_MARKERS = ["المحتويات", "المحتوى", "الفهرس", "محتويات الكتاب", "contents", "table of contents"];
const TOC_FOLLOW_PAGES = 4; // الفهرس عادةً ممتد على أكثر من صفحة
const MIN_TEXT_CHARS = 400; // أقل من كذا يعني الكتاب صور ممسوحة

async function extractPageTexts(pdfBytes) {
  const pdf = await getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: true,
    verbosity: 0,
  }).promise;
  const texts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      texts.push(tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim());
    } catch {
      texts.push("");
    }
  }
  await pdf.cleanup?.();
  return texts;
}

// نرجّع نص صفحات الفهرس لو لقيناها، وإلا نص عيّنة من أول الكتاب ووسطه.
function pickTocText(texts) {
  const norm = (s) => s.toLowerCase().replace(/[إأآا]/g, "ا");
  const hits = [];
  texts.forEach((t, i) => {
    const n = norm(t);
    if (TOC_MARKERS.some((m) => n.includes(norm(m)))) hits.push(i);
  });

  const wanted = new Set();
  if (hits.length) {
    for (const h of hits) {
      for (let i = h; i < Math.min(h + TOC_FOLLOW_PAGES, texts.length); i++) wanted.add(i);
    }
  } else {
    // ما لقينا عنوان فهرس — ناخذ عيّنة معقولة من أول الكتاب ووسطه
    for (let i = 0; i < Math.min(14, texts.length); i++) wanted.add(i);
    const mid = Math.floor(texts.length / 2);
    for (let i = mid; i < Math.min(mid + 8, texts.length); i++) wanted.add(i);
  }

  const chunks = [...wanted].sort((a, b) => a - b)
    .filter((i) => texts[i].trim().length > 5)
    .map((i) => `--- صفحة ${i + 1} ---\n${texts[i]}`);
  return { text: chunks.join("\n\n"), foundToc: hits.length > 0, tocPages: hits.map((h) => h + 1) };
}

// ————— المسار المصوّر (احتياطي للكتب الممسوحة) —————
// نقتطع صفحات الفهرس من الكتاب بدل ما نرسله كامل — الكتاب الكامل يتجاوز حد
// حجم الطلب، وتكلفة قراءته بالكامل عالية بلا داعي.
async function slicePages(src, { head, middle, tail }, total) {
  const wanted = new Set();
  for (let i = 0; i < Math.min(head, total); i++) wanted.add(i);
  // عيّنة حول منتصف الملف — مكان فهرس القسم الثاني بالكتب المدموجة. ناخذ
  // نافذة تبدأ قبل المنتصف بشوي، لأن الفهرس عادةً يسبق أول درس بالقسم.
  const mid = Math.max(0, Math.floor(total / 2) - Math.floor(middle / 3));
  for (let i = mid; i < Math.min(mid + middle, total); i++) wanted.add(i);
  for (let i = Math.max(0, total - tail); i < total; i++) wanted.add(i);

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, [...wanted].sort((a, b) => a - b));
  pages.forEach((p) => out.addPage(p));
  return { bytes: Buffer.from(await out.save()), count: wanted.size };
}

async function extractIndexPages(pdfBytes) {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = src.getPageCount();

  let last = null;
  for (const budget of PAGE_BUDGETS) {
    const slice = await slicePages(src, budget, total);
    last = { ...slice, ...budget };
    if (slice.bytes.byteLength <= MAX_PDF_BYTES) {
      return { ...last, totalPages: total, fits: true };
    }
  }
  return { ...last, totalPages: total, fits: false };
}

async function askClaudeForLessons({ pdfBuffer, tocText }, { grade, subjectName, term, bookTitle }) {
  // مفاتيح Anthropic المرتبطة بالهوية تتطلب تحديد مساحة العمل بكل طلب.
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  if (process.env.ANTHROPIC_WORKSPACE_ID) {
    headers["anthropic-workspace-id"] = process.env.ANTHROPIC_WORKSPACE_ID;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          ...(pdfBuffer ? [{
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBuffer.toString("base64") },
            title: bookTitle,
          }] : []),
          {
            type: "text",
            text: (tocText ? `هذا نص مستخرَج من صفحات كتاب "${bookTitle}":\n\n${tocText}\n\n` : "") +
`${tocText ? "" : `هذي صفحات مختارة من كتاب "${bookTitle}" — `}مادة ${subjectName}، الصف ${grade}، الفصل الدراسي ${term} (منهج الكويت).

فتّشي كل الصفحات المرفقة عن صفحة الفهرس/المحتويات، واستخرجي **كل** الوحدات والدروس المذكورة فيها كما هي مكتوبة حرفياً — بدون تغيير الصياغة ولا إضافة دروس من عندك. كوني شاملة: لو الفهرس ممتد على أكثر من صفحة، أدرجي ما فيها كلها.

لا تدرجي العناصر اللي مو دروساً، مثل: معايير المنهج، نواتج التعلم، المقدمة، دليل استخدام الكتاب، قائمة المراجع، Scope and Sequence، Learning Outcomes، Progress Test، Project.

أرجعي JSON فقط بهذا الشكل، بدون أي نص قبله أو بعده:
{"lessons":[{"unit":"اسم الوحدة أو الفصل","title":"عنوان الدرس","page":12}]}

- لو الدرس ما ينتمي لوحدة، خلي unit فاضية "".
- page هو رقم صفحة الدرس **كما هو مكتوب بالفهرس** (رقم صفحة الكتاب مو ترتيب الملف). لو ما فيه رقم، اتركيه null.
- لو ما لقيتِ صفحة فهرس واضحة بهذي الصفحات، أرجعي {"lessons":[]} — لا تخمّني دروساً من محتوى الصفحات.`,
          },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("anthropic-workspace-id") && !process.env.ANTHROPIC_WORKSPACE_ID) {
      throw new Error(
        "المفتاح مرتبط بالهوية ويحتاج معرّف مساحة العمل. حدّدي المتغير ثم أعيدي التشغيل:\n" +
        "        export ANTHROPIC_WORKSPACE_ID=\"wrkspc_...\"\n" +
        "        (من console.anthropic.com ← Settings ← Workspaces)"
      );
    }
    throw new Error(`Anthropic HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || []).find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  return Array.isArray(parsed.lessons) ? parsed.lessons : [];
}

// الكراسات (تدريبات/خط) ما فيها فهرس دروس — نرتّب كتاب المنهج قبلها.
function rankBooks(books) {
  const isWorkbook = (b) => {
    const d = (b.fileDescription || "").toLowerCase();
    return WORKBOOK_HINTS.some((h) => d.includes(h.toLowerCase()));
  };
  return [...books].sort((a, b) => {
    const wa = isWorkbook(a) ? 1 : 0;
    const wb = isWorkbook(b) ? 1 : 0;
    if (wa !== wb) return wa - wb;
    return (b.fileDescription || "").length - (a.fileDescription || "").length;
  });
}

async function tryBook({ grade, subject, term, book }) {
  const title = book.fileDescription.trim();
  const pdfRes = await fetch(`${MOE_BASE}/api/File/preview/book/${book.bookFileID}`);
  if (!pdfRes.ok) throw new Error(`تحميل الكتاب فشل: HTTP ${pdfRes.status}`);
  const full = Buffer.from(await pdfRes.arrayBuffer());
  const sizeMb = (full.byteLength / 1048576).toFixed(1);

  // المسار المفضّل: نص مستخرَج محلياً — بلا تكلفة، بلا حد حجم، ونقدر نلقى
  // صفحة الفهرس بالبحث بدل التخمين.
  let texts = [];
  try {
    texts = await extractPageTexts(full);
  } catch (e) {
    console.log(`   (تعذّر استخراج النص: ${e.message})`);
  }
  const joined = texts.join("");
  if (joined.length >= MIN_TEXT_CHARS) {
    const { text, foundToc, tocPages } = pickTocText(texts);
    console.log(
      `   «${title}» ${sizeMb}MB / ${texts.length} صفحة — نص` +
      (foundToc ? ` (فهرس بصفحة ${tocPages.slice(0, 3).join("، ")})` : " (بلا عنوان فهرس — عيّنة)") +
      ` بحجم ${(text.length / 1024).toFixed(0)}KB`
    );
    const lessons = await askClaudeForLessons({ tocText: text }, {
      grade, subjectName: subject.name, term, bookTitle: title,
    });
    if (lessons.length) return lessons;
    console.log("   (النص ما أعطى فهرساً — نجرّب الصور)");
  } else {
    console.log(`   «${title}» ${sizeMb}MB — بلا طبقة نص (صور ممسوحة)`);
  }

  // احتياطي: نرسل صور الصفحات
  const { bytes, totalPages, count, head, middle, tail, fits } = await extractIndexPages(full);
  if (!fits) {
    throw new Error(
      `صفحات الفهرس كبيرة حتى بأقل نطاق (${(bytes.byteLength / 1048576).toFixed(1)}MB لـ${count} صفحات) — صور عالية الدقة وبلا طبقة نص`
    );
  }
  console.log(`   → صور: ${count} صفحة (${head}+${middle}+${tail}) بحجم ${(bytes.byteLength / 1048576).toFixed(1)}MB / ${totalPages} صفحة`);

  return askClaudeForLessons({ pdfBuffer: bytes }, {
    grade, subjectName: subject.name, term, bookTitle: title,
  });
}

// نجرّب الكتب بالترتيب لين نلقى واحداً فيه فهرس — كتاب واحد ما ينجح ما يعني
// إن المادة بلا فهرس، ممكن يكون كراسة أو قسماً بلا فهرس.
async function processBook({ grade, subject, term, books }) {
  const label = `صف ${grade} | ${subject.name} | ف${term}`;
  let lessons = [];
  let used = null;
  const problems = [];

  for (const book of rankBooks(books)) {
    try {
      const found = await tryBook({ grade, subject, term, book });
      // فهرس بدرس أو درسين شبه أكيد إنه ناقص (الاقتطاع طاح على طرف الفهرس)،
      // وتخزينه أضر من تركه: المعلم الذكي يبني عليه كأنه المنهج كامل.
      if (found.length >= MIN_LESSONS) { lessons = found; used = book; break; }
      if (found.length) {
        console.log(`   ⚠️  فهرس ناقص (${found.length} درس فقط) بـ«${book.fileDescription.trim()}» — نتجاهله`);
      } else {
        console.log(`   ⚠️  ما فيه فهرس بـ«${book.fileDescription.trim()}»`);
      }
    } catch (e) {
      problems.push(`«${book.fileDescription.trim()}»: ${e.message}`);
    }
  }

  if (!lessons.length) {
    if (problems.length) throw new Error(problems.join(" | "));
    console.log(`   ⚠️  ما انستخرج فهرس — ${label}`);
    return 0;
  }

  const book = used;
  if (dryRun) {
    const sample = lessons.slice(0, 5).map((l) => l.title).filter(Boolean);
    console.log(`   عيّنة: ${sample.join(" • ")}${lessons.length > 5 ? " …" : ""}`);
  }

  if (!dryRun) {
    const { error } = await db().from("curriculum_index").upsert({
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

// نتحقق من المفتاح بطلب صغير قبل ما نبدأ — تنزيل كتب الوزارة يوصل مئات
// الميجابايتات، وما نبي نكتشف إن المفتاح غلط بعد ما ننزّلها كلها.
async function preflight() {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  if (process.env.ANTHROPIC_WORKSPACE_ID) {
    headers["anthropic-workspace-id"] = process.env.ANTHROPIC_WORKSPACE_ID;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (res.ok) {
    console.log("✓ مفتاح Anthropic شغّال" + (process.env.ANTHROPIC_WORKSPACE_ID ? " (مع مساحة عمل محددة)" : ""));
    return;
  }
  const body = await res.text();
  console.error(`\n✗ مفتاح Anthropic ما اشتغل (HTTP ${res.status})`);
  if (body.includes("must be a valid workspace ID")) {
    console.error(
      "  قيمة ANTHROPIC_WORKSPACE_ID غير صحيحة.\n" +
      "  المعرّف الصحيح تلقينه برابط صفحة مساحة العمل بـconsole.anthropic.com\n" +
      "  (Settings ← Workspaces ← افتحي المساحة، والمعرّف بآخر الرابط).\n" +
      "  أو الأسهل: سوّي مفتاحاً من داخل مساحة عمل محددة — عندها ما تحتاجين هذا المتغير أصلاً،\n" +
      "  واحذفيه بالأمر:  unset ANTHROPIC_WORKSPACE_ID"
    );
  } else if (body.includes("anthropic-workspace-id is required")) {
    console.error(
      "  المفتاح مرتبط بالهوية ويحتاج تحديد مساحة العمل:\n" +
      "    export ANTHROPIC_WORKSPACE_ID=\"...\"   (من Settings ← Workspaces)"
    );
  } else {
    console.error("  " + body.slice(0, 300));
  }
  process.exit(1);
}

async function main() {
  requireEnv();
  await preflight();
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
      for (const term of terms) {
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

        try {
          totalLessons += await processBook({ grade, subject, term, books });
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

// نشغّل main فقط عند التنفيذ المباشر، عشان الدوال تبقى قابلة للاستيراد بالاختبار.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("خطأ غير متوقع:", e); process.exit(1); });
}

export { extractIndexPages, extractPageTexts, pickTocText, rankBooks, MAX_PDF_BYTES, PAGE_BUDGETS };
