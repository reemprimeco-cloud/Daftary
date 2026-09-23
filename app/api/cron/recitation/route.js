import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitTodayStr } from "@/lib/kuwaitDate";
import { configureWebPush } from "@/lib/pushDelivery";
import { loadFamilyParents, sendRecitationFor } from "@/lib/reminderBatch";

// تذكير «تسميع اليوم» الساعة ٦ صباحاً بتوقيت الكويت (قرار صاحبة التطبيق
// ٢٣ سبتمبر). كان يطلع مع بقية التذكيرات الساعة ٨ — متأخر على تسميع أول
// حصة، فانفصل بكرونه الخاص (`0 3 * * *` بـUTC = ٦ الصبح بالكويت).
// بقية تذكيرات التسميع باقية مكانها: «غداً» بكرون الصباح، والحفظ اللي بلا
// موعد بتذكير السبت والثلاثاء.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  configureWebPush();

  const sb = supabaseAdmin();
  const parents = await loadFamilyParents(sb);
  const today = kuwaitTodayStr();

  const sent = await sendRecitationFor(sb, parents, {
    date: today,
    kind: "recitation_today",
    title: "تسميع اليوم",
    phrase: "اليوم موعد تسميع",
    today,
  });

  return NextResponse.json({ ok: true, sent });
}
