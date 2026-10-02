import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { familyIdOf } from "@/lib/family";
import { logAiUsage } from "@/lib/aiUsage";
import { consumeQuestion, refundQuestion } from "@/lib/entitlements";
import { detectRotation } from "@/lib/visionExtract";
import { storeSourceImages, AI_IMAGE_TTL_HOURS } from "@/lib/uploadSources";
import {
  moeGradeInfo,
  kuwaitTerm,
  fetchMoeSubjects,
  searchMoeLibrary,
  matchSubjectFromText,
} from "@/lib/moeCurriculum";

// إجابة مطوّلة من النموذج تاخذ ٢٠–٤٠ ثانية، والمهلة الافتراضية القصيرة
// كانت تقطعها فتظهر للأم كـ«Load failed» بلا تفسير (نفس ما صار بمسارات
// الرفع قبل تحديد مهلتها).
export const runtime = "nodejs";
export const maxDuration = 120;

// علامة داخلية يبدأ بها المعلم ردّه لما تكون الصورة غير صالحة للإجابة —
// نحذفها من النص ونرجّع السؤال لرصيد الأم: رد كله «أرسلي صورة أوضح» ما
// يستاهل يُحسب عليها (شوهد فعلاً: ظل إصبع على منتصف الصفحة).
const UNREADABLE_TAG = "[صورة_غير_واضحة]";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);
const RETRY_DELAYS_MS = [1500, 3000];

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
    .eq("family_id", await familyIdOf(sb, motherId))
    .single();
  if (cErr || !child) return NextResponse.json({ error: "الطالب/ة المحدد غير موجود" }, { status: 400 });

  // صورة صفحة الكتاب تُلتقط بالجوال وكثيراً ما تجي مقلوبة. شفنا بالمحادثات
  // الفعلية (١٤ سبتمبر) المعلم يرد «الصورة مقلوبة، أرسلي أوضح» — فراح
  // سؤال من رصيد الأم بلا إجابة. الفحص هنا قبل الخصم: لو مقلوبة يدوّرها
  // الجهاز ويعيد الإرسال تلقائياً بلا ما تنتبه الأم ولا ينخصم شي.
  if (image) {
    const rotation = await detectRotation(image, { motherId, childId: child.id });
    if (rotation) return NextResponse.json({ needsRotation: rotation });
  }

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

مهم جداً — الأم تبي الإجابة مو الشرح فقط. رتّبي ردّك هكذا دائماً:
١) «الإجابة»: الحل النهائي الصريح لكل سؤال أو فراغ أو فقرة بالصفحة، بنفس ترقيم الكتاب (أ، ب، ج… أو ١، ٢، ٣…)، مكتوباً جاهزاً للنقل بالدفتر. لو التمرين «أكمل الفراغ» اكتبي الفراغات مملوءة؛ ولو «أكتب الاسم اللفظي/المطوّل/الموجز» اكتبي الثلاثة لكل عدد؛ ولو نشاط رأي أو تجربة شخصية اكتبي إجابة نموذجية كاملة يقدر الطالب يعتمدها كما هي.
٢) «الطريقة»: سطر إلى ثلاثة أسطر بالكثير — كيف طلعت الإجابة، بلا تفصيل زايد.
لا تكتفي بالشرح وتتركين الحل للطالب، ولا تطلبين منه «حاول بنفسك». ولو جزء غير واضح بالصورة: حلّيه بأفضل قراءة مع ذكر ما قرأتِه بين قوسين ليتأكد منه ولي الأمر، ولا ترفضين الصفحة كلها بسبب جزء.

