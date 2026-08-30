import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAiUsage } from "@/lib/aiUsage";
import { consumeQuestion } from "@/lib/entitlements";
import {
  moeGradeInfo,
  kuwaitTerm,
  fetchMoeSubjects,
  searchMoeLibrary,
  matchSubjectFromText,
} from "@/lib/moeCurriculum";

export async function POST(req) {
  try {
    return await handleAsk(req);
  } catch (e) {
    console.error("ai-teacher/ask unexpected error:", e);
    return NextResponse.json({ error: "خطأ غير متوقع: " + e.message }, { status: 500 });
  }
}

async function handleAsk(req) {
  const { childId, question, image } = await req.json();
  const motherId = req.headers.get("x-mother-id");
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

  // نخصم السؤال قبل استدعاء الذكاء الاصطناعي — الخصم بعده يعني إن الفشل
  // بالخصم يمرّ استدعاءً مدفوعاً بلا مقابل.
  // الرصيد لكل طالب/ة على حدة، فنمرّر معرّفه مع معرّف ولي الأمر.
  const quota = await consumeQuestion(child.id, motherId);
  if (!quota.allowed) {
    return NextResponse.json({
      error: `انتهت أسئلة ${child.name} المتاحة`,
      quotaExhausted: true,
      childId: child.id,
    }, { status: 402 });
  }

  const gradeInfo = moeGradeInfo(child.grade);
  const term = kuwaitTerm();
  const questionText = (question || "").trim() || "اشرحي لي محتوى هذه الصورة وساعديني في حلها.";

  // نحاول نطابق المادة من نص السؤال بمواد المنهج الرسمية لصف الطالب/ة، عشان نجيب
  // ملفات وزارة التربية (نماذج اختبارات/مراجعات) المرتبطة تلقائياً بدون ما نطلب من
  // ولي الأمر يختار المادة يدوياً.
  let matchedSubject = null;
  let officialMaterials = [];
  let curriculumOutline = "";

  if (gradeInfo) {
    const subjects = await fetchMoeSubjects(gradeInfo.gradeId).catch(() => []);
    matchedSubject = matchSubjectFromText(questionText, subjects);

    if (matchedSubject) {
      // فهرس دروس المنهج المستخرَج مسبقاً (scripts/build-curriculum-index.mjs).
      // نص خفيف، يعطي المعلم إلماماً ببنية المنهج وأسماء الدروس الرسمية بدون
      // ما نرفق الكتاب نفسه (أحجامها تتجاوز حد الطلب وتكلفتها عالية).
      const { data: index } = await sb
        .from("curriculum_index")
        .select("book_title, lessons")
        .eq("grade", child.grade)
        .eq("subject_id", matchedSubject.id)
        .eq("term", term)
        .maybeSingle();

      const lessons = Array.isArray(index?.lessons) ? index.lessons : [];
      if (lessons.length) {
        const byUnit = new Map();
        for (const l of lessons) {
          const unit = (l?.unit || "").trim() || "دروس عامة";
          if (!byUnit.has(unit)) byUnit.set(unit, []);
          // رقم الصفحة يخلي المعلم يقدر يوجّه ولي الأمر لمكان الدرس بالكتاب
          if (l?.title) byUnit.get(unit).push(l.page ? `${l.title} (ص${l.page})` : l.title);
        }
        curriculumOutline = [...byUnit.entries()]
          .filter(([, titles]) => titles.length)
          .map(([unit, titles]) => `${unit}: ${titles.join("، ")}`)
          .join("\n");
      }

      const results = await searchMoeLibrary({
        stageId: gradeInfo.stageId,
        gradeId: gradeInfo.gradeId,
        subjectId: matchedSubject.id,
        term,
      }).catch(() => ({ books: [], examFiles: [] }));

      // أسماء المواد الرسمية فقط — نص خفيف يعرّف المعلم شنو المتوفر رسمياً
      // لهالمادة. ما نحمّل الملفات نفسها: مصدر المحتوى هو صورة الكتاب اللي
      // يرسلها ولي الأمر، وإرفاق نماذج الوزارة كان يضاعف تكلفة السؤال ٨ أضعاف
      // ($0.084 مقابل $0.011) بلا فائدة لهالطريقة بالعمل.
      officialMaterials = [
        ...(results.books || []).map((b) => `كتاب: ${b.fileDescription}`),
        ...(results.examFiles || []).map((f) => `نموذج/مراجعة: ${f.fileDescription}`),
      ];
    }
  }

  const contextText = `أنتِ معلّمة مساعدة لولي أمر كويتي يسأل نيابة عن ابنه/ابنته الطالب/ة "${child.name}" — الصف ${child.grade} (${gradeInfo ? "" : "صف غير محدد بدقة"}), الفصل الدراسي ${term}.
${matchedSubject ? `المادة المرجّحة: ${matchedSubject.name}.` : "لم يتضح من السؤال مادة دراسية محددة — أجيبي بعمومية أو استنتجي المادة من الصورة إن وُجدت."}
${officialMaterials.length ? `مواد رسمية متوفرة من مكتبة وزارة التربية الكويتية لنفس الصف والمادة والفصل:\n${officialMaterials.join("\n")}` : ""}
${curriculumOutline ? `فهرس دروس المنهج الرسمي لهذه المادة والصف والفصل (مستخرَج آلياً من كتاب الوزارة):\n${curriculumOutline}\n\nاستخدميه لتعرفي أي درس يقصده ولي الأمر ولتلتزمي بعناوين الدروس الرسمية كما هي. والأرقام بين قوسين (ص١٢) هي صفحة الدرس بالكتاب — وجّهي ولي الأمر لها لما تنفع («الدرس بصفحة ١٢ من الكتاب، شوفي الصورة اللي فيها…»).\nمهم: هذا الفهرس مستخرَج آلياً وقد يكون ناقصاً — فلا تقولي أبداً إن درساً "خارج المنهج" لمجرد إنه مو مذكور فيه. وهو عناوين فقط بدون محتوى الدروس، فلا تدّعي معرفة تفاصيل داخل الدرس ما هي متوفرة لك.` : ""}

سؤال ولي الأمر:
${questionText}

اشرحي بطريقة مبسّطة تناسب ولي أمر يريد يساعد ابنه بالواجب، وأعطي الإجابة الصحيحة مع خطوات الحل لو كان سؤال حل مسألة.

مهم جداً — مصدر إجابتك: ${image
    ? "صورة صفحة الكتاب/الواجب المرفقة هي مصدرك الأول والأهم. اقرئيها بتمعّن واشرحي محتواها بالضبط كما هو، ولا تضيفين معلومات تخالف اللي بالصورة حتى لو كانت صحيحة بشكل عام. لو جزء بالصورة مب واضح أو مقصوص، قولي إنه غير واضح واطلبي صورة أوضح بدل ما تخمّنين."
    : "ما أرفق ولي الأمر صورة. جاوبي على قد ما تسمح لك معلوماتك عن المنهج الكويتي، وإذا كان السؤال يحتاج محتوى درس معين ما هو متوفر لك، اطلبي منه بلطف يصوّر صفحة الدرس من الكتاب ويرسلها عشان تشرحينها له بدقة — هذا أفضل من إجابة مبنية على تخمين."}

مهم جداً — المصطلحات: التزمي حرفياً بمصطلحات وتسميات المنهج الكويتي كما تظهر بصورة الكتاب وبفهرس الدروس أعلاه. لا تستبدلي مصطلح المنهج بمرادف أو تسمية مختلفة حتى لو كانت أدق أو أشيع، لأن الطالب/ة يتعلم وينحل بنفس ألفاظ المنهج بالضبط وأي اختلاف يلخبطه بالاختبار. لو مصطلح معين مب واضح، اذكري إنك غير متأكدة من التسمية الرسمية بدل ما تخمّنين مرادف.

مهم جداً — لا تختلقي معلومات: لو ماكنتِ متأكدة من معلومة عن المنهج، قوليها صراحة («مب متأكدة، الأفضل تتأكدين من الكتاب أو المعلمة») بدل ما تعطين جواباً يبدو واثقاً وهو تخمين. إجابة ناقصة وصادقة أنفع لولي الأمر من إجابة كاملة وغلط.

مهم — أنتِ تجاوبين بالنص فقط: ما ترسلين ولا تصمّمين ولا ترسمين صوراً أو مخططات. لو السؤال يحتاج رسم أو شكل، اشرحيه بالكلام أو وجّهي ولي الأمر للصفحة اللي فيها الشكل بالكتاب.

مهم جداً — حدود التخصص: أنتِ مختصة بالمنهج الدراسي الكويتي فقط. لو سؤال ولي الأمر خارج عن المنهج الدراسي تماماً (سؤال شخصي، استشارة عامة، موضوع لا علاقة له بدراسة الطالب/ة، أو أي شي خارج نطاق الواجبات والمواد الدراسية)، اعتذري بأدب واشرحي إنك مختصة بس بمساعدة الطالب/ة بمنهجه الدراسي، ولا تحاولي تجاوبين عليه حتى لو تعرفين الإجابة.

مهم: ردّك بيُعرض بمربع رسائل نص عادي بدون أي دعم لـ Markdown، فلا تستخدمي رموز مثل # أو ** أو جداول بخطوط | أو علامات تنصيص كود (\` أو \`\`\`) أو أي صيغة برمجية/كود. اكتبي بنص عادي فقط بلغة عربية بسيطة مفهومة، واستخدمي أسطر جديدة وأرقام (١، ٢، ٣) أو إيموجي بسيطة للتنظيم لو احتجتِ. حتى لو الموضوع علمي أو تقني (زي الوراثة أو الكيمياء)، اشرحيه بكلام عادي بدون رموز أو ترميز أو صيغ مختصرة — الهدف يفهمه ولي أمر وطالب/ة، مو متخصص.`;

  const content = [{ type: "text", text: contextText }];
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
  await logAiUsage({
    motherId, childId: child.id, feature: "ai_teacher", model: "claude-sonnet-5",
    usage: aiData.usage, hadImage: !!image, attachments: 0,
  });
  const textBlock = (aiData.content || []).find((b) => b.type === "text");
  const answer = textBlock?.text?.trim() || "تعذّر توليد إجابة، حاولي مرة ثانية.";

  await sb.from("ai_messages").insert([
    { child_id: child.id, role: "user", content: questionText, had_image: !!image, subject: matchedSubject?.name || null },
    { child_id: child.id, role: "assistant", content: answer, had_image: false, subject: matchedSubject?.name || null },
  ]);

  return NextResponse.json({
    answer,
    subject: matchedSubject?.name || null,
    materialsUsed: officialMaterials,
    quota: {
      source: quota.source,
      remaining: (quota.remaining_subscription || 0) + (quota.remaining_credits || 0) + (quota.remaining_trial || 0),
    },
  });
}
