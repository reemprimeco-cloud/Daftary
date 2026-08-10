import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  moeGradeInfo,
  kuwaitTerm,
  fetchMoeSubjects,
  searchMoeLibrary,
  moeExamFileUrl,
  matchSubjectFromText,
} from "@/lib/moeCurriculum";

const MAX_ATTACH_BYTES = 15 * 1024 * 1024; // هامش أمان تحت حد 32MB لملفات PDF بالـ API
const MAX_EXAM_ATTACHMENTS = 2;

export async function POST(req) {
  try {
    return await handleAsk(req);
  } catch (e) {
    console.error("ai-teacher/ask unexpected error:", e);
    return NextResponse.json({ error: "خطأ غير متوقع: " + e.message }, { status: 500 });
  }
}

async function handleAsk(req) {
  const { motherId, childId, question, image } = await req.json();
  if (!motherId || !childId || (!question?.trim() && !image)) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ error: "مفتاح الذكاء الاصطناعي غير مُعدّ بالسيرفر" }, { status: 500 });
  }

  const sb = supabaseAdmin();
  const { data: child, error: cErr } = await sb
    .from("children")
    .select("*")
    .eq("id", childId)
    .eq("mother_id", motherId)
    .single();
  if (cErr || !child) return NextResponse.json({ error: "الطالب/ة المحدد غير موجود" }, { status: 400 });

  const gradeInfo = moeGradeInfo(child.grade);
  const term = kuwaitTerm();
  const questionText = (question || "").trim() || "اشرحي لي محتوى هذه الصورة وساعديني في حلها.";

  // نحاول نطابق المادة من نص السؤال بمواد المنهج الرسمية لصف الطالب/ة، عشان نجيب
  // ملفات وزارة التربية (نماذج اختبارات/مراجعات) المرتبطة تلقائياً بدون ما نطلب من
  // ولي الأمر يختار المادة يدوياً.
  let matchedSubject = null;
  let officialMaterials = [];
  const attachments = [];

  if (gradeInfo) {
    const subjects = await fetchMoeSubjects(gradeInfo.gradeId).catch(() => []);
    matchedSubject = matchSubjectFromText(questionText, subjects);

    if (matchedSubject) {
      const results = await searchMoeLibrary({
        stageId: gradeInfo.stageId,
        gradeId: gradeInfo.gradeId,
        subjectId: matchedSubject.id,
        term,
      }).catch(() => ({ books: [], examFiles: [] }));

      officialMaterials = [
        ...(results.books || []).map((b) => `كتاب: ${b.fileDescription}`),
        ...(results.examFiles || []).map((f) => `نموذج/مراجعة: ${f.fileDescription}`),
      ];

      // نرفق أول ملفين اختبار/مراجعة (عادة أحجامها صغيرة، بعكس الكتب الكاملة اللي
      // حجمها يتجاوز حد الـ API بسهولة) عشان الإجابة تكون مبنية عليها فعلياً.
      const examCandidates = (results.examFiles || []).slice(0, MAX_EXAM_ATTACHMENTS);
      for (const ex of examCandidates) {
        try {
          const fileRes = await fetch(moeExamFileUrl(ex.educationExamFileID));
          if (!fileRes.ok) continue;
          const buf = Buffer.from(await fileRes.arrayBuffer());
          if (buf.byteLength > MAX_ATTACH_BYTES) continue;
          attachments.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
            title: ex.fileDescription,
          });
        } catch {
          // تجاهلي فشل تحميل ملف واحد ولا توقفي باقي الطلب
        }
      }
    }
  }

  const contextText = `أنتِ معلّمة مساعدة لولي أمر كويتي يسأل نيابة عن ابنه/ابنته الطالب/ة "${child.name}" — الصف ${child.grade} (${gradeInfo ? "" : "صف غير محدد بدقة"}), الفصل الدراسي ${term}.
${matchedSubject ? `المادة المرجّحة: ${matchedSubject.name}.` : "لم يتضح من السؤال مادة دراسية محددة — أجيبي بعمومية أو استنتجي المادة من الصورة إن وُجدت."}
${officialMaterials.length ? `مواد رسمية متوفرة من مكتبة وزارة التربية الكويتية لنفس الصف والمادة والفصل:\n${officialMaterials.join("\n")}` : ""}
${attachments.length ? "مرفق مع هذه الرسالة نموذج/نماذج اختبار رسمية من الوزارة لنفس المادة والصف — استأنسي بأسلوبها وصياغتها لو كانت متعلقة بسؤال ولي الأمر." : ""}

سؤال ولي الأمر:
${questionText}

اشرحي بطريقة مبسّطة تناسب ولي أمر يريد يساعد ابنه بالواجب، وأعطي الإجابة الصحيحة مع خطوات الحل لو كان سؤال حل مسألة. لو أرفق صورة الواجب، اعتمدي عليها كمصدر أساسي للسؤال. لا تختلقي معلومات عن المنهج لو ماكنتِ متأكدة منها.

مهم: ردّك بيُعرض بمربع رسائل نص عادي بدون أي دعم لـ Markdown، فلا تستخدمي رموز مثل # أو ** أو جداول بخطوط |. اكتبي بنص عادي فقط، واستخدمي أسطر جديدة وأرقام (١، ٢، ٣) أو إيموجي بسيطة للتنظيم لو احتجتِ.`;

  const content = [{ type: "text", text: contextText }, ...attachments];
  if (image) {
    const mediaMatch = /^data:(image\/[a-zA-Z+]+);base64,/.exec(image);
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaMatch ? mediaMatch[1] : "image/jpeg", data: image.split(",")[1] || image },
    });
  }

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      messages: [{ role: "user", content }],
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("Anthropic API error:", aiRes.status, errText);
    return NextResponse.json({ error: `فشل استدعاء المعلم الذكي (${aiRes.status})` }, { status: 500 });
  }

  const aiData = await aiRes.json();
  const textBlock = (aiData.content || []).find((b) => b.type === "text");
  const answer = textBlock?.text?.trim() || "تعذّر توليد إجابة، حاولي مرة ثانية.";

  await sb.from("ai_messages").insert([
    { child_id: child.id, role: "user", content: questionText, had_image: !!image, subject: matchedSubject?.name || null },
    { child_id: child.id, role: "assistant", content: answer, had_image: false, subject: matchedSubject?.name || null },
  ]);

  return NextResponse.json({ answer, subject: matchedSubject?.name || null, materialsUsed: officialMaterials });
}
