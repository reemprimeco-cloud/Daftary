import { supabaseAdmin } from "./supabase";
import { sendApns, apnsConfigured } from "./apns";
import { normalizeKuwaitPhone } from "./otp";

// تنبيه تشغيلي للمشرفة على جوالها.
//
// الخلفية: توقف Twilio عطّل التسجيل ١١ ساعة ونصف — ١٣٠ محاولة فاشلة و٢٦
// مستخدمة — واكتُشف صدفةً وهو يُفحص لسبب ثاني. الأعطال اللي تصيب الجميع
// لازم توصل صاحبة التطبيق فوراً، مو تنتظر شكوى.
//
// نرسل عبر APNs مو رسالة نصية: عطل Twilio نفسه من أكثر ما نبي ننبّه عنه،
// وتنبيهٌ يمر بالقناة المعطّلة ما يوصل أبداً.
//
// الرقم من متغيّر البيئة ADMIN_ALERT_PHONE. بدونه ما نرسل شي إطلاقاً —
// ما نخمّن صاحبة الحساب ولا نحط رقماً بالكود.
export async function alertAdmin(kind, title, body, { cooldownMinutes = 60, detail = null } = {}) {
  try {
    const phone = normalizeKuwaitPhone(process.env.ADMIN_ALERT_PHONE || "");
    if (!phone || !apnsConfigured()) return { ok: false, reason: "not configured" };

    const sb = supabaseAdmin();

    // حدّ التكرار: العطل الواحد يفشل مئات المرات بالساعة. ننبّه مرة كل
    // فترة تهدئة بدل ما نغرق جوالها بإشعارات نفس الشي.
    const { data: last } = await sb.from("ops_alerts").select("last_sent_at").eq("kind", kind).maybeSingle();
    if (last?.last_sent_at) {
      const minsAgo = (Date.now() - new Date(last.last_sent_at).getTime()) / 60000;
      if (minsAgo < cooldownMinutes) return { ok: false, reason: "cooldown" };
    }

    const { data: admin } = await sb.from("mothers").select("id").eq("phone", phone).maybeSingle();
    if (!admin) return { ok: false, reason: "admin account not found" };

    const { data: devices } = await sb
      .from("device_tokens").select("token, environment").eq("mother_id", admin.id).eq("platform", "ios");
    if (!devices?.length) return { ok: false, reason: "no device" };

    // نسجّل الإرسال قبل تنفيذه: لو انهار المسار بالنص، الأسوأ إننا نفوّت
    // تنبيهاً — أهون من أن يعلق بحلقة ترسل مئات الإشعارات.
    await sb.from("ops_alerts").upsert(
      { kind, last_sent_at: new Date().toISOString(), last_detail: detail },
      { onConflict: "kind" }
    );

    const results = await sendApns(devices.map((d) => ({ token: d.token, environment: d.environment, title, body })));
    return { ok: results.some((r) => r.ok) };
  } catch (e) {
    // التنبيه مساعد، ما يعطّل المسار اللي ناداه مهما صار فيه.
    console.error("alertAdmin failed:", e?.message);
    return { ok: false, reason: "error" };
  }
}
