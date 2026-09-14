"use client";

import { useState, useEffect, useCallback } from "react";

// أسماء عربية للأخطاء التقنية — الاسم البرمجي ما يفيد وقت القرار.
const FEATURE_AR = {
  image_picker: "فتح الصور",
  "upload-class-schedule": "رفع جدول الحصص",
  "upload-schedule": "رفع الواجبات",
  ai_teacher: "المعلم الذكي",
};
const REASON_AR = {
  denied: "إذن الصور مرفوض",
  unavailable: "تطبيق قديم — الإضافة ناقصة",
  error: "خلل غير متوقع",
  analyze_failed: "فشل التحليل",
};

export default function Errors() {
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    fetch("/api/admin/errors")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: true }));
  }, []);

  useEffect(load, [load]);

  if (!data) return <Card><p style={muted}>...جاري التحميل</p></Card>;
  if (data.error) return <Card><p style={{ ...muted, color: "#B91C1C" }}>تعذّر تحميل البلاغات.</p></Card>;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "#5C4B8C" }}>بلاغات الأخطاء</h2>
        <button onClick={load} style={{ background: "none", color: "#B7A6E8", fontSize: 12, fontWeight: 700, padding: "4px 6px" }}>تحديث</button>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9CA3AF", lineHeight: 1.8 }}>
        آخر ٧ أيام. يُسجَّل تلقائياً بلا ما تضغط الأم شي — حتى الأخطاء اللي ما توصل السيرفر.
        ويوصلك إشعار لو واجهن نفس المشكلة ٣ أمهات بساعة.
      </p>

      {data.groups.length === 0 ? (
        <p style={{ ...muted, background: "#F0FDF4", color: "#166534", borderRadius: 10, padding: "10px 12px", fontWeight: 700 }}>
          ما فيه أي بلاغ ✓
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.groups.map((g, i) => (
            <div key={i} style={{ border: "1px solid #F0EEE8", borderRadius: 12, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "#374151" }}>
                  {FEATURE_AR[g.feature] || g.feature}
                </span>
                {/* العدد المهم هو كم أمّاً تأثرت، مو كم بلاغاً — أم وحدة
                    تحاول عشر مرات تصنع عشرة بلاغات لمشكلة واحدة. */}
                <span style={{ background: g.affected >= 3 ? "#FEF2F2" : "#FDF3E7", color: g.affected >= 3 ? "#B91C1C" : "#8C6027", fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>
                  {g.affected} {g.affected === 1 ? "أم" : "أمهات"} · {g.count} مرة
                </span>
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#6B7280" }}>
                {REASON_AR[g.reason] || g.reason || "—"}
              </p>
              {g.names.length > 0 && (
                <p style={{ margin: "5px 0 0", fontSize: 11.5, color: "#9CA3AF" }}>{g.names.join("، ")}</p>
              )}
              {g.notes.map((n, j) => (
                <p key={j} style={{ margin: "6px 0 0", fontSize: 12, color: "#374151", background: "#FAF7F2", borderRadius: 8, padding: "7px 9px", lineHeight: 1.7 }}>“{n}”</p>
              ))}
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#C7C2D4" }}>
                آخر مرة: {new Date(g.last).toLocaleString("ar-KW", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Card({ children }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      {children}
    </div>
  );
}

const muted = { margin: 0, fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.8 };
