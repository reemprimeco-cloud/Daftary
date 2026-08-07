import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export async function POST(req) {
  try {
    return await handleUpload(req);
  } catch (e) {
    console.error("upload-class-schedule unexpected error:", e);
    return NextResponse.json({ error: "خطأ غير متوقع: " + e.message }, { status: 500 });
  }
}

async function handleUpload(req) {
  const { motherId, school, images } = await req.json();
  if (!motherId || !school || !images?.length) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ error: "مفتاح الذكاء الاصطناعي غير مُعدّ بالسيرفر" }, { status: 500 });
  }

  const sb = supabaseAdmin();
  const { data: children, error: cErr } = await sb
    .from("children")
    .select("*")
    .eq("mother_id", motherId)
    .eq("school", school);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
  if (!children?.length) {
    return NextResponse.json({ error: "ما فيه طلاب مسجلين لهذي المدرسة" }, { status: 400 });
  }

  const content = [
    {
      type: "text",
      text: `أنت مساعد يقرأ صور "الجدول الدراسي الأسبوعي" (جدول الحصص) لمدرسة كويتية — جدول يبيّن مادة كل حصة في كل يوم دراسي، وليس جدول واجبات أو تواريخ. أمامك ${images.length} صورة قد تخص صفوفاً وشعباً مختلفة، بترتيب عشوائي.

اقرأ كل صورة واستخرج:
1) الصف والشعبة الظاهرين (رقم الصف من 1-12 ورقم الشعبة، مثل "٣/١" = صف 3 شعبة 1).
2) لكل يوم من أيام الأسبوع الدراسي (الأحد, الاثنين, الثلاثاء, الأربعاء, الخميس) قائمة أسماء المواد لكل حصة بالترتيب من الحصة الأولى إلى الأخيرة كما تظهر بالجدول. إذا كانت حصة "فسحة" أو "نشاط" اكتبيها كما هي بدل تجاهلها.

أرجع JSON فقط بدون أي شرح أو Markdown، بهذا الشكل بالضبط:
{"schedules":[{"grade":3,"section":1,"days":{"الأحد":["مادة1","مادة2"],"الاثنين":["مادة1","مادة2"],"الثلاثاء":["مادة1","مادة2"],"الأربعاء":["مادة1","مادة2"],"الخميس":["مادة1","مادة2"]}}]}

إن لم تستطع قراءة صف أو شعبة بوضوح من صورة معينة، تجاهل تلك الصورة بالكامل ولا تخترع بيانات.`,
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

  let matchedChildren = 0;

  for (const s of parsed.schedules || []) {
    const child = children.find((c) => c.grade === Number(s.grade) && c.section === Number(s.section));
    if (!child) continue;

    const rows = [];
    for (const day of DAYS) {
      const subjects = s.days?.[day] || [];
      subjects.forEach((subject, i) => {
        if (subject) rows.push({ child_id: child.id, day, period_no: i + 1, subject });
      });
    }
    if (!rows.length) continue;

    await sb.from("class_schedule").delete().eq("child_id", child.id);
    const { error: insErr } = await sb.from("class_schedule").insert(rows);
    if (insErr) {
      console.error("class_schedule insert error:", insErr.message);
      continue;
    }
    matchedChildren++;
  }

  return NextResponse.json({ ok: true, matchedChildren, imagesProcessed: images.length });
}
