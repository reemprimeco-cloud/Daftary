import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr, kuwaitNow } from "@/lib/kuwaitDate";
import { configureWebPush } from "@/lib/pushDelivery";
import { loadFamilyParents, sendMeetingReminders, dateOffset } from "@/lib/reminderBatch";

// ٧ مساءً بتوقيت الكويت (`vercel.json` مكتوب بـUTC: 0 16 * * *).
// اجتماع أولياء الأمور وحده — الأم تحتاج تعرف عنه وهي بالبيت ترتّب يومها
// الجاي، لا بزحمة الصباح مع تذكيرات الواجبات.
export const runtime = "nodejs";
export const maxDuration = 300;

const KIND = "meeting_day_before";

export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  configureWebPush();

  const sb = supabaseAdmin();
  const today = kuwaitTodayStr();
  const parents = await loadFamilyParents(sb);

  const sent = await sendMeetingReminders(sb, parents, {
    date: dateOffset(kuwaitNow(), 1),
    kind: KIND,
    title: "اجتماع أولياء الأمور",
    today,
  });

  return NextResponse.json({ ok: true, sent });
}
