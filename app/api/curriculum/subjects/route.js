import { NextResponse } from "next/server";
import { moeGradeInfo, fetchMoeSubjects } from "@/lib/moeCurriculum";

export async function GET(req) {
  const grade = Number(req.nextUrl.searchParams.get("grade"));
  const info = moeGradeInfo(grade);
  if (!info) return NextResponse.json({ error: "صف غير معروف" }, { status: 400 });
  const subjects = await fetchMoeSubjects(info.gradeId);
  return NextResponse.json({ subjects });
}
