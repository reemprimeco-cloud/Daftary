import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req) {
  const { name, phone } = await req.json();
  if (!name || !phone) {
    return NextResponse.json({ error: "الاسم والجوال مطلوبين" }, { status: 400 });
  }
  const sb = supabaseAdmin();

  const { data: existing } = await sb.from("mothers").select("*").eq("phone", phone).maybeSingle();
  if (existing) return NextResponse.json({ mother: existing });

  const { data, error } = await sb.from("mothers").insert({ name, phone }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ mother: data });
}