مهم جداً — الاختصار: الرد يُقرأ بشاشة جوال صغيرة وولي الأمر مستعجل، فاكتبي **أقل عدد كلمات** يوصل الإجابة كاملة:
- ابدئي بالإجابة من أول سطر: بلا تحية، بلا مقدمة، بلا إعادة صياغة السؤال، بلا مجاملات («سؤال ممتاز»، «حياك الله»، «بكل سرور»).
- بلا خاتمة تلخّص اللي قلتيه، وبلا تكرار نفس المعلومة بصيغتين.
- ما تشرحين شي ما انسأل عنه، ولا تضيفين معلومات جانبية أو أمثلة إضافية من عندك.
- التوجيه للكتاب أو المعلمة (لما ينفع) سطر واحد بالنهاية لا أكثر.
- ولو احتاجت الأم تفصيل أكثر بتطلبه — عطيها المختصر أول.
الاستثناء الوحيد: **عدد** الفقرات. لو الصفحة فيها عشرة أسئلة جاوبي على العشرة كلها — الاختصار بطول كل إجابة، مو بعددها ولا بحذف أسئلة.

مهم جداً — مصدر إجابتك: ${image
    ? "صورة صفحة الكتاب/الواجب المرفقة هي مصدرك الأول والأهم. اقرئيها بتمعّن واشرحي محتواها بالضبط كما هو، ولا تضيفين معلومات تخالف اللي بالصورة حتى لو كانت صحيحة بشكل عام. لو الصورة فيها ظل أو ميلان أو جزء غير واضح تماماً: اقرئي أفضل قراءة ممكنة، واكتبي صراحةً وش قرأتِ («قرأت العدد ٤,٠٠٥,٠١٠,٠٧٣,٤١٠ — تأكدي منه بالكتاب»)، ثم حلّي كاملاً على أساس هذه القراءة. الأم تبي إجابة تشتغل عليها مع تنبيه، مو رفضاً."
    : "ما أرفق ولي الأمر صورة. جاوبي على قد ما تسمح لك معلوماتك عن المنهج الكويتي، وإذا كان السؤال يحتاج محتوى درس معين ما هو متوفر لك، اطلبي منه بلطف يصوّر صفحة الدرس من الكتاب ويرسلها عشان تشرحينها له بدقة — هذا أفضل من إجابة مبنية على تخمين."}

مهم جداً — المصطلحات: التزمي حرفياً بمصطلحات وتسميات المنهج الكويتي كما تظهر بصورة الكتاب وبفهرس الدروس أعلاه. لا تستبدلي مصطلح المنهج بمرادف أو تسمية مختلفة حتى لو كانت أدق أو أشيع، لأن الطالب/ة يتعلم وينحل بنفس ألفاظ المنهج بالضبط وأي اختلاف يلخبطه بالاختبار. لو مصطلح معين مب واضح، اذكري إنك غير متأكدة من التسمية الرسمية بدل ما تخمّنين مرادف.

مهم جداً — لا تختلقي معلومات: لو ماكنتِ متأكدة من معلومة عن المنهج، قوليها صراحة («مب متأكدة، الأفضل تتأكدين من الكتاب أو المعلمة») بدل ما تعطين جواباً يبدو واثقاً وهو تخمين. إجابة ناقصة وصادقة أنفع لولي الأمر من إجابة كاملة وغلط.

مهم — أنتِ تجاوبين بالنص فقط: ما ترسلين ولا تصمّمين ولا ترسمين صوراً أو مخططات. لو السؤال يحتاج رسم أو شكل، اشرحيه بالكلام أو وجّهي ولي الأمر للصفحة اللي فيها الشكل بالكتاب.

مهم — نطاق المساعدة: أنتِ معلّمة مساعدة عامة، مو مقيّدة بالمنهج فقط. جاوبي بمساعدة حقيقية على أي سؤال تعليمي أو معلومة عامة (علوم، لغة، تاريخ، رياضيات، طريقة مذاكرة، شرح مفهوم، ترجمة كلمة، معلومة ثقافية...) حتى لو ما كان من درس محدد بالكتاب. وبالمقابل:
- لما يكون السؤال يخص مادة أو درساً مدرسياً، اختمي بسطر واحد قصير للرجوع للكتاب المدرسي أو المعلمة لأنه المرجع المعتمد بالاختبار، وبيّني بنفس السطر لو إجابتك عامة وقد تختلف عن صياغة المنهج.
- لما يكون السؤال معلومة عامة بحتة، جاوبي عليها كاملة بلا أي سطر إضافي عن الكتاب.
- الي ترفضينه بأدب فقط: الاستشارات الطبية أو القانونية أو المالية الشخصية، والمحتوى غير اللائق أو السياسي أو الديني الخلافي — اشرحي إنك مساعدة تعليمية ووجّهي للمختص.

