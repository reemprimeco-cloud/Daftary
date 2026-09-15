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

// كل المسارات كانت تكرّر نفس نداء النموذج ونفس تحليل الرد — والفرق
// بينها الوصف فقط. توحيدها يضمن إن أي حماية نضيفها تسري عليها كلها.
export async function extractFromImages({ images, prompt, motherId, childId, feature }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return { ok: false, status: 500, error: "مفتاح الذكاء الاصطناعي غير مُعدّ بالسيرفر" };
  }

  const content = [
    { type: "text", text: GUARD_RULE + prompt },
    ...images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: img.split(",")[1] || img },
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
      // كانت ٤٠٠٠ — والنموذج يفكّر افتراضياً، فكان التفكير يبتلع الحصة
      // كاملة ويرجع JSON مقطوعاً بنص النص. ظهر بالإنتاج:
      // stop_reason=max_tokens مع thinking_tokens=4000.
      max_tokens: 16000,
      // استخراج جدول من صورة عمل ميكانيكي ما يحتاج تفكيراً ممتداً —
      // إيقافه يمنع قطع الرد ويقصّر زمن الانتظار على الأم كذلك.
      thinking: { type: "disabled" },
      messages: [{ role: "user", content }],
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("Anthropic API error:", aiRes.status, errText);
    return { ok: false, status: 500, error: `فشل استدعاء التحليل (${aiRes.status})` };
  }

  const aiData = await aiRes.json();
  await logAiUsage({
    motherId, childId, feature, model: "claude-sonnet-5",
    usage: aiData.usage, hadImage: true, attachments: images.length,
  });

  if (aiData.stop_reason === "max_tokens") {
    console.error("AI response truncated (max_tokens):", JSON.stringify(aiData.usage));
    return { ok: false, status: 500, error: "الجدول طويل وما اكتمل تحليله. جربي صورة أوضح أو قصّيها على جزئين." };
  }

  const textBlock = (aiData.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    console.error("No text block in Anthropic response:", JSON.stringify(aiData));
    return { ok: false, status: 500, error: "لم يصل رد نصي من التحليل" };
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
    return { ok: false, status: 500, error: "ما قدرنا نقرأ الجدول من الصورة. تأكدي إنها واضحة وكاملة وجربي مرة ثانية." };
  }

  const rotation = Number(parsed.rotation);
  if ([90, 180, 270].includes(rotation)) {
    return { ok: false, status: 200, needsRotation: rotation };
  }

  if (parsed.unreadable === true) {
    return {
      ok: false,
      status: 422,
      error: "الصورة مو واضحة كفاية عشان نقراها بثقة. صوّريها بإضاءة أحسن وقرّبي الكاميرا، وخلي الجدول يملى الصورة.",
    };
  }

  return { ok: true, parsed };
}
