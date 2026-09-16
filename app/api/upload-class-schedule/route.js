import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { extractFromImages, QUALITY_TIPS } from "@/lib/visionExtract";
import { jobIdFrom, openJob, closeJob } from "@/lib/uploadJobs";
import { markTrialUploadUsed } from "@/lib/appEntitlements";

// تحليل صورة بالذكاء الاصطناعي يطول أكثر من المهلة الافتراضية،
// وتجاوزها يظهر للأم كـ«Load failed» بلا أي تفسير.
export const runtime = "nodejs";
// نداء النموذج ≈ ١٠–٢٠ ث، ومع إعادة محاولتين عند الازدحام (١٫٥ + ٣ ث)
// الحد الأقصى ≈ ٦٥ ث — فوق الستين القديمة.
export const maxDuration = 120;

const FEATURE = "upload_class_schedule";
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  // النتيجة تُسجَّل على معرّف المهمة مهما صار بالاتصال — راجع lib/uploadJobs.js
  const jobId = jobIdFrom(body);
  await openJob(jobId, motherId, "upload-class-schedule");
  let res;
  try {
    res = await handleUpload(body, motherId);
  } catch (e) {
    console.error("upload-class-schedule unexpected error:", e);
    res = NextResponse.json({ error: "خطأ غير متوقع: " + e.message }, { status: 500 });
  }
  await closeJob(jobId, motherId, res);
  return res;
}

async function handleUpload({ childId, images }, motherId) {
  if (!motherId || !childId || !images?.length) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: child, error: cErr } = await sb
    .from("children")
    .select("*")
    .eq("id", childId)
    .eq("mother_id", motherId)
    .single();
  if (cErr || !child) return NextResponse.json({ error: "الطالب/ة المحدد غير موجود" }, { status: 400 });

  const prompt = `أنت مساعد يقرأ صور "الجدول الدراسي الأسبوعي" (جدول الحصص) لمدرسة كويتية — جدول يبيّن مادة ومعلم/ـة كل حصة في كل يوم دراسي، وليس جدول واجبات أو تواريخ. أمامك ${images.length} صورة، وكلها معروف مسبقاً إنها تخص طالب واحد محدد (الصف ${child.grade}/${child.section})، فلا تحتاجين تحديد صاحب الجدول من الصورة.

شكل الجدول يختلف من مدرسة لمدرسة، فحدّدي أولاً كيف هو مرتّب قبل ما تقرئين: أحياناً الأيام صفوف والحصص أعمدة، وأحياناً العكس (الأيام أعمدة والحصص صفوف). وترتيب الأعمدة نفسه أحياناً من اليمين لليسار وأحياناً من اليسار لليمين — اعتمدي على ترويسات الصفوف والأعمدة المكتوبة، لا على موضع الخلية. قد يكون الجدول مكتوباً بالعربي أو بالإنجليزي أو بالاثنين معاً، وعدد الحصص يختلف (٥ إلى ٨ عادة).

بعد ما تعرفين الترتيب، اقرئي الجدول خلية خلية. لكل يوم دراسي استخرجي كل حصة بالترتيب من الأولى للأخيرة: رقم الحصة، اسم المادة، اسم المعلم/ـة كما هو مكتوب تحت اسم المادة، ووقت البداية والنهاية من ترويسة الحصة.

اكتبي أسماء الأيام بالعربي بهذه الصيغة بالضبط: الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس — حتى لو كانت مكتوبة بالإنجليزي أو بصيغة مختلفة في الصورة.

انقلي الجدول كما هو حرفياً ولا تغيّري فيه شيئاً:
- اقرئي كل خلية وحدها. لا تنسخي اسماً من خلية إلى خلية ثانية ولو كانتا لنفس المادة — بعض المدارس فيها أكثر من معلّمة للمادة الواحدة. الخلية غير الواضحة teacher فيها null.
- تكرار المادة طبيعي وصحيح: نفس المادة قد تجي حصتين متتاليتين بنفس اليوم أو تتكرر كل يوم. انقليها كما هي كل مرة، ولا تحذفي أي تكرار.
- اكتبي اسم المادة كما هو مكتوب بالصورة بالضبط، بلا تصحيح ولا توحيد ولا اختصار.
- لا تكتبي اسم المعلّمة في حقل subject ولا اسم المادة في حقل teacher.

الخلية المدمجة: إذا امتدت خلية واحدة على أكثر من حصة (مثل مادة تشغل الحصتين السادسة والسابعة معاً)، فهي حصتان بنفس المادة ونفس المعلم/ـة — اكتبيها لكل حصة تغطيها على حدة، ولا تتركي أي حصة منها فارغة. ونفس الشيء لو امتدت الخلية على أكثر من يوم.

إذا كانت الخلية "فسحة" أو "نشاط" اكتبيها بحقل subject كما هي بدل تجاهلها.

أرجعي JSON فقط بدون أي شرح أو Markdown، بهذا الشكل بالضبط:
{"days":{"الأحد":[{"period":1,"subject":"اسم المادة","teacher":"اسم أو null","startTime":"7:30","endTime":"8:10"}],"الاثنين":[],"الثلاثاء":[],"الأربعاء":[],"الخميس":[]}}`;

  const res = await extractFromImages({ images, prompt, motherId, childId, feature: FEATURE });
  if (!res.ok) {
    if (res.needsRotation) return NextResponse.json({ needsRotation: res.needsRotation });
    return NextResponse.json({ error: res.error, tips: res.tips }, { status: res.status });
  }

  const rows = buildRows(res.parsed, child.id);

  // جدول شبه فاضي معناه القراءة فشلت، مو إن الطالب عنده حصتين بالأسبوع.
  // لو مسحنا القديم وحفظنا هالنتيجة تروح بيانات الأم مقابل لا شيء.
  if (rows.length < DAYS.length) {
    console.error("class_schedule read produced too few rows:", rows.length);
    return NextResponse.json(
      {
        error: "ما قدرنا نقرأ الجدول كامل من الصورة — لازم ترفعين صورة بجودة أفضل.",
        tips: QUALITY_TIPS,
      },
      { status: 422 }
    );
  }

  // نحتفظ بالقديم لين ما ينجح الإدخال — الحذف قبل الإدخال كان يخلّي الأم
  // بلا جدول إطلاقاً لو فشل الإدخال لأي سبب.
  const { data: previous } = await sb.from("class_schedule").select("*").eq("child_id", child.id);

  await sb.from("class_schedule").delete().eq("child_id", child.id);
  const { error: insErr } = await sb.from("class_schedule").insert(rows);
  if (insErr) {
    console.error("class_schedule insert error:", insErr.message);
    if (previous?.length) await sb.from("class_schedule").insert(previous);
    return NextResponse.json({ error: "ما قدرنا نحفظ الجدول. جربي مرة ثانية." }, { status: 500 });
  }

  // التجربة المجانية تُستهلك هنا فقط — بعد نجاح الحفظ فعلياً، لا عند مجرد
  // المحاولة. آمنة النداء حتى لو الأم مشتركة أصلاً (راجع appEntitlements.js).
  await markTrialUploadUsed(motherId, "schedule");

  return NextResponse.json({ ok: true, matchedPeriods: rows.length, imagesProcessed: images.length });
}

