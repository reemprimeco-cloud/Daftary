import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
  const sb = supabaseAdmin();

  const { count } = await sb
    .from("children")
    .select("*", { count: "exact", head: true })
    .eq("mother_id", body.motherId);

  const { data, error } = await sb
    .from("children")
    .insert({
      mother_id: body.motherId,
      name: body.name,
      photo_url: body.photo || null,
      governorate: body.governorate,
      gender: body.gender,
      school: body.school,
      grade: body.grade,
      section: body.section,
      color_idx: count ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ child: data });
}
