import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { redistributePool } from "@/lib/entitlements";

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

  let colorIdx = body.colorIdx;
  if (colorIdx === undefined || colorIdx === null) {
    const { count } = await sb
      .from("children")
      .select("*", { count: "exact", head: true })
      .eq("mother_id", req.headers.get("x-mother-id"));
    colorIdx = count ?? 0;
  }

  const { data, error } = await sb
    .from("children")
    .insert({
      mother_id: req.headers.get("x-mother-id"),
      name: body.name,
      photo_url: body.photo || null,
      governorate: body.governorate,
      gender: body.gender,
      school: body.school,
      grade: body.grade,
      section: body.section,
      color_idx: colorIdx,
      pe_uniform_color: body.peUniformColor || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // الرصيد عائلي وينقسم على الأبناء وقت الشراء، فالطالب/ة المضاف بعده يطلع
  // بلا رصيد ما لم نعِد التوزيع. فشل التوزيع ما يبطّل الإضافة نفسها.
  const redistributed = await redistributePool(req.headers.get("x-mother-id"));
  if (!redistributed.ok) console.error("redistributePool failed:", redistributed.error);

  return NextResponse.json({ child: data });
}