// الواجهة تعرض الأيام بمطابقة نصية حرفية، فأي صيغة ثانية ("الإثنين"،
// "الاربعاء"، "Sunday") كانت تختفي من الجدول بصمت. نرجّع كل صيغة
// لاسمها المعتمد بدل ما نرمي اليوم كله.
const DAY_ALIASES = new Map();
for (const [canonical, variants] of [
  ["الأحد", ["احد", "sunday", "sun"]],
  ["الاثنين", ["اثنين", "اتنين", "monday", "mon"]],
  ["الثلاثاء", ["ثلاثاء", "ثلثاء", "tuesday", "tue", "tues"]],
  ["الأربعاء", ["اربعاء", "اربعا", "wednesday", "wed"]],
  ["الخميس", ["خميس", "thursday", "thu", "thur", "thurs"]],
]) {
  for (const v of variants) DAY_ALIASES.set(v, canonical);
}

function canonicalDay(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/^ال/, "")
    .replace(/\s+/g, "");
  return DAY_ALIASES.get(s) || null;
}

function buildRows(parsed, childId) {
  const rows = [];
  const seen = new Set();
  for (const [rawDay, periods] of Object.entries(parsed.days || {})) {
    const day = canonicalDay(rawDay);
    if (!day) continue;
    for (const p of periods || []) {
      const period = Number(p.period);
      const subject = String(p.subject || "").trim();
      // حصة بلا مادة أو برقم خارج المعقول نتيجة قراءة فاشلة، مو بيانات.
      if (!subject || !Number.isInteger(period) || period < 1 || period > 12) continue;
      // النموذج أحياناً يكرر نفس الحصة مرتين بنفس اليوم؛ الأولى تكفي.
      const key = `${day}|${period}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        child_id: childId,
        day,
        period_number: period,
        subject,
        teacher: String(p.teacher || "").trim() || null,
        // الوقت يُعرض كما هو ولا يدخل بأي حساب، فنحفظه بصيغته المكتوبة
        // بالجدول ("12.45" تبقى "12.45") بدل ما نوحّدها.
        start_time: String(p.startTime || "").trim() || null,
        end_time: String(p.endTime || "").trim() || null,
      });
    }
  }
  return rows;
}
