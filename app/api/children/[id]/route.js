import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req, { params }) {
  const body = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("children")
    .update({
      name: body.name,
      photo_url: body.photo || null,
      governorate: body.governorate,
      gender: body.gender,
      school: body.school,
      grade: body.grade,
      section: body.section,
      color_idx: body.colorIdx,
    })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ child: data });
}

export async function DELETE(req, { params }) {
  const sb = supabaseAdmin();
  const { error } = await sb.from("children").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
