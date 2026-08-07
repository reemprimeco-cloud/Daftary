import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req) {
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!motherId) return NextResponse.json({ error: "motherId مطلوب" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: mother, error } = await sb.from("mothers").select("*").eq("id", motherId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const link = botUsername ? `https://t.me/${botUsername}?start=${mother.telegram_link_code}` : null;
  return NextResponse.json({ link, linked: !!mother.telegram_chat_id });
}
