"use client";

import { useState } from "react";

// زر يطلب من آبل إرسال إشعار تجريبي لمسار الإشعارات، ثم يسأل آبل نفسها
// عن نتيجة التسليم. النتيجة من آبل مو من سجلاتنا: هي اللي تعرف إن كان
// خادمنا ردّ بنجاح أو لا.
export default function AppleNotificationTest() {
  const [state, setState] = useState("idle");
  const [detail, setDetail] = useState("");

  async function run() {
    setState("sending");
    setDetail("");
    try {
      const res = await fetch("/api/admin/apple-test-notification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الطلب");

      setState("waiting");
      setDetail(`أُرسل الطلب لبيئة ${data.environment === "sandbox" ? "الاختبار" : "الإنتاج"}، ننتظر النتيجة...`);

      // آبل تحتاج لحظات لتسليم الإشعار وتسجيل النتيجة
      await new Promise((r) => setTimeout(r, 5000));

      const statusRes = await fetch(`/api/admin/apple-test-notification?token=${encodeURIComponent(data.token)}`);
      const status = await statusRes.json();
      if (!statusRes.ok) throw new Error(status.error || "تعذّرت قراءة النتيجة");

      if (status.delivered) {
        setState("ok");
        setDetail("وصل الإشعار لخادمنا وقُبل ✅ — الربط شغّال.");
      } else if (!status.attempts?.length) {
        setState("failed");
        setDetail("آبل ما حاولت التسليم بعد. أعيدي المحاولة بعد دقيقة.");
      } else {
        setState("failed");
        setDetail(`فشل التسليم: ${status.attempts.map((a) => a.result).join("، ")}`);
      }
    } catch (e) {
      setState("failed");
      setDetail(e.message || "خطأ غير متوقع");
    }
  }

  const busy = state === "sending" || state === "waiting";
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#5C4B8C" }}>ربط إشعارات آبل</h2>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.8 }}>
        إشعارات آبل هي اللي تخبرنا بالتجديد السنوي والاسترجاع وإلغاء الاشتراك. بدونها يبقى وصول
        المشترك عندنا كما هو مهما تغيّر عند آبل.
      </p>
      <button
        onClick={run}
        disabled={busy}
        style={{
          background: busy ? "#C7C2D4" : "#5C4B8C", color: "white", borderRadius: 12,
          padding: "10px 18px", fontSize: 13.5, fontWeight: 700,
        }}
      >
        {busy ? "..." : "أرسلي إشعاراً تجريبياً"}
      </button>
      {detail && (
        <p style={{
          margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.8,
          color: state === "ok" ? "#2F6E56" : state === "failed" ? "#B91C1C" : "#8C6027",
        }}>
          {detail}
        </p>
      )}
    </div>
  );
}
