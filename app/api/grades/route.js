import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTerm } from "@/lib/moeCurriculum";

export async function GET(req) {
  const childId = req.nextUrl.searchParams.get("childId");
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!childId || !motherId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: child } = await sb.from("children").select("id").eq("id", childId).eq("mother_id", motherId).single();
  if (!child) return NextResponse.json({ error: "الطالب/ة غير موجود" }, { status: 400 });

  const { data, error } = await sb
    .from("exam_grades")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ grades: data });
}

export async function POST(req) {
  const body = await req.json();
  const { childId, subject, score, maxScore, examName } = body;
  const motherId = req.headers.get("x-mother-id");
  if (!motherId || !childId || !subject?.trim() || score == null || !maxScore) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  const scoreNum = Number(score);
  const maxNum = Number(maxScore);
  if (!Number.isFinite(scoreNum) || !Number.isFinite(maxNum) || scoreNum < 0 || maxNum <= 0) {
    return NextResponse.json({ error: "درجة غير صالحة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: child } = await sb.from("children").select("id").eq("id", childId).eq("mother_id", motherId).single();
  if (!child) return NextResponse.json({ error: "الطالب/ة غير موجود" }, { status: 400 });

  const { data, error } = await sb
    .from("exam_grades")
    .insert({
      child_id: childId,
      subject: subject.trim(),
      score: scoreNum,
      max_score: maxNum,
      term: kuwaitTerm(),
      exam_name: examName?.trim() || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ grade: data });
}
