import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily } from "@/lib/family";

export async function GET(req) {
  const childId = req.nextUrl.searchParams.get("childId");
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!childId || !motherId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId, "id");
  if (!child) return NextResponse.json({ error: "الطالب/ة غير موجود" }, { status: 400 });

  // غير المحفوظ أولاً (الأحدث أولاً)، والمحفوظ بالأسفل (الأحدث حفظاً أولاً بينهم)
  const { data, error } = await sb
    .from("memorization")
    .select("*")
    .eq("child_id", childId)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}
