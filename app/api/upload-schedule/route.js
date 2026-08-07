import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitWeekMap, kuwaitTodayLabel, kuwaitYear } from "@/lib/kuwaitDate";

export async function POST(req) {
  try {
    return await handleUpload(req);
  } catch (e) {
    console.error("upload-schedule unexpected error:", e);
    return NextResponse.json({ error: "خطأ غير متوقع: " + e.message }, { status: 500 });
  }
}

async function handleUpload(req) {
  const { motherId, childId, images } = await req.json();
  if (!motherId || !childId || !images?.length) {
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

  const { map, sunday, thursday } = kuwaitWeekMap();
  const todayLabel = kuwaitTodayLabel();
  const currentYear = kuwaitYear();

  const content = [
    {
      type: "text",
      text: `أنت مساعد يقرأ صور جداول واجبات مدرسية كويتية (من إنستقرام حساب المدرسة). أمامك ${images.length} صورة، وكلها معروف مسبقاً إنها تخص واجبات طالب واحد محدد (الصف ${child.grade}/${child.section})، فلا تحتاجين تحديد صاحب الجدول من الصورة.

السياق: اليوم ${todayLabel}. السنة الحالية ${currentYear}. الأسبوع الحالي من الأحد ${sunday} إلى الخميس ${thursday}.
تواريخ أيام هذا الأسبوع بالتحديد:
الأحد=${map["الأحد"]}, الاثنين=${map["الاثنين"]}, الثلاثاء=${map["الثلاثاء"]}, الأربعاء=${map["الأربعاء"]}, الخميس=${map["الخميس"]}.

اقرأ كل صورة واستخرج كل مهمة (واجب/حفظ قرآن أو حديث/اختبار/مشروع) بمادتها، وحدّدي حقل dueDate حسب الحالات التالية بالضبط:
1) لو مكتوب بالصورة تاريخ صريح (مثل "24 مارس" أو "٢٠٢٦/٣/٢٤" أو "24/3")، حوّليه لصيغة YYYY-MM-DD واستخدميه كما هو حتى لو كان بعيداً عن الأسبوع الحالي (مشروع نهاية فصل، اختبار بعد أسابيع، إلخ). استخدمي سنة ${currentYear} إلا لو الشهر المذكور سابق زمنياً وبشكل واضح عن الشهر الحالي، فاستخدمي ${currentYear + 1}.
2) لو مذكور بس اسم يوم (الأحد، الاثنين...) بدون تاريخ صريح، طابقيه بجدول الأسبوع الحالي أعلاه.
3) لو مذكورة عبارة نسبية بدون تاريخ فعلي مرفق (مثل "نهاية الفصل الدراسي" أو "الأسبوع الثامن")، لا تخترعي تاريخاً إطلاقاً — خلّي dueDate تساوي null، واكتبي النص الأصلي كما هو بحقل details (مثلاً "تسليم: نهاية الفصل الدراسي").

أي صفحة أو رقم درس أو نطاق حفظ أو ملاحظة إضافية ضعيها بحقل details أيضاً.

استخرجي أيضاً أي طلبات أو مستلزمات مدرسية إن وُجدت (بنفس منطق تحديد dueDate أعلاه لو كان لها تاريخ تسليم، وإلا null).

إذا ظهر رقم صف أو شعبة بوضوح بالصورة، اذكريه بحقل gradeSeen (مثلاً "٣/١") — هذا اختياري وللمرجعية فقط، ولا يمنع استخراج البيانات لو ما ظهر أو كانت الصورة مقصوصة.

أرجعي JSON فقط بدون أي شرح أو Markdown، بهذا الشكل بالضبط:
{"entries":[{"subject":"اسم المادة","type":"واجب|حفظ|اختبار|مشروع","dueDate":"YYYY-MM-DD أو null","details":"نص اختياري","gradeSeen":"نص اختياري"}],"requirements":[{"item":"اسم الغرض","dueDate":"YYYY-MM-DD أو null"}]}`,
    },
    ...images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: (img.split(",")[1] || img) },
    })),
  ];

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      messages: [{ role: "user", content }],
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("Anthropic API error:", aiRes.status, errText);
    return NextResponse.json({ error: `فشل استدعاء التحليل (${aiRes.status}): ${errText}` }, { status: 500 });
  }

  const aiData = await aiRes.json();
  const textBlock = (aiData.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    console.error("No text block in Anthropic response:", JSON.stringify(aiData));
    return NextResponse.json({ error: "لم يصل رد نصي من التحليل" }, { status: 500 });
  }

  const cleaned = textBlock.text.replace(/```json/g, "").replace(/```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse AI JSON:", e.message, "raw text:", textBlock.text);
    return NextResponse.json({ error: "رد غير صالح من التحليل: " + e.message }, { status: 500 });
  }

  const todayStr = kuwaitTodayStr();
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const normalizeDueDate = (v) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
  let matchedTasks = 0;
  let updatedTasks = 0;
  let matchedReqs = 0;
  let updatedReqs = 0;
  let skippedOld = 0;

  for (const e of parsed.entries || []) {
    const dueDate = normalizeDueDate(e.dueDate);
    if (dueDate && dueDate < todayStr) {
      skippedOld++;
      continue;
    }
    let details = e.details || null;
    if (e.gradeSeen) {
      details = details ? `${details} (الصف بالصورة: ${e.gradeSeen})` : `الصف بالصورة: ${e.gradeSeen}`;
    }
    const type = e.type || "واجب";

    // لو فيه واجب نشط واحد بس بنفس المادة والنوع لهذا الطالب/ة، اعتبريه نفس الواجب
    // وحدّثي تاريخه/تفاصيله بدل إضافة نسخة مكررة (تحافظ على نفس الـ id عشان التذكير المرتبط به يتحدّث بدل ما يتكرر).
    // لو فيه أكثر من واجب نشط مطابق (مثل حفظ قرآن يومي بنفس المادة)، ما نخمّن أيهم — نضيف كسجل جديد.
    const { data: existingTasks } = await sb
      .from("tasks")
      .select("id")
      .eq("child_id", child.id)
      .eq("subject", e.subject)
      .eq("type", type)
      .eq("status", "active");

    if (existingTasks && existingTasks.length === 1) {
      await sb.from("tasks").update({ due_date: dueDate, details }).eq("id", existingTasks[0].id);
      updatedTasks++;
    } else {
      await sb.from("tasks").insert({
        child_id: child.id,
        subject: e.subject,
        type,
        due_date: dueDate,
        details,
        status: "active",
        source: "image",
      });
      matchedTasks++;
    }
  }

  for (const r of parsed.requirements || []) {
    const dueDate = normalizeDueDate(r.dueDate);
    if (dueDate && dueDate < todayStr) {
      skippedOld++;
      continue;
    }

    const { data: existingReqs } = await sb
      .from("requirements")
      .select("id")
      .eq("child_id", child.id)
      .eq("item", r.item)
      .eq("bought", false);

    if (existingReqs && existingReqs.length === 1) {
      await sb.from("requirements").update({ due_date: dueDate }).eq("id", existingReqs[0].id);
      updatedReqs++;
    } else {
      await sb.from("requirements").insert({
        child_id: child.id,
        item: r.item,
        due_date: dueDate,
        bought: false,
      });
      matchedReqs++;
    }
  }

  return NextResponse.json({ ok: true, matchedTasks, updatedTasks, matchedReqs, updatedReqs, skippedOld, imagesProcessed: images.length });
}
