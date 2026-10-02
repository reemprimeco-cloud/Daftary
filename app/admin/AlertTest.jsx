"use client";

import { useState } from "react";

// تجربة تنبيه الأعطال. التنبيه الحقيقي ما ينطلق إلا وقت عطل فعلي، فبدون
// هذا الزر ما نكتشف إنه غير مضبوط إلا يوم ما نحتاجه فعلاً.
export default function AlertTest() {
  const [state, setState] = useState("idle");
  const [detail, setDetail] = useState("");

  async function send() {
    setState("sending");
    setDetail("");
    try {
      const res = await fetch("/api/admin/alert-test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");
      setState("ok");
      setDetail("انطلق التنبيه ✅ — لازم يوصل موبايلك خلال ثوانٍ. إذا ما وصل، تأكدي إن إشعارات دفتري مسموحة بإعدادات موبايلك.");
    } catch (e) {
      setState("failed");
      setDetail(e.message);
    }
  }

  return (
    <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#5C4B8C" }}>تنبيه الأعطال</h2>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.8 }}>
        لو تعطّل إرسال رمز التحقق (رصيد Twilio خلص، أو الحساب موقوف)، يوصلك إشعار على موبايلك فوراً بدل ما
        تكتشفينها من شكوى مستخدمة. تنبيه واحد كل ساعة مهما تكرر الفشل.
      </p>

      <button
        onClick={send}
        disabled={state === "sending"}
        style={{
          background: state === "sending" ? "#C7C2D4" : "#5C4B8C", color: "white",
          borderRadius: 12, padding: "10px 18px", fontSize: 13.5, fontWeight: 700,
        }}
      >
        {state === "sending" ? "جاري الإرسال..." : "أرسلي تنبيهاً تجريبياً"}
      </button>

      {detail && (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.8, color: state === "ok" ? "#2F6E56" : "#B91C1C" }}>
          {detail}
        </p>
      )}
    </div>
  );
}