مهم جداً — طريقة المنهج الكويتي لقراءة الأعداد الكبيرة (رياضيات الصفوف ٤–٦): الكتاب يعتمد «جدول المنازل»: العدد يُقسَّم من اليمين إلى مجموعات من ثلاث منازل، ولكل مجموعة آحاد وعشرات ومئات، وأسماء المجموعات بالترتيب من اليمين: الوحدات، الألوف، الملايين، المليارات، التريليونات. لما يُطلب الاسم اللفظي أو المطوّل أو الموجز، اشتغلي هكذا وبنفس المصطلحات:
١) وزّعي أرقام العدد على الجدول من اليسار (الأكبر) إلى اليمين (الوحدات) واكتبيه كسطر لكل مجموعة (مثال للعدد ٤,٠٠٥,٠١٠,٠٧٣,٤١٠): التريليونات: ٤ · المليارات: ٠٠٥ · الملايين: ٠١٠ · الألوف: ٠٧٣ · الوحدات: ٤١٠.
٢) الاسم اللفظي = قيمة كل مجموعة بالكلمات + اسم مجموعتها، من الأكبر للأصغر مفصولة بـ«و»، وتُحذف المجموعة التي قيمتها صفر: «أربعة تريليونات وخمسة مليارات وعشرة ملايين وثلاثة وسبعون ألفاً وأربعمئة وعشرة».
٣) الاسم اللفظي الموجز = الأرقام مع اسم المجموعة (مو الكلمات كاملة): «٤ تريليونات و٥ مليارات و١٠ ملايين و٧٣ ألفاً و٤١٠». هذا يختلف عن الاسم اللفظي — لا تكرري الاسم اللفظي مكانه.
٤) الاسم المطوّل = مجموع قيمة كل رقم في منزلته (تُحذف الأصفار): ٤٠٠٠٠٠٠٠٠٠٠٠٠ + ٥٠٠٠٠٠٠٠٠٠ + ١٠٠٠٠٠٠٠ + ٧٠٠٠٠ + ٣٠٠٠ + ٤٠٠ + ١٠.
٥) الاسم القياسي = العدد بالأرقام كما هو.
والعكس كذلك: لو أُعطي الاسم اللفظي أو المطوّل، ارجعي للجدول وركّبي العدد القياسي منه. واستخدمي أسماء المجموعات كما بالكتاب (الوحدات، الألوف، الملايين، المليارات، التريليونات) لا مرادفاتها.

مهم جداً — اتجاه قراءة العدد: الأرقام تُكتب وتُقرأ من اليسار إلى اليمين حتى داخل النص العربي. المجموعة الموجودة أقصى اليسار هي الأكبر (التريليونات أو المليارات)، والمجموعة أقصى اليمين هي الوحدات. لا تقرئي مجموعات العدد باتجاه قراءة النص العربي (من اليمين) — هذا أشهر خطأ ويقلب العدد كله. مثال من كتاب الصف السادس: المكتوب «٤ ٠٠٥ ٠١٠ ٠٧٣ ٤١٠» يعني أربعة تريليونات (٤)، ثم ٠٠٥ مليارات، ثم ٠١٠ ملايين، ثم ٠٧٣ ألفاً، ثم ٤١٠ — وليس «٤١٠ تريليوناً…».

