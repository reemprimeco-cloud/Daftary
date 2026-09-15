"use client";

import { useEffect, useState } from "react";

// الصفحة كانت ١١ كتلة ورا بعض بلا ترتيب — أدوات الاختبار بالنص وحالة
// الاشتراك مدفونة تحت. صارت تبويبات، كل تبويب هدف واحد، والتبويب المختار
// يُحفظ بالجهاز عشان لما تفتحين الصفحة يوم الحملة ترجعين لنفس المكان.
const STORAGE_KEY = "daftary_admin_tab";

export default function AdminTabs({ tabs, panels }) {
  const [active, setActive] = useState(tabs[0].key);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && tabs.some((t) => t.key === saved)) setActive(saved);
    } catch {}
  }, [tabs]);

  function pick(key) {
    setActive(key);
    try { localStorage.setItem(STORAGE_KEY, key); } catch {}
  }

  return (
    <div>
      <div
        role="tablist"
        style={{
          position: "sticky", top: 64, zIndex: 9, background: "#FAF7F2",
          display: "flex", gap: 6, overflowX: "auto", padding: "6px 0 12px", marginBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => pick(t.key)}
              style={{
                flexShrink: 0, borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 800,
                background: on ? "#5C4B8C" : "white", color: on ? "white" : "#5C4B8C",
                border: on ? "1px solid #5C4B8C" : "1px solid #E9E5F5",
                boxShadow: on ? "none" : "0 1px 2px rgba(0,0,0,.04)",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t.label}
              {t.badge != null && (
                <span style={{ background: on ? "rgba(255,255,255,.22)" : "#F1EFFA", color: on ? "white" : "#5C4B8C", borderRadius: 999, padding: "1px 7px", fontSize: 11 }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={t.key !== active}>
          {panels[t.key]}
        </div>
      ))}
    </div>
  );
}
