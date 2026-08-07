import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomBytes } from "crypto";

export async function POST(req) {
  const { name, phone } = await req.json();
  if (!name || !phone) {
    return NextResponse.json({ error: "الاسم والجوال مطلوبين" }, { status: 400 });
  }
  const sb = supabaseAdmin();

  const { data: existing } = await sb.from("mothers").select("*").eq("phone", phone).maybeSingle();
  if (existing) return NextResponse.json({ mother: existing });

  const linkCode = randomBytes(4).toString("hex");
  const { data, error } = await sb
    .from("mothers")
    .insert({ name, phone, telegram_link_code: linkCode })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ mother: data });
}