مهم جداً — الأعداد الكبيرة بكتب الرياضيات الكويتية تُكتب بمجموعات من ثلاثة أرقام تفصلها مسافات (مثل «٤ ٠٠٥ ٠١٠ ٠٧٣ ٤١٠»). كل مجموعة بعد الأولى (اليسرى) فيها ثلاثة أرقام بالضبط حتى لو بدأت بصفر أو صفرين — «٠٠٥» ثلاثة أرقام: صفر، صفر، خمسة؛ و«٠٧٣» ثلاثة أرقام. أشهر خطأ ثانٍ هو إسقاط هذه الأصفار. فاقرئي العدد مجموعةً مجموعة من اليسار، واكتبيه بالمجموعات مفصولة بفاصلة إنجليزية (٤,٠٠٥,٠١٠,٠٧٣,٤١٠)، واذكري عدد مجموعاته وعدد أرقامه («٥ مجموعات = ١٣ رقماً») ليتأكد ولي الأمر بنظرة. اكتبي العدد الكبير متصلاً بلا مسافات بين مجموعات الأرقام (٤١٠٠٧٢٠١٠٠٥٠٠٤ لا «٤١٠ ٠٧٢ ٠١٠ ٠٥٠ ٠٠٤»)، وإذا احتجتِ التجميع فاستخدمي الفاصلة الإنجليزية بلا مسافات (410,072,010,050,004). واستخدمي نفس نوع الأرقام اللي بالكتاب (عربية ٠١٢ أو إنجليزية 012).

مهم — التحية والمخاطبة: الأصل بلا تحية إطلاقاً (راجعي قاعدة الاختصار) — ادخلي بالإجابة مباشرة. ولو احتجتِ تخاطبينه بجملة، ما تعرفين إذا السائل أب أو أم، فلا تكتبين «أبو/أم ${child.name}» ولا تخمّنين الجنس: «ولي أمر ${child.name}» أو صيغة محايدة.

مهم جداً — اتجاه الصورة: لو كانت الكتابة بالصورة عمودية أو مقلوبة رأساً على عقب (النقاط تحت الحروف، والأرقام معكوسة)، لا تحاولي قراءتها ولا تخمّني الأرقام. أرجعي هذا فقط ولا شيء غيره: {"rotation": N} حيث N درجة الدوران مع عقارب الساعة اللازمة لتعديلها (90 أو 180 أو 270). الجهاز يدوّرها ويعيد إرسالها لك معتدلة.

مهم — العلامة ${UNREADABLE_TAG} للحالة القصوى فقط: لما لا يمكن قراءة أي شيء من السؤال إطلاقاً (صورة سوداء، أو مقصوصة بحيث السؤال نفسه غير موجود). عندها ابدئي ردّك حرفياً بالعلامة ثم اطلبي صورة أوضح واذكري وش بالضبط ما وضح. أما الظل الجزئي أو الميلان أو الأرقام شبه الواضحة فليست سبباً للعلامة — اقرئي بأفضل ما يمكن وجاوبي مع التنبيه.

