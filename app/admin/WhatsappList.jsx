"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// التواصل اليدوي بالواتساب (طلبها ١ أكتوبر): «ارسل لهم عن طريق الواتسب
// العادي يدويا».
//
// الإشعار يوصل ٥١ من ٢٢١ بس، والباقي ما عنده قناة غير رقمه. وما عندنا
// إيميلات أصلاً (ما فيه عمود إيميل بـ`mothers`، والمتاجر ما تعطينا
// إيميلات المشترين).
//
// الصفحة تفتح واتساب برسالة **مكتوبة جاهزة** (wa.me?text=) فما تعيد
// صاحبة التطبيق كتابتها ٢٢١ مرة، وتعلّم منو أرسلت له. العلامة بالجهاز
// (localStorage) لا بالخادم: الإرسال نفسه يدوي خارج البرنامج، فما نقدر
// نتحقق منه — وتسجيله بالقاعدة يعني رقماً يدّعي يقيناً ما عندنا.
const SENT_KEY = "daftary_wa_sent";
const MSG_KEY = "daftary_wa_msg";

const DEFAULT_MSG = `هلا ولله 💜

أنا ريم من تطبيق دفتري. ارفعي صورة الخطة الأسبوعية وجدول الحصص، والتطبيق يرتّب الواجبات والاختبارات ويذكّرك بمواعيدها.

جربيه مجاناً: daftary.reemora.app`;

// واتساب يحظر الرقم اللي يرسل لعشرات من ما راسلوه قبل — حتى يدوياً.
const DAILY_SAFE = 20;

export default function WhatsappList() {
  const [contacts, setContacts] = useState(null);
  const [msg, setMsg] = useState(DEFAULT_MSG);
  const [sent, setSent] = useState({});
  const [filter, setFilter] = useState("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SENT_KEY);
      if (s) setSent(JSON.parse(s));
      const m = localStorage.getItem(MSG_KEY);
      if (m) setMsg(m);
    } catch {}
    setLoaded(true);
  }, []);

  const load = useCallback(() => {
    fetch("/api/admin/contacts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts || []))
      .catch(() => setContacts([]));
  }, []);
  useEffect(load, [load]);

  function saveMsg(v) {
    setMsg(v);
    try { localStorage.setItem(MSG_KEY, v); } catch {}
  }

  function mark(wa, on) {
    setSent((prev) => {
      const next = { ...prev };
      if (on) next[wa] = new Date().toISOString().slice(0, 10);
      else delete next[wa];
      try { localStorage.setItem(SENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const sentToday = useMemo(() => Object.values(sent).filter((d) => d === today).length, [sent, today]);

  const shown = useMemo(() => {
    const all = contacts || [];
    if (filter === "subscribers") return all.filter((c) => c.subscriber);
    if (filter === "nopush") return all.filter((c) => !c.push);
    if (filter === "kids") return all.filter((c) => c.kids > 0);
    if (filter === "left") return all.filter((c) => !sent[c.wa]);
    return all;
  }, [contacts, filter, sent]);

  const FILTERS = [
    { key: "all", label: "الكل" },
    { key: "left", label: "ما أرسلت لهم" },
    { key: "subscribers", label: "المشتركات" },
    { key: "nopush", label: "ما يوصلها إشعار" },
    { key: "kids", label: "عندها طلاب" },
  ];

  const totalSent = Object.keys(sent).length;
  const total = (contacts || []).length;

  // **١٦px إلزامي** لكل حقل إدخال — وإلا كبّر الآيفون الصفحة تلقائياً.
  const card = { background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

  return (
    <div style={card}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#5C4B8C" }}>تواصل بالواتساب</h2>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.8 }}>
        اضغطي الاسم ← يفتح واتساب والرسالة مكتوبة جاهزة، وأنتِ تضغطين إرسال.
      </p>

      <div style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 10, padding: "10px 12px", fontSize: 12, lineHeight: 1.85, marginBottom: 12 }}>
        <strong>لا ترسلين أكثر من ~{DAILY_SAFE} رسالة باليوم.</strong> واتساب يحظر الرقم اللي يرسل
        لعشرات ما راسلوه قبل، ولو انحظر رقمك تخسرين قناة التواصل كلها. وزّعيها على أيام
        وابدأي بالمشتركات.
      </div>

      <label style={{ display: "block", fontSize: 12.5, color: "#6B7280", marginBottom: 6 }}>نص الرسالة</label>
      <textarea
        value={msg}
        onChange={(e) => saveMsg(e.target.value)}
        rows={6}
        style={{
          width: "100%", boxSizing: "border-box", border: "1px solid #E5E7EB", borderRadius: 10,
          padding: "11px 12px", fontSize: 16, fontFamily: "inherit", color: "#1F2937",
          background: "white", resize: "vertical", marginBottom: 12, lineHeight: 1.8,
        }}
      />

      <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              background: filter === f.key ? "#B7A6E8" : "#F3F4F6",
              color: filter === f.key ? "white" : "#6B7280",
              borderRadius: 999, padding: "6px 13px", fontSize: 12, fontWeight: 700,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#6B7280", marginBottom: 10 }}>
        <span>
          أرسلتِ <strong style={{ color: "#5C4B8C" }}>{totalSent}</strong> من {total}
          {sentToday > 0 && (
            <span style={{ color: sentToday >= DAILY_SAFE ? "#B91C1C" : "#6B7280" }}>
              {" "}· اليوم {sentToday}{sentToday >= DAILY_SAFE ? " — كفاية اليوم" : ""}
            </span>
          )}
        </span>
        <button onClick={load} style={{ background: "none", color: "#B7A6E8", fontSize: 12, fontWeight: 700, padding: "4px 6px" }}>
          تحديث
        </button>
      </div>

      {contacts === null || !loaded ? (
        <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: 0 }}>...جاري التحميل</p>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: 0 }}>ما فيه أحد بهذا الفلتر.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {shown.map((c) => {
            const done = !!sent[c.wa];
            return (
              <div
                key={c.wa}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                  borderRadius: 10, background: done ? "#F3F4F6" : "#FBFAF8",
                  border: "1px solid #F0EEE8", opacity: done ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => mark(c.wa, e.target.checked)}
                  aria-label={`أرسلت لـ${c.name}`}
                  style={{ accentColor: "#B7A6E8", flexShrink: 0, width: 18, height: 18 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.name || "بلا اسم"}
                    {c.subscriber && <Tag bg="#EBF7F1" fg="#2F6E56">مشتركة</Tag>}
                    {!c.push && <Tag bg="#FDF3E7" fg="#8C6027">بلا إشعار</Tag>}
                    {c.test && <Tag bg="#F3F4F6" fg="#9CA3AF">اختبار</Tag>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#9CA3AF", direction: "ltr", textAlign: "right" }}>
                    {c.phone} · {c.kids} طالب{c.lastSeen ? ` · آخر دخول ${c.lastSeen}` : " · ما دخلت"}
                  </div>
                </div>
                <a
                  href={`https://wa.me/${c.wa}?text=${encodeURIComponent(msg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => mark(c.wa, true)}
                  style={{
                    flexShrink: 0, background: "#25D366", color: "white", borderRadius: 10,
                    padding: "8px 13px", fontSize: 12.5, fontWeight: 800, textDecoration: "none",
                  }}
                >
                  واتساب
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tag({ children, bg, fg }) {
  return (
    <span style={{ background: bg, color: fg, borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 700, marginInlineStart: 6 }}>
      {children}
    </span>
  );
}
