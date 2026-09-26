import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { rowInFamily } from "@/lib/family";
import { deleteAttachment } from "@/lib/attachments";

export async function DELETE(req, { params }) {
  const sb = supabaseAdmin();
  if (!(await rowInFamily(sb, "plan_attachments", params.id, req.headers.get("x-mother-id")))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { data: row } = await sb.from("plan_attachments").select("id, paths").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ ok: true });

  try {
    await deleteAttachment(sb, row);
  } catch (e) {
    console.error("attachment delete failed:", e.message);
    return NextResponse.json({ error: "تعذّر الحذف، حاولي مرة ثانية." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