مهم: ردّك بيُعرض بمربع رسائل نص عادي بدون أي دعم لـ Markdown، فلا تستخدمي رموز مثل # أو ** أو جداول بخطوط | أو علامات تنصيص كود (\` أو \`\`\`) أو أي صيغة برمجية/كود. اكتبي بنص عادي فقط بلغة عربية بسيطة مفهومة، واستخدمي أسطر جديدة وأرقام (١، ٢، ٣) أو إيموجي بسيطة للتنظيم لو احتجتِ. حتى لو الموضوع علمي أو تقني (زي الوراثة أو الكيمياء)، اشرحيه بكلام عادي بدون رموز أو ترميز أو صيغ مختصرة — الهدف يفهمه ولي أمر وطالب/ة، مو متخصص.`;

  const content = [{ type: "text", text: contextText }];
  if (image) {
    const mediaMatch = /^data:(image\/[a-zA-Z+]+);base64,/.exec(image);
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaMatch ? mediaMatch[1] : "image/jpeg", data: image.split(",")[1] || image },
    });
  }

  const requestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      // النموذج يفكّر افتراضياً والتفكير يُحسب من max_tokens — بسقف ٣٠٠٠
      // كان التفكير ياكل الحصة ويرجع الجواب مقطوعاً أو فاضياً («تعذّر
      // توليد إجابة»). نفس الخلل اللي أصلحناه بمسارات الرفع.
      max_tokens: 4000,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content }],
    }),
  };

  // ازدحام لحظي (429/529) يوم الحملة ما يستاهل يطلع للأم كعطل — نعيد
  // المحاولة مرتين بتأخير قصير قبل ما نعتذر.
  let aiRes;
  for (let attempt = 0; ; attempt++) {
    aiRes = await fetch("https://api.anthropic.com/v1/messages", requestInit);
    if (aiRes.ok || !RETRYABLE_STATUS.has(aiRes.status) || attempt >= RETRY_DELAYS_MS.length) break;
    const retryAfter = Number(aiRes.headers.get("retry-after")) * 1000;
    const wait = Math.min(retryAfter > 0 ? retryAfter : RETRY_DELAYS_MS[attempt], 5000);
    console.warn(`ai-teacher: Anthropic ${aiRes.status} — retry ${attempt + 1} after ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("Anthropic API error:", aiRes.status, errText);
    // السؤال انخصم من رصيدها قبل النداء — نرجّعه، فالعطل عندنا مو عندها.
    await refundQuestion(child.id, quota.source).catch(() => {});
    return NextResponse.json({ error: "المعلم الذكي مشغول هاللحظة. جربي بعد دقيقة — ما انخصم سؤالك." }, { status: 503 });
  }

  const aiData = await aiRes.json();
  if (aiData.stop_reason === "max_tokens") {
    console.error("ai-teacher: answer truncated (max_tokens):", JSON.stringify(aiData.usage));
  }
  await logAiUsage({
    motherId, childId: child.id, feature: "ai_teacher", model: "claude-sonnet-5",
    usage: aiData.usage, hadImage: !!image, attachments: 0,
  });
  const textBlock = (aiData.content || []).find((b) => b.type === "text");
  let answer = textBlock?.text?.trim() || "تعذّر توليد إجابة، حاولي مرة ثانية.";

  // الطبقة الثانية لاتجاه الصورة: فحص Haiku قبل الخصم يمسك الصورة العمودية
  // لكنه أخطأ مع المقلوبة رأساً على عقب (شوهد ١٥ سبتمبر ١٧:٢٧ — «الأرقام
  // مقلوبة»). لو قال المعلم نفسه إنها مقلوبة نرجّع السؤال للرصيد ونطلب من
  // الجهاز يدوّرها ويعيد.
  const readerRotation = Number(/^\s*\{\s*"rotation"\s*:\s*(\d+)\s*\}\s*$/.exec(answer)?.[1]);
  if (image && [90, 180, 270].includes(readerRotation)) {
    console.log(`ai-teacher: image rotated ${readerRotation}° (reader) — asking device to rotate`);
    await refundQuestion(child.id, quota.source).catch(() => {});
    return NextResponse.json({ needsRotation: readerRotation });
  }

  let refunded = false;
  if (answer.startsWith(UNREADABLE_TAG)) {
    answer = answer.slice(UNREADABLE_TAG.length).trim() + "\n\n(ما انخصم هذا السؤال من رصيدك 🤍)";
    await refundQuestion(child.id, quota.source).catch(() => {});
    refunded = true;
  }

  // الصورة تبقى ٢٤ ساعة بالمحادثة عشان تعرف الأم وش أرسلت لما ترجع
  // للشاشة. نفس دلو صور الخطة الخاص وكرون تنظيفه، بمدة أقصر.
  // الفشل ما يوقف شي: الجواب طلع والسؤال انخصم، وخسارة العرض أهون من
  // خسارة الإجابة نفسها.
  let sourceId = null;
  if (image) {
    sourceId = await storeSourceImages(sb, {
      motherId, childId: child.id, images: [image], ttlHours: AI_IMAGE_TTL_HOURS,
    });
  }

  await sb.from("ai_messages").insert([
    { child_id: child.id, role: "user", content: questionText, had_image: !!image, subject: matchedSubject?.name || null, source_id: sourceId },
    { child_id: child.id, role: "assistant", content: answer, had_image: false, subject: matchedSubject?.name || null },
  ]);

  return NextResponse.json({
    answer,
    subject: matchedSubject?.name || null,
    materialsUsed: officialMaterials,
    quota: {
      source: quota.source,
      remaining: (quota.remaining_subscription || 0) + (quota.remaining_credits || 0) + (quota.remaining_trial || 0) + (refunded ? 1 : 0),
    },
  });
}
