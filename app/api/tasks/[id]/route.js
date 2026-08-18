import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function verifyOwnership(sb, taskId, motherId) {
  const { data } = await sb.from("tasks").select("id, children(mother_id)").eq("id", taskId).single();
  return !!data && data.children?.mother_id === motherId;
}

export async function PATCH(req, { params }) {
  const { dueDate } = await req.json();
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, motherId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("tasks").update({ due_date: dueDate || null }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (!(await verifyOwnership(sb, params.id, req.headers.get("x-mother-id")))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { error } = await sb.from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
