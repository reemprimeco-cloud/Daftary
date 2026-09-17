import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// مسح كل المستلزمات المشتراة دفعة وحدة لطالب/ة معيّن — لما تخلص الأم من
// التسوق ما تحتاج تحذف كل غرض لحاله. غير المُشترى يبقى كما هو.
export async function POST(req) {
  const { childId } = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  if (!motherId || !childId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: child } = await sb.from("children").select("id").eq("id", childId).eq("mother_id", motherId).maybeSingle();
  if (!child) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { error, count } = await sb
    .from("requirements")
    .delete({ count: "exact" })
    .eq("child_id", childId)
    .eq("bought", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, cleared: count || 0 });
}
