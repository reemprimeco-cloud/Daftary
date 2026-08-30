"use client";

import { useEffect, useState } from "react";
import { installAuthFetch } from "@/lib/authFetch";

// صفحة العودة من Tap. ننادي مسار الحالة اللي يستعلم من Tap بمفتاحنا السري
// ويمنح الرصيد — ما نعتمد على أي شي بالرابط، لأن ولي الأمر يقدر يعدّله.
export default function PaymentCallbackPage() {
  const [state, setState] = useState("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    installAuthFetch();
    const chargeId = new URLSearchParams(window.location.search).get("tap_id");
    if (!chargeId) {
      setState("failed");
      setError("ما وصلنا معرّف العملية.");
      return;
    }
    fetch(`/api/payments/status?chargeId=${encodeURIComponent(chargeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setState("done");
        else {
          setState("failed");
          setError(data.error || "لم تكتمل عملية الدفع.");
        }
      })
      .catch(() => {
        setState("failed");
        setError("تعذّر التحقق من حالة الدفع.");
      });
  }, []);

  const copy = {
    checking: { icon: "⏳", title: "نتحقق من الدفع...", body: "لحظات من فضلك." },
    done: { icon: "✅", title: "تم تفعيل اشتراكك", body: "رصيد الأسئلة مقسّم بين أبنائك بالتساوي. استمتعوا!" },
    failed: { icon: "⚠️", title: "لم تكتمل العملية", body: error },
  }[state];

  return (
    <div dir="rtl" className="app-scroll" style={{ background: "#FAF7F2", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <main style={{ maxWidth: 380, width: "100%", background: "white", borderRadius: 20, padding: "34px 26px", boxShadow: "0 1px 3px rgba(0,0,0,.06)", textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>{copy.icon}</div>
        <h1 style={{ color: "#5C4B8C", fontSize: 21, fontWeight: 800, margin: "0 0 8px" }}>{copy.title}</h1>
        <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.8, margin: "0 0 22px" }}>{copy.body}</p>
        {state !== "checking" && (
          <a href="/" style={{ display: "inline-block", padding: "12px 30px", borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 700, textDecoration: "none", fontSize: 14.5 }}>
            رجوع لدفتري
          </a>
        )}
      </main>
    </div>
  );
}
