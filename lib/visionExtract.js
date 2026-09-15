import { logAiUsage } from "@/lib/aiUsage";

// الأم تصوّر الجدول بجوالها أو تاخذ لقطة شاشة، وكثير من الجداول المدرسية
// مطبوعة بالعرض — فتوصلنا الصورة مقلوبة ٩٠ درجة. النموذج ما يقدر يقرأ نصاً
// عربياً مقلوباً بعد التصغير، فكان يرجّع جدولاً كامل الشكل لكن أسماء
// معلماته ومواده مخترعة. هذي القاعدة توقف التخمين من أصله: إما يقول
// «الصورة مقلوبة» فندوّرها بالجهاز ونعيد، أو «ما أقدر أقرأ» فنوقف بلا
// ما نمس بيانات الأم.
const GUARD_RULE = `قبل أي شيء، افحصي اتجاه الصور ووضوحها، والتزمي بالتالي حرفياً:

١) إذا كان نص أي صورة غير معتدل (مكتوب بالعرض أو مقلوب رأساً على عقب)، لا تحاولي قراءة محتواها إطلاقاً. أرجعي هذا فقط ولا شيء غيره:
{"rotation": 90}
حيث القيمة هي درجة الدوران مع عقارب الساعة اللازمة لجعل النص معتدلاً (90 أو 180 أو 270).

٢) إذا كان النص معتدلاً لكنه صغير أو مشوّش أو مقصوص لدرجة لا تستطيعين معها قراءته بثقة، أرجعي هذا فقط:
{"unreadable": true}

٣) ممنوع منعاً باتاً اختراع أو تخمين أي اسم معلّم/ـة أو مادة أو رقم. اكتبي فقط ما تقرئينه حرفياً في الصورة. أي حقل غير واضح اتركيه null. الاسم الذي «يشبه» أسماء كويتية معروفة وأنتِ غير متأكدة منه خطأ، وnull أصحّ منه.

`;

const JSON_RE_FENCE = /```json|```/g;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);
const RETRY_DELAYS_MS = [1500, 3000];

// «صار خلل، حاولي مرة ثانية» تخلي الأم تعيد نفس الصورة بالضبط فتفشل مرة
// ثانية. لما يكون السبب جودة الصورة نقولها صريحة، ونعطيها الخطوات اللي
// تغيّر النتيجة فعلاً.
const QUALITY_ERROR = "الصورة مو واضحة كفاية عشان نقرأها — لازم ترفعين صورة بجودة أفضل.";
export const QUALITY_TIPS = [
  "خلّي الجدول كامل داخل الصورة بلا قص من الأطراف",
  "صوّري بإضاءة كافية، وتجنّبي الظل والانعكاس",
  "قرّبي الكاميرا لين تصير الكتابة الصغيرة مقروءة",
  "لو الجدول طويل، صوّريه على جزئين وارفعيهم مع بعض",
];
const quality = (status, error) => ({ ok: false, status, error: error || QUALITY_ERROR, tips: QUALITY_TIPS });

const API_HEADERS = () => ({
  "Content-Type": "application/json",
  "x-api-key": process.env.ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
});
const imageBlock = (img) => ({
  type: "image",
  source: {
    type: "base64",
    media_type: /^data:(image\/[a-z+]+);base64,/i.exec(img)?.[1] || "image/jpeg",
    data: img.split(",")[1] || img,
  },
});

