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

  const content = [
    {
      type: "text",
      text: `أنت مساعد يقرأ صور "الجدول الدراسي الأسبوعي" (جدول الحصص) لمدرسة كويتية — جدول يبيّن مادة ومعلم/ـة كل حصة في كل يوم دراسي، وليس جدول واجبات أو تواريخ. أمامك ${images.length} صورة، وكلها معروف مسبقاً إنها تخص طالب واحد محدد (الصف ${child.grade}/${child.section})، فلا تحتاجين تحديد صاحب الجدول من الصورة.

اقرأ كل صورة واستخرج لكل يوم من أيام الأسبوع الدراسي (الأحد, الاثنين, الثلاثاء, الأربعاء, الخميس) كل حصة بالترتيب من الأولى للأخيرة: رقم الحصة، اسم المادة، اسم المعلم/ـة إن وُجد بالجدول، ووقت البداية والنهاية إن وُجدا (مثل "8:00"). إذا كانت حصة "فسحة" أو "نشاط" اكتبيها بحقل subject كما هي بدل تجاهلها. اترك teacher أو startTime أو endTime فارغة/null لو ما ظهرت بالصورة، ولا تخترعي بيانات.

أرجعي JSON فقط بدون أي شرح أو Markdown، بهذا الشكل بالضبط:
{"days":{"الأحد":[{"period":1,"subject":"اسم المادة","teacher":"اسم اختياري","startTime":"اختياري","endTime":"اختياري"}],"الاثنين":[],"الثلاثاء":[],"الأربعاء":[],"الخميس":[]}}

إن لم تستطعي قراءة الجدول بوضوح من الصور، أرجعي كل الأيام بمصفوفات فارغة.`,
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

  const rows = [];
  for (const day of DAYS) {
    const periods = parsed.days?.[day] || [];
    periods.forEach((p) => {
      if (!p.subject || !p.period) return;
      rows.push({
        child_id: child.id,
        day,
        period_number: Number(p.period),
        subject: p.subject,
        teacher: p.teacher || null,
        start_time: p.startTime || null,
        end_time: p.endTime || null,
      });
    });
  }

  await sb.from("class_schedule").delete().eq("child_id", child.id);
  if (rows.length) {
    const { error: insErr } = await sb.from("class_schedule").insert(rows);
    if (insErr) {
      console.error("class_schedule insert error:", insErr.message);
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, matchedPeriods: rows.length, imagesProcessed: images.length });
}
