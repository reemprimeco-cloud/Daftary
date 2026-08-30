import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createTapCharge } from "@/lib/tap";
import { PRODUCTS } from "@/lib/entitlements";

export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  // الدفع بالبطاقة مطفي افتراضياً. المتجران يأخذان ١٥٪ مقابل ~٣٪ لـTap،
  // لكن مسار دفع ثالث يعني قاعدتين نحرسهما بكل تعديل (آبل 3.1.1 وGoogle
  // Play Billing)، وأقصى ربحه ٧٣ فلساً للاشتراك مقابل خسارة قصوى = شطب
  // التطبيق. نشغّله لما تبرّره الأرقام — أو لو احتجنا KNET.
  if (process.env.ENABLE_WEB_PAYMENTS !== "true") {
    return NextResponse.json({ error: "الدفع بالبطاقة غير مفعّل حالياً" }, { status: 404 });
  }

  // الطبقة الثانية من الفصل بين المسارين: التطبيق يعرّف عن نفسه بترويسة،
  // ونرفض الدفع بالبطاقة إذا جاء من داخل أي تطبيق متجر. الأولى بالواجهة (ما
  // نعرض الزر أصلاً)، وهذي تحمينا لو تغيّرت الواجهة يوماً ونسينا القاعدة —
  // بيع محتوى رقمي داخل التطبيق بغير مشتريات المتجر يعرّضه للشطب.
  // الترويسة تُرسَل فقط من داخل التطبيق، فوجودها وحده يكفي للرفض — ما نطابق
  // أسماء منصات، عشان منصة جديدة بكرة ما تعدّي بالغلط.
  if (req.headers.get("x-daftary-platform")) {
    return NextResponse.json({ error: "الاشتراك داخل التطبيق يتم عبر المتجر" }, { status: 403 });
  }

  const { productId, childId } = await req.json().catch(() => ({}));
  const product = PRODUCTS[productId];
  if (!product) return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });
  if (product.kind === "credits" && !childId) {
    return NextResponse.json({ error: "لازم تختار الطالب/ة قبل شراء الرصيد" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: mother } = await sb.from("mothers").select("name,phone").eq("id", motherId).maybeSingle();
  if (!mother) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 400 });

  // الرصيد الإضافي يُضاف لطالب/ة محدد، فنتأكد إنه يخص ولي الأمر نفسه.
  if (childId) {
    const { data: child } = await sb
      .from("children").select("id").eq("id", childId).eq("mother_id", motherId).maybeSingle();
    if (!child) return NextResponse.json({ error: "الطالب/ة المحدد غير موجود" }, { status: 400 });
  }

  const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;

  try {
    const charge = await createTapCharge({
      amount: product.priceKwd,
      description: `دفتري — ${product.label}`,
      motherName: mother.name,
      motherPhone: mother.phone,
      redirectUrl: `${origin}/payment/callback`,
      postUrl: `${origin}/api/payments/webhook`,
      // المبلغ والمنتج يُقرآن من رد Tap وقت الإتمام، مو من هنا — هذي البيانات
      // للربط فقط.
      metadata: { motherId, childId: childId || "", productId },
    });

    const url = charge?.transaction?.url;
    if (!url) throw new Error("لم يصل رابط الدفع من Tap");
    return NextResponse.json({ url, chargeId: charge.id });
  } catch (e) {
    console.error("tap create-session error:", e);
    return NextResponse.json({ error: e.message || "تعذّر بدء عملية الدفع" }, { status: 502 });
  }
}
