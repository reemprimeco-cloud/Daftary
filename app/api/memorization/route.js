import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req) {
  const childId = req.nextUrl.searchParams.get("childId");
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!childId || !motherId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: child } = await sb.from("children").select("id").eq("id", childId).eq("mother_id", motherId).single();
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
