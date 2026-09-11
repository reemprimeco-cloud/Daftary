"use client";

import { useState } from "react";

const PRESET = {
  title: "تجربة مجانية لمدة ٧ أيام",
  body: "استمتعي بتجربة دفتري مجاناً لمدة ٧ أيام، وبعدها اشتراك سنوي بسيط حسب عدد أبنائك.",
};

// إشعار عام لكل المستخدمين. الإرسال لا رجعة فيه، فنطلب تأكيداً أولاً
// ونعرض عدد من وصلهم بعده — عشان ما يُرسل نفس الإعلان مرتين بالغلط.
export default function Broadcast() {
  const [title, setTitle] = useState(PRESET.title);
  const [body, setBody] = useState(PRESET.body);
  const [state, setState] = useState("idle");
  const [detail, setDetail] = useState("");

  async function send() {
    if (!confirm(`سيُرسل هذا الإشعار لكل المستخدمين المسجَّلين.\n\n«${title}»\n${body}\n\nمتأكدة؟`)) return;
    setState("sending");
    setDetail("");
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");

      setState("ok");
      const fails = Object.entries(data.failures || {});
      setDetail(
        `وصل ${data.delivered} (تطبيق: ${data.apns}، متصفح: ${data.web}).` +
          (fails.length ? ` تعذّر: ${fails.map(([k, v]) => `${v}×${k}`).join("، ")}` : "")
      );
    } catch (e) {
      setState("failed");
      setDetail(e.message || "خطأ غير متوقع");
    }
  }

  const input = {
    width: "100%", border: "1px solid #E5E7EB", borderRadius: 10,
    padding: "9px 11px", fontSize: 13.5, marginBottom: 8, fontFamily: "inherit",
  };

  return (
    <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#5C4B8C" }}>إشعار لكل المستخدمين</h2>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.8 }}>
        يوصل لأجهزة التطبيق والمتصفحات معاً. النص المكتوب جاهز للإعلان عن التجربة المجانية قبل بدء الرسوم.
      </p>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" style={input} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="النص" style={{ ...input, resize: "vertical" }} />

      <button
        onClick={send}
        disabled={state === "sending"}
        style={{
          background: state === "sending" ? "#C7C2D4" : "#5C4B8C", color: "white",
          borderRadius: 12, padding: "10px 18px", fontSize: 13.5, fontWeight: 700,
        }}
      >
        {state === "sending" ? "جاري الإرسال..." : "إرسال للجميع"}
      </button>

      {detail && (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.8, color: state === "ok" ? "#2F6E56" : "#B91C1C" }}>
          {detail}
        </p>
      )}
    </div>
  );
}