// فحص الاتجاه بنداء مستقل صغير قبل القراءة. القاعدة داخل أمر القراءة
// وحدها ما كانت تكفي: شفنا بالإنتاج (١٥ سبتمبر، ١٥:٤٩) النموذج يستلم
// صورة مقلوبة ويقرأها كأنها معتدلة ويرجّع جدولاً كاملاً غلط — لأن المهمة
// المطلوبة منه «اقرأ» فيقرأ. سؤال منفصل «هل النص معتدل؟» بلا أي مهمة
// قراءة يجاوبه بصدق، وبنموذج صغير كلفته أقل من فلس. نفحص الصورة الأولى
// فقط: صور الرفعة الواحدة تُلتقط بنفس الاتجاه.
export async function detectRotation(image, { motherId, childId }) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: API_HEADERS(),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 30,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `لا تقرئي محتوى الصورة. انظري فقط لاتجاه الكتابة فيها وأجيبي على سؤالين بذهنك: (١) هل السطور أفقية أم عمودية؟ (٢) إذا كانت أفقية، هل الحروف والأرقام معتدلة أم مقلوبة رأساً على عقب (النقاط تحت الحروف بدل فوقها، والسطر الأول من الصفحة يظهر بالأسفل)؟ ثم أرجعي JSON فقط بلا أي كلمة أخرى: {"rotation": N} حيث N هي درجة الدوران مع عقارب الساعة اللازمة لجعل الكتابة معتدلة: 0 إذا كانت معتدلة أصلاً، 180 إذا كانت مقلوبة رأساً على عقب، 90 أو 270 إذا كانت عمودية.`,
            },
            imageBlock(image),
          ],
        }],
      }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    await logAiUsage({ motherId, childId, feature: "orientation_probe", model: "claude-haiku-4-5", usage: data.usage, hadImage: true, attachments: 1 });
    const text = (data.content || []).find((b) => b.type === "text")?.text || "";
    const rotation = Number(text.match(/"rotation"\s*:\s*(\d+)/)?.[1]);
    return [90, 180, 270].includes(rotation) ? rotation : 0;
  } catch (e) {
    // الفحص طبقة إضافية؛ فشله ما يوقف القراءة — القاعدة داخل أمر القراءة
    // تبقى طبقة ثانية.
    console.error("orientation probe failed:", e.message);
    return 0;
  }
}

// كل المسارات كانت تكرّر نفس نداء النموذج ونفس تحليل الرد — والفرق
// بينها الوصف فقط. توحيدها يضمن إن أي حماية نضيفها تسري عليها كلها.
export async function extractFromImages({ images, prompt, motherId, childId, feature }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return { ok: false, status: 500, error: "فيه خلل مؤقت عندنا بخدمة التحليل. جربي بعد شوي." };
  }

  const probed = await detectRotation(images[0], { motherId, childId });
  if (probed) {
    console.log(`${feature}: image rotated ${probed}° (probe) — asking device to rotate`);
    return { ok: false, status: 200, needsRotation: probed };
  }

  const first = await callReader([{ type: "text", text: GUARD_RULE + prompt }, ...images.map(imageBlock)], { images, motherId, childId, feature });
  if (!first.ok) return first;

  // مرور تحقق ثانٍ: نفس الصورة + الناتج، والمطلوب مراجعة كل خلية. رفعتان
  // لنفس الصورة كانتا تعطيان نتيجتين مختلفتين (١٥ سبتمبر ١٨:١١ و١٨:١٣) —
  // القراءة الأولى تخطئ بخلية أو اثنتين، والمراجعة على الصورة تمسكها. لو
  // فشل التحقق لأي سبب نكتفي بالقراءة الأولى.
  const verifyText = `${GUARD_RULE}هذا JSON استُخرج من الصور المرفقة بقراءة أولى:
${JSON.stringify(first.parsed)}

مهمتك مراجعة هذه القراءة على الصور خليةً خلية وإرجاع النسخة المصحَّحة بنفس الشكل بالضبط:
- صحّحي أي قيمة تختلف عمّا هو مكتوب بالصورة (اسم مادة، اسم معلم/ـة، رقم حصة، يوم، وقت، تاريخ، نص).
- أضيفي أي عنصر موجود بالصورة وناقص بالقراءة، واحذفي أي عنصر بالقراءة غير موجود بالصورة.
- لا تغيّري ما هو صحيح، ولا تعيدي صياغة النصوص ولا توحّديها — انقلي حرفياً.
- انتبهي بالذات للخلايا المتجاورة (الحصة قبل وبعد) وللأيام: هل كل عنصر تحت يومه الصحيح؟

التعليمات الأصلية للقراءة كانت:
${prompt}

أرجعي JSON فقط بدون أي شرح.`;
  const verified = await callReader([{ type: "text", text: verifyText }, ...images.map(imageBlock)], { images, motherId, childId, feature: `${feature}_verify` });
  if (verified.ok) {
    if (JSON.stringify(verified.parsed) !== JSON.stringify(first.parsed)) console.log(`${feature}: verification pass corrected the first read`);
    return verified;
  }
  if (verified.needsRotation) return verified;
  console.warn(`${feature}: verification pass failed (${verified.error || verified.status}) — using first read`);
  return first;
}

