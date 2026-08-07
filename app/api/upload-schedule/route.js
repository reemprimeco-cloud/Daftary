import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function kuwaitTodayStr() {
  const kuwaitNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return kuwaitNow.toISOString().slice(0, 10);
}

function weekMap() {
  const now = new Date();
  const day = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - day);
  sunday.setUTCHours(0, 0, 0, 0);
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const map = {};
  days.forEach((d, i) => {
    const dt = new Date(sunday);
    dt.setUTCDate(sunday.getUTCDate() + i);
    map[d] = dt.toISOString().slice(0, 10);
  });
  return { map, sunday: map["الأحد"], thursday: map["الخميس"] };
}

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

  const { map, sunday, thursday } = weekMap();
  const todayLabel = new Date().toLocaleDateString("ar-KW", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const currentYear = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCFullYear();

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
  let matchedReqs = 0;
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
    await sb.from("tasks").insert({
      child_id: child.id,
      subject: e.subject,
      type: e.type || "واجب",
      due_date: dueDate,
      details,
      status: "active",
      source: "image",
    });
    matchedTasks++;
  }

  for (const r of parsed.requirements || []) {
    const dueDate = normalizeDueDate(r.dueDate);
    if (dueDate && dueDate < todayStr) {
      skippedOld++;
      continue;
    }
    await sb.from("requirements").insert({
      child_id: child.id,
      item: r.item,
      due_date: dueDate,
      bought: false,
    });
    matchedReqs++;
  }

  return NextResponse.json({ ok: true, matchedTasks, matchedReqs, skippedOld, imagesProcessed: images.length });
}
