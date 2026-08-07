import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req, { params }) {
  const { dueDate } = await req.json();
  const sb = supabaseAdmin();
  const { error } = await sb.from("tasks").update({ due_date: dueDate || null }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const sb = supabaseAdmin();
  const { error } = await sb.from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
