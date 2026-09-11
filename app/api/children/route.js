import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { redistributePool } from "@/lib/entitlements";
import { hasAppAccess } from "@/lib/appEntitlements";

export async function GET(req) {
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!motherId) return NextResponse.json({ error: "motherId مطلوب" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("children").select("*").eq("mother_id", motherId).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ children: data });
}

export async function POST(req) {
  const body = await req.json();
  const motherId = req.headers.get("x-mother-id");

  // حد الباقة يُفرض هنا مو بالواجهة وحدها: الحارس المركزي (middleware) يسمح
  // بالإضافة ما دام العدد *الحالي* مغطّى، فبدون هالفحص يقدر أحد يضيف بلا
  // حدود بنداء المسار مباشرة — ثم ينحجب بالطلب اللي بعده، وهي تجربة أسوأ
  // من منعه بوضوح من البداية.
  // نفحص كذلك من اشتركت وهي بفترة التجربة (phase === "active"): حدّ باقتها
  // يسري من ساعة ما دفعت، وإلا تضيف بلا حدود قبل الإلزام ثم تنقفل فجأة.
  const access = await hasAppAccess(motherId);
  const max = access.subscription?.max_students;
  if (access.phase === "enforced" || max != null) {
    if ((access.studentsCount || 0) + 1 > (max ?? 0)) {
      return NextResponse.json(
        { error: "باقتك الحالية ما تغطي طالباً/ة إضافياً. رقّي الباقة أولاً.", paywall: true },
        { status: 402 }
      );
    }
  }

  const sb = supabaseAdmin();

  let colorIdx = body.colorIdx;
  if (colorIdx === undefined || colorIdx === null) {
    const { count } = await sb
      .from("children")
      .select("*", { count: "exact", head: true })
      .eq("mother_id", motherId);
    colorIdx = count ?? 0;
  }

  const { data, error } = await sb
    .from("children")
    .insert({
      mother_id: motherId,
      name: body.name,
      photo_url: body.photo || null,
      governorate: body.governorate,
      gender: body.gender,
      school: body.school,
      grade: body.grade,
      section: body.section,
      color_idx: colorIdx,
      pe_uniform_color: body.peUniformColor || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // الرصيد عائلي وينقسم على الأبناء وقت الشراء، فالطالب/ة المضاف بعده يطلع
  // بلا رصيد ما لم نعِد التوزيع. فشل التوزيع ما يبطّل الإضافة نفسها.
  const redistributed = await redistributePool(motherId);
  if (!redistributed.ok) console.error("redistributePool failed:", redistributed.error);

  return NextResponse.json({ child: data });
}