async function callReader(content, { images, motherId, childId, feature }) {
  const requestInit = {
    method: "POST",
    headers: API_HEADERS(),
    body: JSON.stringify({
      model: "claude-sonnet-5",
      // كانت ٤٠٠٠ — والنموذج يفكّر افتراضياً، فكان التفكير يبتلع الحصة
      // كاملة ويرجع JSON مقطوعاً بنص النص. ظهر بالإنتاج:
      // stop_reason=max_tokens مع thinking_tokens=4000.
      max_tokens: 16000,
      // استخراج جدول من صورة عمل ميكانيكي ما يحتاج تفكيراً ممتداً —
      // إيقافه يمنع قطع الرد ويقصّر زمن الانتظار على الأم كذلك.
      thinking: { type: "disabled" },
      // لا نمرر temperature: هذا النموذج يرفض الطلب بها (400 «deprecated for
      // this model» — شوهد بالإنتاج ١٨:٢٥). ثبات القراءة يجي من مرور
      // التحقق الثاني في extractFromImages.
      messages: [{ role: "user", content }],
    }),
  };

  // دفعة رفع متزامنة (يوم حملة) تصطدم بحد الطلبات بالدقيقة (429) أو
  // بازدحام مؤقت (529/503). الفشل الفوري يخلي الأم تعيد الصورة يدوياً —
  // بينما ثانيتان أو ثلاث تكفي غالباً. نعيد المحاولة مرتين بحد أقصى.
  let aiRes;
  for (let attempt = 0; ; attempt++) {
    aiRes = await fetch("https://api.anthropic.com/v1/messages", requestInit);
    if (aiRes.ok || !RETRYABLE_STATUS.has(aiRes.status) || attempt >= RETRY_DELAYS_MS.length) break;
    const retryAfter = Number(aiRes.headers.get("retry-after")) * 1000;
    const wait = Math.min(retryAfter > 0 ? retryAfter : RETRY_DELAYS_MS[attempt], 5000);
    console.warn(`Anthropic ${aiRes.status} — retry ${attempt + 1} after ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("Anthropic API error:", aiRes.status, errText);
    return { ok: false, status: 500, error: "فيه خلل مؤقت عندنا بخدمة التحليل. جربي بعد شوي." };
  }

  const aiData = await aiRes.json();
  await logAiUsage({
    motherId, childId, feature, model: "claude-sonnet-5",
    usage: aiData.usage, hadImage: true, attachments: images.length,
  });

  if (aiData.stop_reason === "max_tokens") {
    console.error("AI response truncated (max_tokens):", JSON.stringify(aiData.usage));
    return quality(500, "الجدول طويل وما اكتمل تحليله — لازم ترفعين صورة بجودة أفضل أو تقسّمينها.");
  }

  const textBlock = (aiData.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    console.error("No text block in Anthropic response:", JSON.stringify(aiData));
    return { ok: false, status: 500, error: "فيه خلل مؤقت عندنا بخدمة التحليل. جربي بعد شوي." };
  }

  // النموذج أحياناً يسبق الـJSON بجملة تمهيدية أو يغلّفه بـ```json.
  // نقتطع من أول { لآخر } بدل ما نرفض الرد كله بسبب زينة حوله.
  const raw = textBlock.text.replace(JSON_RE_FENCE, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  let parsed;
  try {
    parsed = JSON.parse(start !== -1 && end > start ? raw.slice(start, end + 1) : raw);
  } catch (e) {
    console.error("Failed to parse AI JSON:", e.message, "raw text:", textBlock.text);
    return quality(500);
  }

  const rotation = Number(parsed.rotation);
  if ([90, 180, 270].includes(rotation)) {
    console.log(`${feature}: image rotated ${rotation}° (reader) — asking device to rotate`);
    return { ok: false, status: 200, needsRotation: rotation };
  }

  if (parsed.unreadable === true) {
    return quality(422);
  }

  return { ok: true, parsed };
}
