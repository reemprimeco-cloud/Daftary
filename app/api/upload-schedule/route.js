import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { extractFromImages, QUALITY_TIPS } from "@/lib/visionExtract";
import { kuwaitNow, kuwaitTodayLabel, kuwaitYear, kuwaitWeekMap } from "@/lib/kuwaitDate";
import { jobIdFrom, openJob, closeJob } from "@/lib/uploadJobs";
import { markTrialUploadUsed } from "@/lib/appEntitlements";

// تحليل صورة بالذكاء الاصطناعي يطول أكثر من المهلة الافتراضية،
// وتجاوزها يظهر للأم كـ«Load failed» بلا أي تفسير.
export const runtime = "nodejs";
// نداء النموذج ≈ ١٠–٢٠ ث، ومع إعادة محاولتين عند الازدحام (١٫٥ + ٣ ث)
// الحد الأقصى ≈ ٦٥ ث — فوق الستين القديمة.
export const maxDuration = 120;

const FEATURE = "upload_homework";
// القيمة الوحيدة اللي تقبلها القاعدة (tasks_type_check).
const TASK_TYPES = new Set(["واجب", "حفظ", "اختبار", "مشروع", "درس"]);
const DAY_INDEX = { "الأحد": 0, "الاثنين": 1, "الثلاثاء": 2, "الأربعاء": 3, "الخميس": 4, "الجمعة": 5, "السبت": 6 };

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  // النتيجة تُسجَّل على معرّف المهمة مهما صار بالاتصال — راجع lib/uploadJobs.js
  const jobId = jobIdFrom(body);
  await openJob(jobId, motherId, "upload-schedule");
  let res;
  try {
    res = await handleUpload(body, motherId);
  } catch (e) {
    console.error("upload-schedule unexpected error:", e);
    res = NextResponse.json({ error: "خطأ غير متوقع: " + e.message }, { status: 500 });
  }
  await closeJob(jobId, motherId, res);
  return res;
}

