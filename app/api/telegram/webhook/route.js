import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req) {
  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const sb = supabaseAdmin();

  if (text.startsWith("/start")) {
    const code = text.split(" ")[1];
    if (code) {
      const { data: mother } = await sb.from("mothers").select("*").eq("telegram_link_code", code).maybeSingle();
      if (mother) {
        await sb.from("mothers").update({ telegram_chat_id: chatId }).eq("id", mother.id);
        await sendTelegram(chatId, `أهلاً ${mother.name} 👋\nتم ربط حسابك بنجاح. راح توصلك هنا تذكيرات الواجبات والاختبارات.`);
        return NextResponse.json({ ok: true });
      }
    }
    await sendTelegram(chatId, "مرحباً 👋\nافتحي رابط الربط من داخل تطبيق دفتري عشان نوصل هذا الحساب بحسابك.");
  }

  return NextResponse.json({ ok: true });
}
