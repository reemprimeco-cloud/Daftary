"use client";

import { useState, useEffect, useCallback } from "react";

// متابعة حركة التسجيل ساعة بساعة أثناء الحملات الإعلانية.
export default function Signups() {
  const [data, setData] = useState(null);
  const [auto, setAuto] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/signups")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: true }));
  }, []);

  useEffect(load, [load]);

  // تحديث تلقائي أثناء الحملة — بلا هذا تلزمها تضغط «تحديث» كل شوي وهي
  // تتابع. مطفي افتراضياً عشان ما يستهلك بلا داعي.
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [auto, load]);

  if (!data) return <Card><p style={muted}>...جاري التحميل</p></Card>;
  if (data.error) return <Card><p style={{ ...muted, color: "#B91C1C" }}>تعذّر تحميل الأرقام.</p></Card>;

  const peak = Math.max(1, ...data.hours.map((h) => h.count));

  // توقف التدفق هو المؤشر المهم: أخضر إذا فيه تسجيل قريب، وأحمر إذا مرّت
  // ساعة كاملة بلا ولا تسجيل واحد.
  const m = data.minutesSinceLast;
  const silence = m == null ? { text: "ما فيه تسجيل بآخر ٢٤ ساعة", color: "#9CA3AF", bg: "#F3F4F6" }
    : m < 60 ? { text: `آخر تسجيل قبل ${m} دقيقة`, color: "#166534", bg: "#F0FDF4" }
    : { text: `آخر تسجيل قبل ${Math.round(m / 60)} ساعة`, color: "#B91C1C", bg: "#FEF2F2" };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "#5C4B8C" }}>حركة التسجيل</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ accentColor: "#B7A6E8" }} />
            تحديث كل دقيقة
          </label>
          <button onClick={load} style={{ background: "none", color: "#B7A6E8", fontSize: 12, fontWeight: 700, padding: "4px 6px" }}>تحديث</button>
        </div>
      </div>

      <div style={{ background: silence.bg, color: silence.color, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
        {silence.text}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Stat label="آخر ساعة" value={data.lastHour} />
        <Stat label="آخر ٢٤ ساعة" value={data.last24} />
        <Stat label="آخر ٧ أيام" value={data.week} />
        <Stat label="الإجمالي" value={data.total} />
      </div>

      {/* رسم بسيط بالأعمدة — بلا أي مكتبة، عشان ما نحمّل الصفحة بلا داعي */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90, borderBottom: "1px solid #F0EEE8", paddingBottom: 2 }}>
        {data.hours.map((h, i) => (
          <div key={i} title={`${h.label}: ${h.count}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
            <div
              style={{
                height: `${(h.count / peak) * 100}%`,
                minHeight: h.count ? 3 : 0,
                background: i === data.hours.length - 1 ? "#5C4B8C" : "#B7A6E8",
                borderRadius: "3px 3px 0 0",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>
        <span>قبل ٢٤ ساعة</span>
        <span>الحين</span>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.8 }}>
        الأعمدة تعرض الحسابات الجديدة بكل ساعة بتوقيت الكويت. أثناء الحملة، توقف التدفق فجأة أسرع علامة
        على عطل بالتسجيل — أسرع من أي شكوى توصلك.
      </p>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ flex: "1 1 90px", background: "#FAF7F2", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#5C4B8C" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{label}</div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      {children}
    </div>
  );
}

const muted = { margin: 0, fontSize: 12.5, color: "#9CA3AF" };
