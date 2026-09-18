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

  const { data, error } = await sb
    .from("ai_messages")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ messages: data });
}
