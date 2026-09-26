import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily } from "@/lib/family";

// مسح المنجز بفعل صريح من الأم (طلبها ٢٦ سبتمبر): «الواجبات والاختبارات
// المكتملة — امسحها». قبل هذا ما كان ينمسح المكتمل إلا تلقائياً عند رفع
// خطة جديدة (`cleanupCompletedBeforeThisWeek`) وبشرط قِدَم التاريخ، فكان
// يتراكم بالرئيسية طول الأسبوع.
//
// الحذف **للمكتمل فقط** — غير المنجز ما ينمس مهما قدم، تماماً كقاعدة
// التنظيف التلقائي: أهون خسارة سجل منجز من ضياع مهمة لسه ما خلصتها.
// وهذا فعل صريح من الأم على طالب/ة تعرفه بعينه، فلا يخالف قاعدة «المرفوع
// يبقى كما هو» (اللي تمنع الحذف **التلقائي الصامت**).
export async function POST(req) {
  const { childId } = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  if (!childId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  if (!(await childInFamily(sb, childId, motherId, "id"))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  // نرجّع الصفوف المحذوفة عشان نعرف العدد ونوعه — الأم تشوف بالتأكيد وش
  // انمسح بالضبط قبل ما تضغط، والرد يأكده بعده.
  const { data: tasks, error: tErr } = await sb
    .from("tasks")
    .delete()
    .eq("child_id", childId)
    .eq("status", "done")
    .select("id, type");
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

  // الحفظ المنجز ما له تاريخ استحقاق أصلاً، فينمسح كله كما بالتنظيف التلقائي.
  // فشله ما يلغي حذف المهام اللي نجح — نرجّع العدد الفعلي لكل نوع.
  let memorization = 0;
  const { data: memo, error: mErr } = await sb
    .from("memorization")
    .delete()
    .eq("child_id", childId)
    .eq("done", true)
    .select("id");
  if (mErr) console.warn("clear-done: memorization delete failed:", mErr.message);
  else memorization = memo?.length || 0;

  const rows = tasks || [];
  return NextResponse.json({
    ok: true,
    deleted: {
      tasks: rows.filter((t) => t.type !== "درس").length,
      lessons: rows.filter((t) => t.type === "درس").length,
      memorization,
      total: rows.length + memorization,
    },
  });
}
