"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(() => {
    fetch("/api/admin/broadcast/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.campaigns || []))
      .catch(() => setStats([]));
  }, []);

  useEffect(loadStats, [loadStats]);

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
        `وصل ${data.delivered} جهاز لـ${data.recipients} ولية أمر (تطبيق: ${data.apns}، متصفح: ${data.web}).` +
          (fails.length ? ` تعذّر: ${fails.map(([k, v]) => `${v}×${k}`).join("، ")}` : "")
      );
      loadStats();
    } catch (e) {
      setState("failed");
      setDetail(e.message || "خطأ غير متوقع");
    }
  }

  const input = {
    width: "100%", border: "1px solid #E5E7EB", borderRadius: 10,
    padding: "9px 11px", fontSize: 13.5, marginBottom: 8, fontFamily: "inherit",
  };

  const th = { textAlign: "start", padding: "6px 8px", fontWeight: 700 };
  const td = { padding: "8px", color: "#374151", verticalAlign: "top" };

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

      <div style={{ marginTop: 18, borderTop: "1px solid #F0EEE8", paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: "#5C4B8C" }}>نتائج الإعلانات</h3>
          <button onClick={loadStats} style={{ background: "none", color: "#B7A6E8", fontSize: 12, fontWeight: 700, padding: "4px 6px" }}>
            تحديث
          </button>
        </div>

        {stats === null ? (
          <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: 0 }}>...جاري التحميل</p>
        ) : stats.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: 0 }}>ما فيه إعلانات مرسلة بعد.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: "#9CA3AF", textAlign: "start" }}>
                  <th style={th}>الإعلان</th>
                  <th style={th}>وصل</th>
                  <th style={th}>فتح الإشعار</th>
                  <th style={th}>فتح التطبيق</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #F5F3EF" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: "#374151" }}>{c.title}</div>
                      <div style={{ color: "#9CA3AF", fontSize: 11.5 }}>
                        {new Date(c.sent_at).toLocaleString("ar-KW", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </td>
                    <td style={td}>{c.recipients}</td>
                    <td style={td}>{c.opened}</td>
                    <td style={td}>{c.openedApp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.8 }}>
              «فتح الإشعار» = ضغطت على الإشعار نفسه. «فتح التطبيق» = دخلت البرنامج بعد الإرسال بأي طريقة،
              حتى لو تجاهلت الإشعار. آبل ما تخبرنا إذا شافت الإشعار بلا ما تضغطه — هذا الرقم ما يقدر أحد يقيسه.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