// الخطة الأسبوعية تُنشر قبل بداية أسبوعها — الخميس أو الجمعة أو السبت —
// فـ«الأحد» فيها يعني الأحد القادم، مو الأحد اللي فات قبل خمسة أيام. كان
// النموذج يطابق اسم اليوم بتواريخ «الأسبوع الحالي» بحساب تقويمي (الأحد اللي
// بدأ منه هذا الأسبوع)، فخطة مرفوعة يوم السبت كانت تطلع كلها بتواريخ ماضية:
// ما تظهر باللوحة، ولا يوصل عنها أي تذكير. الحساب هنا بالخادم لا بالنموذج،
// وبقاعدة صاحبة التطبيق «كل أسبوع بأسبوعه»: الخطة تُرفع السبت قبل الأسبوع
// أو من الأحد للخميس أثناءه:
//   الجمعة والسبت   → الأسبوع القادم (اللي يبدأ الأحد الجاي)
//   الأحد–الخميس    → الأسبوع الحالي (اليوم اللي فات صار واجباً متأخراً، وهذا صحيح)
// والتاريخ الصريح المكتوب بالخطة يتقدّم على هذا كله.
function dateForDayName(rawDay) {
  const key = String(rawDay || "").trim().replace(/[أإآ]/g, "ا").replace(/^ال/, "");
  const idx = Object.entries(DAY_INDEX).find(([name]) => name.replace(/[أإآ]/g, "ا").replace(/^ال/, "") === key)?.[1];
  if (idx == null) return null;
  const now = kuwaitNow();
  const todayDow = now.getUTCDay();
  const nextWeek = todayDow >= 5;
  const sunday = new Date(now);
  sunday.setUTCHours(0, 0, 0, 0);
  sunday.setUTCDate(now.getUTCDate() - todayDow + (nextWeek ? 7 : 0));
  const d = new Date(sunday);
  d.setUTCDate(sunday.getUTCDate() + idx);
  return d.toISOString().slice(0, 10);
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

  const todayLabel = kuwaitTodayLabel();
  const currentYear = kuwaitYear();

  const prompt = `أنت مساعد يقرأ صور جداول واجبات وخطط أسبوعية مدرسية كويتية (من إنستقرام حساب المدرسة أو ورقة مطبوعة). أمامك ${images.length} صورة، وكلها معروف مسبقاً إنها تخص طالب واحد محدد (الصف ${child.grade}/${child.section})، فلا تحتاجين تحديد صاحب الجدول من الصورة.

السياق: اليوم ${todayLabel}. السنة الحالية ${currentYear}.

اقرئي كل صورة واستخرجي كل بند بمادته — لا تضمّي الحفظ (قرآن أو حديث) هنا، له قسم منفصل تحت. نوع البند (type) واحد من:
- "واجب": تكليف صريح مطلوب من الطالب/ة عمله (حل، اكتب، اقرأ واستخرج، وظّف، أحضر...) أو ما كُتب تحت عنوان «الواجب» بمحتوى فعلي.
- "اختبار": اختبار أو تقييم بموعد.
- "مشروع": مشروع أو بحث.
- "درس": محتوى المنهج الذي سيُدرَّس خلال الأسبوع (بنود، أرقام صفحات، مواضيع، أسئلة درس، كلمات جديدة، قواعد) — هذا ليس تكليفاً. وعبارات مثل «الواجب ما تكلف به المعلمة» أو «ما تحدده معلمة الفصل» ليست واجباً؛ اكتبيها كما هي ضمن details للدرس.
خلية فيها الاثنان (محتوى درس ثم تكليف صريح) = بندان: درس وواجب. لا تحوّلي محتوى المنهج إلى واجب.

لكل بند حدّدي موعده بأحد شكلين فقط:
1) dueDate: لو مكتوب بالصورة تاريخ صريح (مثل "24 مارس" أو "٢٠٢٦/٣/٢٤" أو "24/3")، حوّليه لصيغة YYYY-MM-DD واستخدميه كما هو حتى لو كان بعيداً (مشروع نهاية فصل، اختبار بعد أسابيع). استخدمي سنة ${currentYear} إلا لو الشهر المذكور سابق زمنياً وبشكل واضح عن الشهر الحالي، فاستخدمي ${currentYear + 1}.
2) dueDay: لو مذكور اسم يوم فقط (الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس) بلا تاريخ، اكتبي اسم اليوم كما هو ولا تحوّليه لتاريخ — الخادم يحسب التاريخ. وإذا كانت المهمة داخل عمود أو صف يوم معيّن في جدول أسبوعي، فذلك اليوم هو dueDay حتى لو ما كُتب داخل الخلية.
3) لو مذكورة عبارة نسبية بلا يوم ولا تاريخ (مثل "نهاية الفصل الدراسي" أو "الأسبوع الثامن")، لا تخترعي موعداً — خلّي الاثنين null، واكتبي العبارة كما هي بحقل dueText، وكذلك بحقل details (مثلاً "تسليم: نهاية الفصل الدراسي").
4) لو المهمة بلا أي موعد ولا يوم ولا عبارة (مجرد صف مادة داخل خطة أسبوعية)، خلّي dueDate وdueDay وdueText كلها null — الخادم يربطها بأسبوع الخطة.

مدى الخطة: لو الصورة تذكر صراحةً مدى أسبوع الخطة (مثل "من الاثنين ٢٠٢٦/٩/١٤ إلى الخميس ٢٠٢٦/٩/١٧")، اكتبي تاريخ آخر يوم بالمدى بحقل weekEnd بصيغة YYYY-MM-DD؛ وإلا null.

نفس المادة قد تتكرر بأيام مختلفة (واجب رياضيات الأحد وواجب رياضيات الأربعاء) — هذي مهمتان منفصلتان، اكتبي كل واحدة على حدة بيومها.

أي صفحة أو رقم درس أو ملاحظة إضافية ضعيها بحقل details.

استخرجي أيضاً أي طلبات أو مستلزمات مدرسية إن وُجدت (بنفس منطق الموعد أعلاه لو كان لها موعد، وإلا null).

بالإضافة لذلك، استخرجي كل مطلوبات الحفظ (قرآن كريم أو حديث) بقسم منفصل تماماً عن entries، بهذا الشكل: لكل عنصر حفظ حدّدي kind ("آية" لو قرآن أو "حديث" لو حديث نبوي)، وreference هو نص المرجع بالضبط زي ما هو مكتوب بالخطة (مثل "سورة البقرة من آية ١٠ إلى ١٥" أو "حديث: إنما الأعمال بالنيات")، وdetails لأي ملاحظة إضافية (رقم الصفحة، طريقة التسميع...). لا تخترعي نطاق آيات لو مو مكتوب بالصورة بالضبط.

انقلي ما هو مكتوب بالصورة حرفياً: أسماء المواد والمستلزمات ونصوص التفاصيل تُكتب كما هي، بلا تصحيح ولا توحيد ولا اختصار ولا إضافة أي كلمة من عندك. وتكرار نفس المادة أو نفس الغرض أمر طبيعي — انقليه كل مرة كما هو ولا تحذفي أي تكرار.

أرجعي JSON فقط بدون أي شرح أو Markdown، بهذا الشكل بالضبط:
{"weekEnd":"YYYY-MM-DD أو null","entries":[{"subject":"اسم المادة","type":"واجب|اختبار|مشروع|درس","dueDate":"YYYY-MM-DD أو null","dueDay":"اسم اليوم أو null","dueText":"عبارة نسبية أو null","details":"نص اختياري"}],"requirements":[{"item":"اسم الغرض","dueDate":"YYYY-MM-DD أو null","dueDay":"اسم اليوم أو null","dueText":"عبارة نسبية أو null"}],"memorization":[{"kind":"آية|حديث","reference":"نص المرجع بالضبط","details":"نص اختياري"}]}`;

  const res = await extractFromImages({ images, prompt, motherId, childId, feature: FEATURE });
  if (!res.ok) {
    if (res.needsRotation) return NextResponse.json({ needsRotation: res.needsRotation });
    return NextResponse.json({ error: res.error, tips: res.tips }, { status: res.status });
  }
  const parsed = res.parsed;

  // قراءة ما طلعت أي شيء (شوهد ١٨:٣٨ — رد من ٢٤ رمزاً لصورة خطة) كانت ترجع
  // «نجاح» بصفر واجبات، فتظن الأم إن الرفع تم. نقولها صراحةً.
  if (!parsed.entries?.length && !parsed.requirements?.length && !parsed.memorization?.length) {
    console.error(`${FEATURE}: empty extraction for ${images.length} image(s)`);
    return NextResponse.json(
      { error: "ما قدرنا نطلع أي واجب أو اختبار أو مستلزمات من الصورة — لازم ترفعين صورة بجودة أفضل.", tips: QUALITY_TIPS },
      { status: 422 }
    );
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const isDate = (v) => typeof v === "string" && DATE_RE.test(v);
  // مادة داخل خطة أسبوعية بلا يوم محدد كانت تبقى «بدون تاريخ» فما تظهر
  // بأسبوعها ولا يوصل عنها تذكير. قرار صاحبة التطبيق ١٥ سبتمبر: موعدها آخر
  // يوم بمدى الخطة (الخميس) — من المدى المكتوب بالصورة إن وُجد، وإلا خميس
  // أسبوع الخطة بقاعدة «كل أسبوع بأسبوعه». العبارة النسبية («نهاية الفصل»)
  // تبقى بلا موعد لأن الخطة نفسها تقول إنها مو لهذا الأسبوع.
  const weekEnd = isDate(parsed.weekEnd) ? parsed.weekEnd : dateForDayName("الخميس");
  const resolveDue = (e) => {
    if (isDate(e.dueDate)) return e.dueDate;
    const byDay = dateForDayName(e.dueDay);
    if (byDay) return byDay;
    if (e.dueText) return null;
    return weekEnd;
  };

  // الهوية = المادة + النوع + الموعد. كانت الهوية المادة والنوع فقط، فخطة
  // فيها «واجب رياضيات» الأحد و«واجب رياضيات» الأربعاء كانت الثانية تكتب
  // فوق الأولى وتضيّعها. وإعادة رفع نفس الخطة تحدّث التفاصيل بدل ما تكرر
  // (نفس المعرّف يبقى، فالتذكير المرتبط به يتحدّث بدل ما يتكرر).
  // المنجز (done) يدخل بالمطابقة كذلك — وإلا إعادة رفع نفس الخطة بعد ما
  // علّمت الأم واجباً «تم» تنشئ نسخة ثانية منه غير منجزة.
  const { data: activeTasks } = await sb
    .from("tasks").select("id, subject, type, due_date").eq("child_id", child.id).in("status", ["active", "done"]);
  const taskKey = (s, t, d) => `${s}|${t}|${d || ""}`;
  const known = new Map((activeTasks || []).map((t) => [taskKey(t.subject, t.type, t.due_date), t.id]));

  let matchedTasks = 0;
  let updatedTasks = 0;
  let matchedReqs = 0;
  let updatedReqs = 0;
  let matchedMemorization = 0;

  for (const e of parsed.entries || []) {
    const subject = String(e.subject || "").trim();
    if (!subject) continue;
    const dueDate = resolveDue(e);
    // التفاصيل تُحفظ كما كتبتها المدرسة بالصورة، بلا أي إضافة من عندنا.
    const details = e.details || null;
    // القاعدة تقبل أربعة أنواع فقط، وأي نوع غيرها كان يفجّر الإدخال
    // ويضيّع الرفعة كاملة — فنرجع للواجب بدل ما نخسر المهمة.
    const type = TASK_TYPES.has(e.type) ? e.type : "واجب";

    const key = taskKey(subject, type, dueDate);
    const existingId = known.get(key);
    if (existingId) {
      await sb.from("tasks").update({ details }).eq("id", existingId);
      updatedTasks++;
    } else {
      const { data: inserted } = await sb.from("tasks").insert({
        child_id: child.id,
        subject,
        type,
        due_date: dueDate,
        details,
        status: "active",
        source: "image",
      }).select("id").single();
      if (inserted) known.set(key, inserted.id);
      matchedTasks++;
    }
  }

  const { data: openReqs } = await sb
    .from("requirements").select("id, item").eq("child_id", child.id).eq("bought", false);
  const knownReqs = new Map((openReqs || []).map((r) => [r.item, r.id]));

  for (const r of parsed.requirements || []) {
    const item = String(r.item || "").trim();
    if (!item) continue;
    const dueDate = resolveDue(r);
    const existingId = knownReqs.get(item);
    if (existingId) {
      await sb.from("requirements").update({ due_date: dueDate }).eq("id", existingId);
      updatedReqs++;
    } else {
      const { data: inserted } = await sb.from("requirements").insert({
        child_id: child.id,
        item,
        due_date: dueDate,
        bought: false,
      }).select("id").single();
      if (inserted) knownReqs.set(item, inserted.id);
      matchedReqs++;
    }
  }

  for (const m of parsed.memorization || []) {
    if (!m.reference) continue;
    const kind = m.kind === "حديث" ? "حديث" : "آية";

    // لو نفس مرجع الحفظ موجود وما تحفظ بعد لهذا الطالب/ة، لا نكرره برفع نفس الخطة مرتين
    const { data: existingMem } = await sb
      .from("memorization")
      .select("id")
      .eq("child_id", child.id)
      .eq("reference", m.reference)
      .eq("done", false)
      .maybeSingle();

    if (!existingMem) {
      await sb.from("memorization").insert({
        child_id: child.id,
        kind,
        reference: m.reference,
        details: m.details || null,
      });
      matchedMemorization++;
    }
  }

  // التجربة المجانية تُستهلك هنا فقط — بعد نجاح الحفظ فعلياً، لا عند مجرد
  // المحاولة. آمنة النداء حتى لو الأم مشتركة أصلاً (راجع appEntitlements.js).
  await markTrialUploadUsed(motherId, "plan");

  // رفعة خطة جديدة = فرصة تنظيف: المنجز من أسابيع فاتت (أو بلا تاريخ أصلاً
  // — عبارات نسبية مثل «نهاية الفصل الدراسي») ما له داعٍ يبقى بالواجهة
  // للأبد. المُنجز غير المرتبط بتاريخ ما يختفي من نفسه أبداً بخلاف المؤرَّخ،
  // فكان يتراكم بالرئيسية مع كل رفعة. الحذف نهائي وللمنجز فقط — غير المنجز
  // (حتى لو قديم) يبقى كما هو، ما نضيّع شي الأم ما خلصته بعد.
  await cleanupCompletedBeforeThisWeek(sb, child.id);

  return NextResponse.json({ ok: true, matchedTasks, updatedTasks, matchedReqs, updatedReqs, matchedMemorization, imagesProcessed: images.length });
}

async function cleanupCompletedBeforeThisWeek(sb, childId) {
  const { sunday } = kuwaitWeekMap();
  await sb.from("tasks").delete().eq("child_id", childId).eq("status", "done").or(`due_date.is.null,due_date.lt.${sunday}`);
  // التسميع ما له تاريخ استحقاق بالقاعدة أصلاً، فكل منجز منه (من أي وقت
  // مضى) يعتبر «قديم» بمجرد رفع خطة جديدة.
  await sb.from("memorization").delete().eq("child_id", childId).eq("done", true);
}
