"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGES = {
  checking: { icon: "⏳", title: "جاري التحقق من الدفع...", color: "#6B7280" },
  captured: { icon: "✅", title: "تم الدفع بنجاح! دفتري جاهز الحين", color: "#2F6E56" },
  pending: { icon: "⏳", title: "الدفع قيد المعالجة، حدّثي الصفحة بعد شوي", color: "#8C6027" },
  failed: { icon: "❌", title: "تعذّرت عملية الدفع، حاولي مرة ثانية", color: "#8C4E62" },
};

export default function PaymentCallback() {
  return (
    <Suspense>
      <PaymentCallbackInner />
    </Suspense>
  );
}

function PaymentCallbackInner() {
  const params = useSearchParams();
  const [state, setState] = useState("checking");

  useEffect(() => {
    const tapId = params.get("tap_id") || params.get("id");
    if (!tapId) {
      setState("failed");
      return;
    }
    fetch(`/api/payments/status?tapId=${tapId}`)
      .then((r) => r.json())
      .then((d) => setState(d.status === "captured" ? "captured" : d.status === "failed" ? "failed" : "pending"))
      .catch(() => setState("failed"));
  }, []);

  const m = MESSAGES[state];

  return (
    <div dir="rtl" style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
      <span style={{ fontSize: 48 }}>{m.icon}</span>
      <p style={{ fontWeight: 800, fontSize: 17, color: m.color, margin: 0 }}>{m.title}</p>
      <a href="/" style={{ marginTop: 10, background: "#B7A6E8", color: "white", fontWeight: 700, padding: "12px 28px", borderRadius: 12, textDecoration: "none" }}>
        الرجوع لدفتري
      </a>
    </div>
  );
}
