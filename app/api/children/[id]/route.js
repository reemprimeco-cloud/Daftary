import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function verifyOwnership(sb, childId, motherId) {
  const { data } = await sb.from("children").select("mother_id").eq("id", childId).single();
  return !!data && data.mother_id === motherId;
}

export async function PATCH(req, { params }) {
  const body = await req.json();
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, body.motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

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
      pe_uniform_color: body.peUniformColor || null,
    })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ child: data });
}

export async function DELETE(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, body.motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("children").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
