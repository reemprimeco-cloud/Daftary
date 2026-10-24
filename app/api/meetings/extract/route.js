import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily } from "@/lib/family";
import { extractFromImages, QUALITY_TIPS } from "@/lib/visionExtract";
import { kuwaitTodayStr } from "@/lib/kuwaitDate";

export const runtime = "nodejs";
export const maxDuration = 120;

const FEATURE = "meeting_extract";

// يقرأ موعد اجتماع أولياء الأمور من صورة (رسالة المدرسة، إعلان، تقويم)
// **ولا يحفظ شيئاً**: يرجّع القراءة للأم تراجعها وتضغط حفظ. موعد يُكتب
// بصمت من تخمين النموذج أسوأ من لا موعد — بينبني عليه تذكير، والأم
// تعتمد عليه وما تراجع المدرسة.
export async function POST(req) {
  const { childId, images } = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  if (!motherId || !childId || !images?.length) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId);
  if (!child) return NextResponse.json({ error: "الطالب/ة المحدد غير موجود" }, { status: 400 });

  const today = kuwaitTodayStr();
  const prompt = `أمامك ${images.length} صورة من مدرسة كويتية فيها إعلان أو رسالة عن **موعد اجتماع أولياء الأمور** (قد يُسمى: اجتماع أولياء الأمور، لقاء أولياء الأمور، مجلس الآباء، يوم مفتوح، استلام النتائج، لقاء المعلمات).

اليوم هو ${today} (بالتقويم الميلادي). استخرجي **موعداً واحداً** فقط — الأقرب الذي لم يمضِ بعد.

القواعد:
- **التاريخ**: اكتبيه بصيغة YYYY-MM-DD ميلادي. إذا كان مكتوباً بالهجري حوّليه. إذا كُتب اسم اليوم بلا تاريخ (مثل "الأربعاء القادم") احسبيه من تاريخ اليوم. إذا السنة غير مكتوبة استنتجيها من الشهر وتاريخ اليوم.
- **الوقت**: انقليه **كما هو مكتوب بالصورة حرفياً** بلا توحيد ولا تحويل — "٥:٣٠ م" تبقى "٥:٣٠ م"، و"من ٤ إلى ٦" تبقى كما هي. إذا ما فيه وقت مكتوب اتركيه null.
- **لا تخمّني**. إذا التاريخ غير واضح أو غير مكتوب أصلاً، أرجعي date: null — ولا تخترعي تاريخاً من عندك.
- **إذا الصورة ما فيها أي موعد اجتماع أولياء أمور** (مثلاً جدول حصص أو خطة أسبوعية)، أرجعي {"notFound": true}.
- **sourceText**: انقلي الجملة أو السطر الذي أخذتِ منه الموعد، حرفياً كما ظهر بالصورة.
- **note**: المكان أو أي تفصيل إضافي مكتوب (قاعة، مبنى، "لأمهات الصف الرابع") — كما كُتب، أو null.

أرجعي JSON فقط بلا أي شرح أو Markdown:
{"date":"2026-11-05","time":"٥:٣٠ م أو null","note":"نص أو null","sourceText":"السطر كما بالصورة","confidence":"confirmed أو unclear"}`;

  const res = await extractFromImages({ images, prompt, motherId, childId, feature: FEATURE });
  if (!res.ok) {
    if (res.needsRotation) return NextResponse.json({ needsRotation: res.needsRotation });
    return NextResponse.json({ error: res.error, tips: res.tips }, { status: res.status });
  }

  const p = res.parsed || {};
  if (p.notFound || !p.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))) {
    return NextResponse.json(
      { error: "ما لقينا موعد اجتماع واضح بالصورة. تقدرين تكتبين الموعد بنفسك.", tips: QUALITY_TIPS },
      { status: 422 }
    );
  }

  // القراءة تُعرض للأم ولا تُحفظ — الحفظ بضغطتها على «حفظ».
  return NextResponse.json({
    date: p.date,
    time: p.time || null,
    note: p.note || null,
    sourceText: p.sourceText || null,
    unclear: p.confidence === "unclear",
  });
}
