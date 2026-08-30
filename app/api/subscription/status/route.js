import { NextResponse } from "next/server";
import { getEntitlement, getEntitlementsForMother } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase";

// بدون childId نرجّع استحقاقات كل الأبناء — الاشتراك لكل طالب/ة، فالواجهة
// تحتاج تعرض المتبقي لكل واحد منهم مو رقماً واحداً لولي الأمر.
export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  if (!motherId) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const childId = new URL(req.url).searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ children: await getEntitlementsForMother(motherId) });
  }

  const { data: child } = await supabaseAdmin()
    .from("children")
    .select("id,name")
    .eq("id", childId)
    .eq("mother_id", motherId)
    .maybeSingle();
  if (!child) return NextResponse.json({ error: "الطالب/ة المحدد غير موجود" }, { status: 400 });

  const entitlement = await getEntitlement(child.id);
  return NextResponse.json({ childId: child.id, childName: child.name, ...entitlement });
}
