"use client";

import { useState, useEffect, useCallback } from "react";

export default function Feedback() {
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    fetch("/api/admin/feedback")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: true }));
  }, []);

  useEffect(load, [load]);

  if (!data) return <Card><p style={muted}>...جاري التحميل</p></Card>;
  if (data.error) return <Card><p style={{ ...muted, color: "#B91C1C" }}>تعذّر تحميل التقييمات.</p></Card>;

  const share = data.eligible ? Math.round((data.count / data.eligible) * 100) : 0;
  const peak = Math.max(1, ...data.dist);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "#5C4B8C" }}>تقييمات البرنامج</h2>
        <button onClick={load} style={{ background: "none", color: "#B7A6E8", fontSize: 12, fontWeight: 700, padding: "4px 6px" }}>تحديث</button>
      </div>

      {data.count === 0 ? (
        <p style={muted}>ما وصل أي تقييم بعد. الشريط يظهر لولية الأمر بعد أسبوع من تسجيلها.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <Stat value={data.average ?? "—"} label="المعدّل" />
            <Stat value={data.count} label="تقييم" />
            {/* النسبة من المؤهّلات فقط: من سجّلت أمس ما طُلب منها التقييم */}
            <Stat value={`${share}٪`} label={`شاركن من ${data.eligible}`} />
          </div>

          <div style={{ marginBottom: 16 }}>
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 11.5, color: "#9CA3AF", width: 28 }}>{n} ★</span>
                <div style={{ flex: 1, height: 7, background: "#F0EEE8", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(data.dist[n - 1] / peak) * 100}%`, background: "#B7A6E8" }} />
                </div>
                <span style={{ fontSize: 11.5, color: "#9CA3AF", width: 22, textAlign: "end" }}>{data.dist[n - 1]}</span>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: "#9CA3AF" }}>
                  <th style={th}>التقييم</th>
                  <th style={th}>الملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #F5F3EF" }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <div style={{ color: "#EFA518", letterSpacing: 1 }}>{"★".repeat(r.rating)}<span style={{ color: "#E0DCD4" }}>{"★".repeat(5 - r.rating)}</span></div>
                      <div style={{ color: "#9CA3AF", fontSize: 11 }}>
                        {r.name} · {new Date(r.created_at).toLocaleDateString("ar-KW", { day: "numeric", month: "long" })}
                      </div>
                    </td>
                    <td style={{ ...td, color: r.note ? "#374151" : "#C7C2D4", lineHeight: 1.8 }}>{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ flex: 1, background: "#FAF7F2", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#5C4B8C", lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{label}</div>
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

const th = { textAlign: "start", padding: "6px 8px", fontWeight: 700, fontSize: 11.5 };
const td = { padding: "9px 8px", verticalAlign: "top" };
const muted = { margin: 0, fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.8 };
