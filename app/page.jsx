"use client";

import { useState, useEffect, useRef } from "react";

const PALETTE = [
  { bg: "#FDEFF3", ring: "#E8A0B4", solid: "#E39CB2", soft: "#F9D9E2", text: "#8C4E62" },
  { bg: "#EBF7F1", ring: "#7FCFB0", solid: "#68C29E", soft: "#D2EFE3", text: "#2F6E56" },
  { bg: "#FDF3E7", ring: "#F0BE84", solid: "#EBAE68", soft: "#FAE3C4", text: "#8C6027" },
  { bg: "#F1EFFA", ring: "#B7A6E8", solid: "#A692E0", soft: "#DFD8F5", text: "#5C4B8C" },
  { bg: "#FDF0EB", ring: "#F0AE91", solid: "#EA9976", soft: "#FADACB", text: "#8C5636" },
  { bg: "#F0F5EA", ring: "#ABCB8F", solid: "#96BE75", soft: "#DFEBCE", text: "#516F35" },
  { bg: "#F7F0F8", ring: "#CCA3D8", solid: "#BF8ACD", soft: "#EDD8F0", text: "#71427C" },
  { bg: "#EBF4FA", ring: "#93C6E2", solid: "#79B7DA", soft: "#D2E9F4", text: "#31607C" },
];
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const FULL_DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const TYPE_META = {
  "واجب": { icon: "📝", done: "تم" },
  "حفظ": { icon: "📖", done: "تم الحفظ" },
  "اختبار": { icon: "📚", done: "تم المذاكرة" },
  "مشروع": { icon: "🎨", done: "تم" },
};
const TABS = [
  { key: "dashboard", label: "الرئيسية", icon: "🏠" },
  { key: "requirements", label: "المتطلبات", icon: "🎒" },
  { key: "schedule", label: "جدول الحصص", icon: "🗓️" },
  { key: "progress", label: "الحفظ والدرجات", icon: "📖" },
  { key: "teacher", label: "المعلم الذكي", icon: "🎓" },
];
const SUBJECT_ICON_MAP = [
  { file: "islamic", keywords: ["اسلام", "قرآن", "تجويد", "فقه", "حديث"] },
  { file: "arabic", keywords: ["عربي"] },
  { file: "english", keywords: ["انجليزي", "english"] },
  { file: "math", keywords: ["رياضيات"] },
  { file: "science", keywords: ["علوم", "فيزياء", "كيمياء", "أحياء"] },
  { file: "social", keywords: ["اجتماعيات", "وطني", "جغرافيا", "تاريخ"] },
  { file: "pe", keywords: ["رياضة", "بدنية", "بدني"] },
  { file: "art", keywords: ["فنية", "رسم"] },
  { file: "music", keywords: ["موسيقى", "نشيد"] },
  { file: "computer", keywords: ["حاسوب", "حاسب", "كمبيوتر", "تقنية"] },
];
const PE_COLORS = [
  { value: "#3B82F6", label: "أزرق" },
  { value: "#EF4444", label: "أحمر" },
  { value: "#EAB308", label: "أصفر" },
  { value: "#22C55E", label: "أخضر" },
  { value: "#FFFFFF", label: "أبيض" },
  { value: "#F97316", label: "برتقالي" },
  { value: "#A855F7", label: "بنفسجي" },
];
const stageForGrade = (g) => (g <= 5 ? "ابتدائي" : g <= 9 ? "متوسط" : "ثانوي");
const studentWord = (gender) => (gender === "بنات" ? "الطالبة" : "الطالب");

function normalizeAr(s) {
  return (s || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}

function getSubjectIconFile(subject) {
  const s = normalizeAr(subject);
  for (const entry of SUBJECT_ICON_MAP) {
    if (entry.keywords.some((k) => s.includes(normalizeAr(k)))) return entry.file;
  }
  return null;
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" });
}

async function resizeToDataUrl(file, maxSize = 900, square = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        if (square) {
          canvas.width = maxSize; canvas.height = maxSize;
          const ctx = canvas.getContext("2d");
          const min = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, maxSize, maxSize);
        } else {
          let { width, height } = img;
          if (width > height && width > maxSize) { height = height*maxSize/width; width = maxSize; }
          else if (height > maxSize) { width = width*maxSize/height; height = maxSize; }
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Avatar({ child, size = 52 }) {
  const pal = PALETTE[child.color_idx % PALETTE.length];
  if (child.photo_url) {
    return <img src={child.photo_url} alt={child.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `3px solid ${pal.ring}` }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: pal.soft, border: `3px solid ${pal.ring}`, color: pal.text, fontWeight: 700, fontSize: size*0.38 }}>
      {child.name?.[0] || "؟"}
    </div>
  );
}

function SubjectIcon({ subject, size = 28 }) {
  const file = getSubjectIconFile(subject);
  if (file) {
    return <img src={`/icons/${file}.png`} alt={subject} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#E5E7EB", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 800, flexShrink: 0 }}>
      {subject?.trim()?.[0] || "؟"}
    </div>
  );
}

export default function Home() {
  const [mother, setMother] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState(null);
  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [undatedTasks, setUndatedTasks] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [classSchedule, setClassSchedule] = useState([]);
  const [view, setView] = useState("dashboard");
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showUploadSchedule, setShowUploadSchedule] = useState(false);
  const [openTask, setOpenTask] = useState(null);
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [payment, setPayment] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch("/schools.json").then((r) => r.json()).then(setSchools);
    const saved = typeof window !== "undefined" ? localStorage.getItem("daftary_mother") : null;
    if (saved) {
      const m = JSON.parse(saved);
      setMother(m);
      loadAll(m.id);
    }
    setLoading(false);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function loadAll(motherId) {
    const res = await fetch(`/api/dashboard?motherId=${motherId}`);
    const data = await res.json();
    setChildren(data.children || []);
    setTasks(data.tasks || []);
    setUndatedTasks(data.undatedTasks || []);
    setUpcomingTasks(data.upcomingTasks || []);
    setRequirements(data.requirements || []);
    setClassSchedule(data.classSchedule || []);
    const tRes = await fetch(`/api/telegram/link?motherId=${motherId}`);
    const tData = await tRes.json();
    setTelegramLink(tData.link);
    setTelegramLinked(tData.linked);
    await fetchPayment(motherId);
  }

  async function fetchPayment(motherId) {
    const res = await fetch(`/api/payments/status?motherId=${motherId}`);
    const data = await res.json();
    if (!data.error) setPayment(data);
  }

  async function handlePay() {
    setPaying(true);
    try {
      const res = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motherId: mother.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "تعذّر بدء عملية الدفع، حاولي مرة ثانية.");
        setPaying(false);
      }
    } catch (e) {
      alert("تعذّر بدء عملية الدفع، حاولي مرة ثانية.");
      setPaying(false);
    }
  }

  function handleLogout() {
    if (!confirm("تسجيل الخروج من دفتري؟")) return;
    localStorage.removeItem("daftary_mother");
    setMother(null);
    setChildren([]);
    setTasks([]);
    setUndatedTasks([]);
    setUpcomingTasks([]);
    setRequirements([]);
    setClassSchedule([]);
    setTelegramLink(null);
    setTelegramLinked(false);
    setView("dashboard");
  }

  async function handleRegister(name, phone) {
    const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone }) });
    const data = await res.json();
    if (data.mother) {
      setMother(data.mother);
      localStorage.setItem("daftary_mother", JSON.stringify(data.mother));
      loadAll(data.mother.id);
    }
  }

  async function handleAddChild(child) {
    const res = await fetch("/api/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...child, motherId: mother.id }) });
    const data = await res.json();
    if (data.child) {
      setChildren((prev) => [...prev, data.child]);
      setShowAddChild(false);
      fetchPayment(mother.id);
    } else {
      alert(data.error || "تعذّرت إضافة الطالب/ة، حاولي مرة ثانية.");
    }
  }

  async function handleUpdateChild(id, child) {
    const res = await fetch(`/api/children/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...child, motherId: mother.id }) });
    const data = await res.json();
    if (data.child) {
      setChildren((prev) => prev.map((c) => (c.id === id ? data.child : c)));
      setEditingChild(null);
    } else {
      alert(data.error || "تعذّر حفظ التعديلات، حاولي مرة ثانية.");
    }
  }

  async function handleDeleteChild(id) {
    if (!confirm("حذف هذا الطالب/ـة نهائياً؟ راح تنحذف كل واجباته ومتطلباته معه.")) return;
    const res = await fetch(`/api/children/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر حذف الطالب/ة، حاولي مرة ثانية."); return; }
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => prev.filter((t) => t.child_id !== id));
    setUndatedTasks((prev) => prev.filter((t) => t.child_id !== id));
    setUpcomingTasks((prev) => prev.filter((t) => t.child_id !== id));
    setRequirements((prev) => prev.filter((r) => r.child_id !== id));
    setClassSchedule((prev) => prev.filter((s) => s.child_id !== id));
    setEditingChild(null);
    fetchPayment(mother.id);
  }

  async function handleMarkDone(taskId) {
    const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر تحديث الواجب، حاولي مرة ثانية."); return; }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUndatedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUpcomingTasks((prev) => prev.filter((t) => t.id !== taskId));
    setOpenTask(null);
  }

  async function handleDeleteTask(taskId) {
    if (!confirm("حذف هذا الواجب نهائياً؟")) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر حذف الواجب، حاولي مرة ثانية."); return; }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUndatedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUpcomingTasks((prev) => prev.filter((t) => t.id !== taskId));
    setOpenTask(null);
  }

  async function handleUpdateTaskDate(taskId, dueDate) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDate, motherId: mother.id }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "تعذّر حفظ التاريخ");
    }
    setOpenTask(null);
    await loadAll(mother.id);
  }

  async function handleToggleReq(id) {
    const res = await fetch(`/api/requirements/${id}/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر تحديث الطلب، حاولي مرة ثانية."); return; }
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, bought: !r.bought } : r)));
  }

  async function handleDeleteReq(id) {
    if (!confirm("حذف هذا الطلب؟")) return;
    const res = await fetch(`/api/requirements/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر حذف الطلب، حاولي مرة ثانية."); return; }
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading || (mother && !schools) || (mother && payment === null)) {
    return (
      <>
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#9CA3AF" }}>...جاري التحميل</div>
        <InstallPrompt />
      </>
    );
  }

  if (!mother) {
    return (
      <>
        <Onboarding onDone={handleRegister} />
        <InstallPrompt />
      </>
    );
  }

  if (payment && !payment.active) {
    return (
      <>
        <PaywallScreen mother={mother} children={children} payment={payment} paying={paying} onPay={handlePay} onLogout={handleLogout} />
        <InstallPrompt />
      </>
    );
  }

  const weekTasksFor = (childId) => tasks.filter((t) => t.child_id === childId);
  const undatedTasksFor = (childId) => undatedTasks.filter((t) => t.child_id === childId);
  const upcomingTasksFor = (childId) => upcomingTasks.filter((t) => t.child_id === childId);
  const todayDayName = DAYS[new Date().getDay()];
  const hasPEToday = (childId) => classSchedule.some((s) => s.child_id === childId && s.day === todayDayName && getSubjectIconFile(s.subject) === "pe");

  return (
    <div dir="rtl" className="app-root" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, zIndex: 10, background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", padding: "calc(env(safe-area-inset-top) + 10px) 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EEE8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>مرحباً {mother.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{new Date().toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowUpload(true)} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 14, padding: "10px 16px", borderRadius: 12, minHeight: 40 }}>
            رفع جدول
          </button>
          <button onClick={handleLogout} title="تسجيل خروج" style={{ background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 12, padding: "10px 12px", borderRadius: 12, minHeight: 40 }}>
            خروج
          </button>
        </div>
      </div>

      {!telegramLinked && (
        <div style={{ flexShrink: 0, padding: "10px 16px 0" }}>
          <a href={telegramLink || "#"} target="_blank" rel="noreferrer" style={{ display: "block", padding: 14, borderRadius: 14, background: "#F1EFFA", color: "#5C4B8C", fontSize: 13, fontWeight: 700, textAlign: "center", textDecoration: "none" }}>
            فعّلي تذكيرات تيليجرام الآن ⬅️
          </a>
        </div>
      )}
      <PushPrompt motherId={mother.id} />

      <div className="app-scroll" style={{ flex: 1 }}>
        {view === "dashboard" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>واجبات هذا الأسبوع</span>
                  <button onClick={() => setShowAddChild(true)} style={{ background: "none", color: "#B7A6E8", fontWeight: 700, fontSize: 13, padding: "8px 4px", minHeight: 36 }}>+ إضافة طالب/ة</button>
                </div>
                {children.map((c) => (
                  <ChildCard key={c.id} child={c} tasks={weekTasksFor(c.id)} undatedTasks={undatedTasksFor(c.id)} upcomingTasks={upcomingTasksFor(c.id)} hasPEToday={hasPEToday(c.id)} onOpenTask={setOpenTask} onEdit={() => setEditingChild(c)} />
                ))}
              </>
            )}
          </div>
        ) : view === "requirements" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              children.map((c) => (
                <RequirementsCard key={c.id} child={c} items={requirements.filter((r) => r.child_id === c.id)} onToggle={handleToggleReq} onEdit={() => setEditingChild(c)} onDeleteReq={handleDeleteReq} />
              ))
            )}
          </div>
        ) : view === "schedule" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>جدول الحصص الأسبوعي</span>
                  <button onClick={() => setShowUploadSchedule(true)} style={{ background: "none", color: "#B7A6E8", fontWeight: 700, fontSize: 13, padding: "8px 4px", minHeight: 36 }}>+ رفع/تحديث الجدول</button>
                </div>
                {children.map((c) => (
                  <ScheduleCard key={c.id} child={c} schedule={classSchedule.filter((s) => s.child_id === c.id)} onUpload={() => setShowUploadSchedule(true)} />
                ))}
              </>
            )}
          </div>
        ) : view === "progress" ? (
          <div style={{ padding: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <ProgressView children={children} motherId={mother.id} onDataCleared={() => loadAll(mother.id)} />
            )}
          </div>
        ) : (
          children.length === 0 ? (
            <div style={{ padding: 16 }}><EmptyState onAdd={() => setShowAddChild(true)} /></div>
          ) : (
            <TeacherView children={children} motherId={mother.id} />
          )
        )}
        <div style={{ height: 8 }} />
      </div>

      <div style={{ flexShrink: 0, zIndex: 10, background: "rgba(255,255,255,.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid #F0EEE8", display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setView(t.key)} style={{ flex: 1, padding: "8px 0 6px", background: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: view === t.key ? "#B7A6E8" : "#9CA3AF", fontWeight: 700, fontSize: 11, minHeight: 52 }}>
            <span style={{ fontSize: 21, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {showAddChild && <AddChildModal schools={schools} nextColorIdx={children.length} onClose={() => setShowAddChild(false)} onSave={handleAddChild} />}
      {editingChild && (
        <AddChildModal
          schools={schools}
          nextColorIdx={editingChild.color_idx}
          child={editingChild}
          onClose={() => setEditingChild(null)}
          onSave={(data) => handleUpdateChild(editingChild.id, data)}
          onDelete={() => handleDeleteChild(editingChild.id)}
        />
      )}
      {showUpload && (
        <UploadView
          children={children}
          motherId={mother.id}
          hint="ارفعي الخطط الأسبوعية، جدول الاختبارات ومتطلبات العام الدراسي هنا"
          onClose={() => setShowUpload(false)}
          onDone={() => loadAll(mother.id)}
        />
      )}
      {showUploadSchedule && (
        <UploadView
          children={children}
          motherId={mother.id}
          endpoint="/api/upload-class-schedule"
          title="رفع جدول الحصص"
          buttonLabel="تحليل وتصميم الجدول"
          hint="ارفعي صورة جدول الحصص الأسبوعي (جدول المواد اليومي) هنا"
          renderSummary={(s) => (
            <div style={{ background: "#F0FDF4", color: "#166534", borderRadius: 12, padding: 12, fontSize: 13 }}>
              تم تحليل {s.imagesProcessed} صورة ✓ — تصميم جدول الحصص ({s.matchedPeriods} حصة).
            </div>
          )}
          onClose={() => setShowUploadSchedule(false)}
          onDone={() => loadAll(mother.id)}
        />
      )}
      {openTask && <TaskModal task={openTask} motherId={mother.id} color={PALETTE[(children.find((c) => c.id === openTask.child_id)?.color_idx || 0) % PALETTE.length]} onClose={() => setOpenTask(null)} onMarkDone={handleMarkDone} onDelete={handleDeleteTask} onUpdateDate={handleUpdateTaskDate} />}
      <InstallPrompt />
    </div>
  );
}

// مفتاح VAPID العام مو سر (لازم يكون معروف للمتصفح) — نثبّته هنا مباشرة بدل الاعتماد
// على متغير بيئة بـ Vercel، لأن نسخه ولصقه هناك سبب تلف متكرر (محارف غير مرئية
// انلصقت بالقيمة). المفتاح الخاص يبقى سر بمتغيرات البيئة بالسيرفر فقط.
const VAPID_PUBLIC_KEY = "BJy0YY9i1499cdXWvcK84tItXQ4bZ3vzoi6YvwldfQwHBDta1LWut5vqebBKuIFlNCie4FLYZcuTukqI9p1APNY";

function urlBase64ToUint8Array(base64String) {
  // ننظّف أي محارف مو من أبجدية base64url — مسافات، أسطر جديدة، أو محارف
  // اتجاه غير مرئية (زي ‏RLM) ممكن تنلصق بالقيمة عند نسخها من مكان لثاني.
  const cleaned = (base64String || "").trim().replace(/[^A-Za-z0-9\-_]/g, "");
  const padding = "=".repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function PushPrompt({ motherId }) {
  const [visible, setVisible] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (localStorage.getItem("daftary_push_dismissed")) return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    // إشعارات Web Push على آيفون ما تشتغل إلا لو الموقع مضاف للشاشة الرئيسية
    // (وضع standalone) — بدون هذا الشرط، زر "تفعيل" يفشل بصمت بمتصفح سفاري العادي.
    if (isIOS && !isStandalone) {
      setNeedsInstall(true);
      setVisible(true);
      return;
    }

    if (!("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setVisible(!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("ما تم منح إذن الإشعارات (الحالة: " + permission + "). تأكدي من إعدادات الإشعارات بالجوال لتطبيق دفتري.");
        setVisible(false);
        localStorage.setItem("daftary_push_dismissed", "1");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motherId, subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error("فشل حفظ الاشتراك بالسيرفر: " + (data.error || res.status));
      }
      setVisible(false);
    } catch (e) {
      console.error("push subscribe failed:", e);
      alert("تعذّر تفعيل الإشعارات: " + (e?.message || e?.name || "خطأ غير معروف"));
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    setVisible(false);
    localStorage.setItem("daftary_push_dismissed", "1");
  }

  if (!visible) return null;

  return (
    <div style={{ flexShrink: 0, padding: "10px 16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, background: "#EBF7F1" }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#2F6E56" }}>
          {needsInstall ? "🔔 ضيفي دفتري للشاشة الرئيسية عشان توصلك الإشعارات (اضغطي زر المشاركة ⬆️ ثم \"إضافة إلى الشاشة الرئيسية\")" : "🔔 فعّلي إشعارات المتصفح لتذكيرات الواجبات والاختبارات"}
        </span>
        {!needsInstall && (
          <button onClick={enable} disabled={loading} style={{ background: "#68C29E", color: "white", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, flexShrink: 0, opacity: loading ? 0.6 : 1 }}>
            {loading ? "..." : "تفعيل"}
          </button>
        )}
        <button onClick={dismiss} style={{ background: "none", color: "#2F6E56", opacity: 0.6, fontSize: 16, width: 24, height: 24, flexShrink: 0 }}>×</button>
      </div>
    </div>
  );
}

function InstallPrompt() {
  const [platform, setPlatform] = useState(null);
  const [visible, setVisible] = useState(false);
  const promptRef = useRef(null);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone || localStorage.getItem("daftary_install_dismissed")) return;

    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS) {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    function handler(e) {
      e.preventDefault();
      promptRef.current = e;
      setPlatform("android");
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("daftary_install_dismissed", "1");
  }

  async function install() {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    await promptRef.current.userChoice;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div dir="rtl" style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 12px)", left: 12, right: 12, zIndex: 60, background: "white", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.18)", padding: 14, display: "flex", alignItems: "center", gap: 10, maxWidth: 420, margin: "0 auto" }}>
      <img src="/logo.png" alt="دفتري" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 13 }}>أضيفي دفتري للشاشة الرئيسية</p>
        <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>
          {platform === "ios" ? 'اضغطي زر المشاركة ⬆️ ثم "إضافة إلى الشاشة الرئيسية"' : "وصول أسرع من شاشة جوالك مباشرة"}
        </p>
      </div>
      {platform === "android" && (
        <button onClick={install} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, flexShrink: 0 }}>تثبيت</button>
      )}
      <button onClick={dismiss} style={{ background: "none", color: "#9CA3AF", fontSize: 18, width: 28, height: 28, flexShrink: 0 }}>×</button>
    </div>
  );
}

function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const canSubmit = name.trim().length > 1 && /^[0-9]{8}$/.test(phone.trim());
  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 24px calc(env(safe-area-inset-bottom) + 14px)", background: "linear-gradient(180deg,#F7F5FC,#F1EFFA)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", maxWidth: 380, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 96, height: 96, borderRadius: 22, margin: "0 auto 12px", display: "block", boxShadow: "0 4px 14px rgba(183,166,232,.35)" }} />
          <h1 style={{ color: "#5C4B8C", margin: 0, fontSize: 24, fontWeight: 800 }}>دفتري</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>متابعة واجبات واختبارات العيال، بلا تعقيد</p>
        </div>
        <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>ولي الأمر</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: ريم الفرج" style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 14, marginBottom: 12 }} />
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>رقم الجوال</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <span style={{ background: "#F3F4F6", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "#6B7280" }}>+965</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="XXXXXXXX" maxLength={8} style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 14 }} />
          </div>
          <button disabled={!canSubmit} onClick={() => onDone(name.trim(), "+965" + phone.trim())} style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: canSubmit ? 1 : 0.4 }}>
            متابعة
          </button>
        </div>
      </div>
      <div style={{ textAlign: "center", flexShrink: 0, width: "100%", maxWidth: 380, margin: "0 auto" }}>
        <a href="mailto:reemprimeco@gmail.com" style={{ display: "inline-block", padding: "8px 18px", borderRadius: 12, background: "white", color: "#5C4B8C", fontWeight: 700, fontSize: 13, textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          تواصل معنا
        </a>
        <p style={{ color: "#B7B2C4", fontSize: 11, margin: "8px 0 0" }}>Copyright © Reemora.app 2026</p>
      </div>
    </div>
  );
}

function PaywallScreen({ mother, children, payment, paying, onPay, onLogout }) {
  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 24px calc(env(safe-area-inset-bottom) + 14px)", background: "linear-gradient(180deg,#F7F5FC,#F1EFFA)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", maxWidth: 380, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 80, height: 80, borderRadius: 20, margin: "0 auto 12px", display: "block", boxShadow: "0 4px 14px rgba(183,166,232,.35)" }} />
          <h1 style={{ color: "#5C4B8C", margin: 0, fontSize: 20, fontWeight: 800 }}>اشتراك العام الدراسي {payment.academicYear}</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "6px 0 0" }}>{payment.pricePerStudent} د.ك لكل طالب/ة، يغطي العام الدراسي كامل حتى ٣٠ يوليو</p>
        </div>
        <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          {children.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F3F4F6", fontSize: 14 }}>
              <span>{c.name}</span>
              <span style={{ color: "#9CA3AF" }}>{payment.pricePerStudent}.000 د.ك</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontWeight: 800, fontSize: 16 }}>
            <span>الإجمالي المستحق</span>
            <span style={{ color: "#5C4B8C" }}>{payment.amountDueKwd.toFixed(3)} د.ك</span>
          </div>
          <button onClick={onPay} disabled={paying} style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: paying ? 0.6 : 1 }}>
            {paying ? "جاري التحويل..." : "ادفعي الآن"}
          </button>
        </div>
      </div>
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <button onClick={onLogout} style={{ background: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 700, padding: "10px" }}>تسجيل خروج</button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <p style={{ fontWeight: 800, marginBottom: 4 }}>ابدئي بإضافة أول طالب/ة</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 18 }}>سجّلي مدرسته وصفه، وبعدها ارفعي صور الجدول</p>
      <button onClick={onAdd} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, padding: "10px 20px", borderRadius: 12 }}>+ إضافة طالب/ة</button>
    </div>
  );
}

function ChildCard({ child, tasks, undatedTasks, upcomingTasks, hasPEToday, onOpenTask, onEdit }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  // معظم المهام تقع الأحد-الخميس (أيام الدراسة)، لكن تاريخ صريح مستخرج من صورة
  // (ميزة التواريخ البعيدة) ممكن نادراً يصادف جمعة/سبت — نعرضها بدل ما تختفي.
  const byDay = FULL_DAY_NAMES.map((day) => ({
    day,
    items: tasks.filter((t) => FULL_DAY_NAMES[new Date(t.due_date + "T00:00:00").getDay()] === day),
  }));
  return (
    <div>
      {hasPEToday && (
        <div style={{ marginBottom: 6, marginInlineStart: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FDF3E7", color: "#8C6027", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>
            🏃 بدنية اليوم
            {child.pe_uniform_color && (
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: child.pe_uniform_color, border: child.pe_uniform_color === "#FFFFFF" ? "1px solid #E5E7EB" : "1px solid rgba(0,0,0,.15)" }} />
            )}
          </span>
        </div>
      )}
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: color.bg }}>
        <Avatar child={child} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>الصف {child.grade}/{child.section} · {child.school}</p>
        </div>
        <button onClick={onEdit} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>✏️ تعديل</button>
      </div>
      <div style={{ background: "white", padding: 12 }}>
        {tasks.length === 0 && undatedTasks.length === 0 && upcomingTasks.length === 0 && <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا واجبات هذا الأسبوع 🎉</p>}
        {byDay.filter((d) => d.items.length).map(({ day, items }) => (
          <div key={day} style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", margin: "0 0 4px" }}>{day}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {items.map((t) => (
                <button key={t.id} onClick={() => onOpenTask(t)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 10, fontWeight: 700, background: color.soft, color: color.text }}>
                  {TYPE_META[t.type]?.icon} {t.subject}
                </button>
              ))}
            </div>
          </div>
        ))}
        {undatedTasks.length > 0 && (
          <div style={{ marginBottom: upcomingTasks.length > 0 ? 8 : 0 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#B45309", margin: "0 0 4px" }}>⚠️ مهام بدون تاريخ محدد</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {undatedTasks.map((t) => (
                <button key={t.id} onClick={() => onOpenTask(t)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 10, fontWeight: 700, background: "#FEF3C7", color: "#92400E" }}>
                  {TYPE_META[t.type]?.icon} {t.subject}
                </button>
              ))}
            </div>
          </div>
        )}
        {upcomingTasks.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#31607C", margin: "0 0 4px" }}>📅 مهام قادمة (بعد هذا الأسبوع)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {upcomingTasks.map((t) => (
                <button key={t.id} onClick={() => onOpenTask(t)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "8px 10px", borderRadius: 10, fontWeight: 700, background: "#EBF4FA", color: "#31607C", textAlign: "right" }}>
                  <span>{TYPE_META[t.type]?.icon} {t.subject}</span>
                  <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>{fmtDate(t.due_date)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function RequirementsCard({ child, items, onToggle, onEdit, onDeleteReq }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: color.bg }}>
        <Avatar child={child} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>{items.length} طلب</p>
        </div>
        <button onClick={onEdit} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>✏️ تعديل</button>
      </div>
      <div style={{ background: "white", padding: 12 }}>
        {items.length === 0 && <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا توجد طلبات حالياً</p>}
        {items.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F3F4F6", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: r.bought ? "#9CA3AF" : "#374151", textDecoration: r.bought ? "line-through" : "none" }}>{r.item}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{fmtDate(r.due_date)}</p>
            </div>
            <button onClick={() => onToggle(r.id)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 10, fontWeight: 700, background: r.bought ? "#F0FDF4" : color.soft, color: r.bought ? "#166534" : color.text, flexShrink: 0 }}>
              {r.bought ? "تم الشراء" : "تحديد كمُشترى"}
            </button>
            <button onClick={() => onDeleteReq(r.id)} title="حذف" style={{ background: "none", color: "#B91C1C", opacity: 0.6, fontSize: 16, width: 24, height: 24, flexShrink: 0, padding: 0 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleCard({ child, schedule, onUpload }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  const maxPeriod = schedule.reduce((max, s) => Math.max(max, s.period_number), 0);
  const grid = {};
  schedule.forEach((s) => { grid[`${s.day}-${s.period_number}`] = s; });
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
  const printRef = useRef();
  const [exporting, setExporting] = useState(false);

  async function exportPdf() {
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const margin = 10;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      const canvasRatio = canvas.width / canvas.height;
      let w = maxW;
      let h = w / canvasRatio;
      if (h > maxH) {
        h = maxH;
        w = h * canvasRatio;
      }
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;
      pdf.addImage(imgData, "PNG", x, y, w, h);
      pdf.save(`جدول-حصص-${child.name}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("تعذّر تصدير PDF، حاولي مرة ثانية.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: color.bg }}>
        <Avatar child={child} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>الصف {child.grade}/{child.section}</p>
        </div>
        <button onClick={onUpload} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>{schedule.length ? "🔄 تحديث" : "+ رفع"}</button>
      </div>
      <div style={{ background: "white", padding: 12, overflowX: "auto" }}>
        {schedule.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا يوجد جدول حصص مضاف بعد</p>
        ) : (
          <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={exportPdf} disabled={exporting} style={{ background: color.soft, color: color.text, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 10, opacity: exporting ? 0.6 : 1 }}>
              {exporting ? "جاري التصدير..." : "📄 تصدير PDF"}
            </button>
          </div>
          <table style={{ borderCollapse: "separate", borderSpacing: 5, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: 4, width: 58 }}></th>
                {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((p) => (
                  <th key={p} style={{ padding: 4, color: "#9CA3AF", fontWeight: 800, minWidth: 86 }}>الحصة {p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => {
                const dayPal = PALETTE[di % PALETTE.length];
                return (
                  <tr key={d}>
                    <td style={{ padding: "8px 6px", textAlign: "center", background: dayPal.soft, color: dayPal.text, borderRadius: 8, fontWeight: 800, whiteSpace: "nowrap" }}>{d}</td>
                    {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((p) => {
                      const entry = grid[`${d}-${p}`];
                      return (
                        <td key={p} style={{ padding: "6px 4px", textAlign: "center", background: dayPal.bg, borderRadius: 8, verticalAlign: entry ? "top" : "middle" }}>
                          {entry ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ position: "relative" }}>
                                <SubjectIcon subject={entry.subject} size={26} />
                                {getSubjectIconFile(entry.subject) === "pe" && child.pe_uniform_color && (
                                  <span style={{ position: "absolute", bottom: -2, left: -2, width: 10, height: 10, borderRadius: "50%", background: child.pe_uniform_color, border: child.pe_uniform_color === "#FFFFFF" ? "1px solid #E5E7EB" : "1px solid rgba(0,0,0,.15)" }} />
                                )}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 800, color: dayPal.text }}>{entry.subject}</span>
                              {entry.teacher && <span style={{ fontSize: 9, color: dayPal.text, opacity: 0.75 }}>{entry.teacher}</span>}
                              {(entry.start_time || entry.end_time) && (
                                <span style={{ fontSize: 8, color: dayPal.text, opacity: 0.55 }}>{[entry.start_time, entry.end_time].filter(Boolean).join(" - ")}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: dayPal.text, opacity: 0.4 }}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>
      {schedule.length > 0 && (
        <div style={{ position: "fixed", top: 0, left: -9999, width: 1100 }}>
          <div ref={printRef} style={{ background: "white", padding: 24, direction: "rtl" }}>
            <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #111", paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: "#111" }}>جدول حصص {child.name}</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#333" }}>{child.school} — الصف {child.grade}/{child.section}</p>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #999", padding: "8px 6px" }}></th>
                  {periods.map((p) => (
                    <th key={p} style={{ border: "1px solid #999", padding: "8px 6px", color: "#111" }}>الحصة {p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d}>
                    <td style={{ border: "1px solid #999", padding: "8px 6px", fontWeight: 800, color: "#111", textAlign: "center" }}>{d}</td>
                    {periods.map((p) => {
                      const entry = grid[`${d}-${p}`];
                      return (
                        <td key={p} style={{ border: "1px solid #999", padding: "8px 6px", textAlign: "center", color: "#111" }}>
                          {entry ? (
                            <div>
                              <div style={{ fontWeight: 800 }}>{entry.subject}</div>
                              {getSubjectIconFile(entry.subject) === "pe" && child.pe_uniform_color && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2 }}>
                                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: child.pe_uniform_color, border: "1px solid #999" }} />
                                  <span style={{ fontSize: 8, color: "#666" }}>لون البدنية</span>
                                </div>
                              )}
                              {entry.teacher && <div style={{ fontSize: 9, color: "#444" }}>{entry.teacher}</div>}
                              {(entry.start_time || entry.end_time) && (
                                <div style={{ fontSize: 8, color: "#666" }}>{[entry.start_time, entry.end_time].filter(Boolean).join(" - ")}</div>
                              )}
                            </div>
                          ) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskModal({ task, motherId, color, onClose, onMarkDone, onDelete, onUpdateDate }) {
  const meta = TYPE_META[task.type] || TYPE_META["واجب"];
  const [dateValue, setDateValue] = useState(task.due_date || "");
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState("");
  const dateChanged = dateValue !== (task.due_date || "");

  async function saveDate() {
    setSaving(true);
    setDateError("");
    try {
      await onUpdateDate(task.id, dateValue || null);
    } catch (e) {
      setDateError(e.message || "تعذّر حفظ التاريخ، حاولي مرة ثانية.");
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, borderRadius: "24px 24px 0 0", padding: "22px 22px calc(env(safe-area-inset-bottom) + 22px)", maxHeight: "85vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 22 }}>{meta.icon}</span>
            <h3 style={{ margin: "4px 0 2px", color: color.text, fontSize: 18 }}>{task.subject}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>{task.type} · {task.due_date ? fmtDate(task.due_date) : "بدون تاريخ محدد"}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36, flexShrink: 0 }}>×</button>
        </div>
        {task.details && <div style={{ background: color.bg, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>{task.details}</div>}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>تاريخ الاستحقاق</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", fontSize: 14 }} />
            <button onClick={saveDate} disabled={saving || !dateChanged} style={{ padding: "9px 16px", borderRadius: 12, background: color.solid, color: "white", fontWeight: 700, fontSize: 13, opacity: (saving || !dateChanged) ? 0.5 : 1, flexShrink: 0 }}>
              {saving ? "..." : "حفظ التاريخ"}
            </button>
          </div>
          {dateError && <p style={{ color: "#B91C1C", fontSize: 12, margin: "6px 0 0" }}>{dateError}</p>}
        </div>

        {task.due_date && !dateChanged && (
          <a href={`/api/tasks/${task.id}/ics?motherId=${motherId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: 12, borderRadius: 12, background: color.bg, color: color.text, fontWeight: 700, fontSize: 13, minHeight: 44, marginBottom: 10, textDecoration: "none" }}>
            🔔 إضافة تذكير (قبل يوم)
          </a>
        )}
        <button onClick={() => onMarkDone(task.id)} style={{ width: "100%", padding: 14, borderRadius: 12, background: color.solid, color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, marginBottom: 10 }}>
          {meta.done}
        </button>
        <button onClick={() => onDelete(task.id)} style={{ width: "100%", padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
          حذف الواجب (دخل غلط)
        </button>
      </div>
    </div>
  );
}

function AddChildModal({ schools, nextColorIdx, child, onClose, onSave, onDelete }) {
  const isEdit = !!child;
  const [name, setName] = useState(child?.name || "");
  const [gov, setGov] = useState(child?.governorate || "");
  const [grade, setGrade] = useState(child?.grade || 3);
  const [section, setSection] = useState(child?.section || 1);
  const [gender, setGender] = useState(child?.gender || "بنين");
  const [school, setSchool] = useState(child?.school || "");
  const [photo, setPhoto] = useState(child?.photo_url || null);
  const [colorIdx, setColorIdx] = useState((child?.color_idx ?? nextColorIdx) % PALETTE.length);
  const [peColor, setPeColor] = useState(child?.pe_uniform_color || null);
  const fileRef = useRef();
  const stage = stageForGrade(grade);
  const options = gov ? schools?.[gov]?.[stage]?.[gender] || [] : [];
  const canSave = name.trim().length > 1 && gov && school;
  const word = gender === "بنات" ? "طالبة" : "طالب";

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: "24px 24px 0 0" }}>
        <div style={{ position: "sticky", top: 0, background: "white", padding: "16px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{isEdit ? `تعديل بيانات ${studentWord(gender)}` : `إضافة ${word}`}</h2>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36 }}>×</button>
        </div>
        <div style={{ padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button onClick={() => fileRef.current?.click()} style={{ position: "relative", background: "none" }}>
              {photo ? <img src={photo} style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", border: `2px solid ${PALETTE[colorIdx].ring}` }} /> :
                <div style={{ width: 92, height: 92, borderRadius: "50%", border: `2px dashed ${PALETTE[colorIdx].ring}`, background: PALETTE[colorIdx].soft, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE[colorIdx].text }}>📷</div>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await resizeToDataUrl(f, 160, true)); }} />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>اللون المميز</label>
            <div style={{ display: "flex", gap: 10, marginTop: 6, justifyContent: "center" }}>
              {PALETTE.map((pal, i) => (
                <button key={i} onClick={() => setColorIdx(i)} title={`لون ${i + 1}`} style={{ width: 32, height: 32, borderRadius: "50%", background: pal.solid, border: colorIdx === i ? `3px solid ${pal.text}` : "3px solid transparent", boxShadow: colorIdx === i ? `0 0 0 2px ${pal.ring}` : "none", flexShrink: 0 }} />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>اسم {word === "طالبة" ? "الطالبة" : "الطالب"}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>الصف</label>
              <select value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setSchool(""); }} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>الصف {g} — {stageForGrade(g)}</option>)}
              </select>
            </div>
            <div style={{ width: 90 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>الشعبة</label>
              <select value={section} onChange={(e) => setSection(Number(e.target.value))} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>الجنس / نوع المدرسة</label>
            <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
              {["بنين", "بنات"].map((g) => (
                <button key={g} onClick={() => { setGender(g); setSchool(""); }} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${gender === g ? "#B7A6E8" : "#E5E7EB"}`, background: gender === g ? "#F1EFFA" : "white", color: gender === g ? "#5C4B8C" : "#6B7280", fontWeight: 700 }}>{g}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>لون ملابس البدنية (اختياري)</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {PE_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setPeColor(peColor === c.value ? null : c.value)}
                  title={c.label}
                  style={{
                    width: 30, height: 30, borderRadius: "50%", background: c.value, flexShrink: 0,
                    border: c.value === "#FFFFFF" ? "1px solid #E5E7EB" : "3px solid transparent",
                    boxShadow: peColor === c.value ? "0 0 0 2px white, 0 0 0 4px #B7A6E8" : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>المحافظة</label>
            <select value={gov} onChange={(e) => { setGov(e.target.value); setSchool(""); }} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
              <option value="">— اختاري —</option>
              {schools && Object.keys(schools).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {gov && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 700 }}>المدرسة ({stage} - {gender})</label>
              <select value={school} onChange={(e) => setSchool(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
                <option value="">— اختاري —</option>
                {options.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <button disabled={!canSave} onClick={() => onSave({ name: name.trim(), grade, section, gender, school, governorate: gov, photo, colorIdx, peUniformColor: peColor })} style={{ padding: 14, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSave ? 1 : 0.4 }}>
            {isEdit ? "حفظ التعديلات" : `إضافة ${word === "طالبة" ? "الطالبة" : "الطالب"}`}
          </button>
          {isEdit && (
            <button onClick={onDelete} style={{ padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
              حذف {studentWord(gender)} نهائياً
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadView({ children, motherId, endpoint = "/api/upload-schedule", title = "رفع الجدول", buttonLabel = "تحليل وتوزيع الواجبات", renderSummary, selectChild = true, hint, onClose, onDone }) {
  const [school, setSchool] = useState("");
  const [childId, setChildId] = useState("");
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef();
  const schoolsOfChildren = [...new Set(children.map((c) => c.school))];
  const childrenOfSchool = school ? children.filter((c) => c.school === school) : [];
  const autoChild = childrenOfSchool.length === 1 ? childrenOfSchool[0] : null;
  const effectiveChildId = autoChild ? autoChild.id : childId;
  const needsChildConfirm = selectChild && childrenOfSchool.length > 1;
  const canRun = school && images.length > 0 && (!selectChild || effectiveChildId);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const urls = await Promise.all(files.map((f) => resizeToDataUrl(f)));
    setImages((prev) => [...prev, ...urls]);
  }

  async function run() {
    setStatus("loading");
    try {
      const body = selectChild ? { motherId, childId: effectiveChildId, images } : { motherId, school, images };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data);
      setStatus("done");
      setImages([]);
      onDone();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "");
      setStatus("error");
    }
  }

  return (
    <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 50, background: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, background: "white", padding: "calc(env(safe-area-inset-top) + 12px) 16px 14px", borderBottom: "1px solid #F0EEE8", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", fontSize: 20, width: 36, height: 36 }}>←</button>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{title}</p>
      </div>
      <div className="app-scroll" style={{ padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", flexDirection: "column", gap: 14 }}>
        {hint && (
          <div style={{ background: "#FDF3E7", color: "#8C6027", borderRadius: 12, padding: 12, fontSize: 12.5, fontWeight: 700, lineHeight: 1.6 }}>
            {hint}
          </div>
        )}
        <div>
          <label style={{ fontSize: 13, fontWeight: 700 }}>هذي الصور من مدرسة:</label>
          <select value={school} onChange={(e) => { setSchool(e.target.value); setChildId(""); }} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
            <option value="">— اختاري —</option>
            {schoolsOfChildren.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {selectChild && autoChild && (
          <div style={{ background: "#F1EFFA", color: "#5C4B8C", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700 }}>
            هذا الجدول لـ {autoChild.name} — الصف {autoChild.grade}/{autoChild.section}
          </div>
        )}
        {needsChildConfirm && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>هذا الجدول لأي طالب/ة؟</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {childrenOfSchool.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1px solid ${childId === c.id ? "#B7A6E8" : "#E5E7EB"}`, background: childId === c.id ? "#F1EFFA" : "white", cursor: "pointer" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="radio" name="uploadChild" checked={childId === c.id} onChange={() => setChildId(c.id)} style={{ accentColor: "#B7A6E8" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{c.name}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>الصف {c.grade}/{c.section}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed #D1D5DB", borderRadius: 16, padding: 30, textAlign: "center", background: "#FAFAFA", cursor: "pointer" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>اضغطي لاختيار الصور</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>يمكنك اختيار أكثر من صورة دفعة وحدة</p>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        </div>
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden" }}>
                <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,.6)", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <button disabled={!canRun || status === "loading"} onClick={run} style={{ padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, opacity: canRun ? 1 : 0.4 }}>
          {status === "loading" ? "جاري التحليل..." : buttonLabel}
        </button>
        {status === "done" && summary && (renderSummary ? renderSummary(summary) : (
          <div style={{ background: "#F0FDF4", color: "#166534", borderRadius: 12, padding: 12, fontSize: 13 }}>
            تم تحليل {summary.imagesProcessed} صورة ✓ — أُضيف {summary.matchedTasks} واجب/اختبار و {summary.matchedReqs} طلب مستلزمات.
            {(summary.updatedTasks > 0 || summary.updatedReqs > 0) && (
              <div style={{ marginTop: 6, opacity: 0.85 }}>تم تحديث {summary.updatedTasks} واجب/اختبار و {summary.updatedReqs} طلب كانوا موجودين مسبقاً (المدرسة غيّرت تفاصيلهم).</div>
            )}
            {summary.skippedOld > 0 && (
              <div style={{ marginTop: 6, opacity: 0.85 }}>تم تجاهل {summary.skippedOld} عنصر لأن تاريخه فات (صورة قديمة).</div>
            )}
          </div>
        ))}
        {status === "error" && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: 12, fontSize: 13 }}>
            صار خلل أثناء التحليل، حاولي مرة ثانية.
            {errorMsg && <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8, wordBreak: "break-word" }}>{errorMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherView({ children, motherId }) {
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef();
  const bottomRef = useRef();
  const child = children.find((c) => c.id === childId);

  useEffect(() => {
    if (!childId) return;
    setHistoryLoading(true);
    fetch(`/api/ai-teacher/history?childId=${childId}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setHistoryLoading(false));
  }, [childId, motherId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await resizeToDataUrl(file, 1400, false);
    setImage(url);
  }

  async function send() {
    if (!input.trim() && !image) return;
    const questionText = input.trim();
    const attachedImage = image;
    setSending(true);
    setErrorMsg("");
    setMessages((prev) => [...prev, { role: "user", content: questionText || "📷 صورة مرفقة", had_image: !!attachedImage, id: `local-${Date.now()}` }]);
    setInput("");
    setImage(null);
    try {
      const res = await fetch("/api/ai-teacher/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motherId, childId, question: questionText, image: attachedImage || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, had_image: false, id: `local-a-${Date.now()}` }]);
    } catch (err) {
      setErrorMsg(err.message || "تعذّر إرسال السؤال، حاولي مرة ثانية.");
    }
    setSending(false);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {children.length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {children.map((c) => (
              <button key={c.id} onClick={() => setChildId(c.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 6px", borderRadius: 20, background: childId === c.id ? "#F1EFFA" : "#F9F9F7", border: `1px solid ${childId === c.id ? "#B7A6E8" : "#EEEDE8"}`, flexShrink: 0 }}>
                <Avatar child={c} size={26} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: childId === c.id ? "#5C4B8C" : "#6B7280" }}>{c.name}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ background: "#FDF3E7", color: "#8C6027", borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 700, lineHeight: 1.6 }}>
          اسألي عن أي واجب أو درس بمنهج {child ? `الصف ${child.grade}` : "ابنك/ابنتك"} — تقدرين ترفقين صورة الواجب مباشرة، والمعلم الذكي يستعين بمواد وزارة التربية الرسمية لما تكون متوفرة.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {historyLoading ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>...جاري التحميل</p>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>ابدئي بسؤال 👋</p>
        ) : (
          messages.map((m, i) => (
            <div key={m.id || i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
              <div style={{
                maxWidth: "82%",
                padding: "10px 13px",
                borderRadius: 14,
                fontSize: 13.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                background: m.role === "user" ? "#B7A6E8" : "#F3F2FA",
                color: m.role === "user" ? "white" : "#374151",
              }}>
                {m.content}
                {m.had_image && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>📷 مع صورة</div>}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ padding: "10px 13px", borderRadius: 14, fontSize: 13, background: "#F3F2FA", color: "#9CA3AF" }}>...المعلم الذكي يفكر</div>
          </div>
        )}
        {errorMsg && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: 10, fontSize: 12.5 }}>{errorMsg}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ flexShrink: 0, borderTop: "1px solid #F0EEE8", background: "white", padding: "10px 16px calc(env(safe-area-inset-bottom) + 10px)", display: "flex", flexDirection: "column", gap: 8 }}>
        {image && (
          <div style={{ position: "relative", width: 64, height: 64, borderRadius: 10, overflow: "hidden" }}>
            <img src={image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => setImage(null)} style={{ position: "absolute", top: 2, left: 2, background: "rgba(0,0,0,.6)", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12 }}>×</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button onClick={() => fileRef.current?.click()} style={{ background: "#F3F4F6", borderRadius: 12, width: 44, height: 44, fontSize: 18, flexShrink: 0 }}>📷</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePickImage} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتبي سؤالك..."
            rows={1}
            style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "11px 12px", fontSize: 16, resize: "none", fontFamily: "inherit", minHeight: 44, maxHeight: 100 }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button disabled={sending || (!input.trim() && !image)} onClick={send} style={{ background: "#B7A6E8", color: "white", borderRadius: 12, width: 44, height: 44, fontSize: 16, flexShrink: 0, opacity: sending || (!input.trim() && !image) ? 0.4 : 1 }}>➤</button>
        </div>
      </div>
    </div>
  );
}

function ProgressView({ children, motherId, onDataCleared }) {
  const [section, setSection] = useState("memorization");
  const [childId, setChildId] = useState(children[0]?.id || "");
  const child = children.find((c) => c.id === childId) || children[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {children.map((c) => (
            <button key={c.id} onClick={() => setChildId(c.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 6px", borderRadius: 20, background: (childId || children[0].id) === c.id ? "#F1EFFA" : "#F9F9F7", border: `1px solid ${(childId || children[0].id) === c.id ? "#B7A6E8" : "#EEEDE8"}`, flexShrink: 0 }}>
              <Avatar child={c} size={26} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: (childId || children[0].id) === c.id ? "#5C4B8C" : "#6B7280" }}>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setSection("memorization")} style={{ flex: 1, padding: 10, borderRadius: 12, background: section === "memorization" ? "#B7A6E8" : "#F3F4F6", color: section === "memorization" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>🕌 الحفظ</button>
        <button onClick={() => setSection("grades")} style={{ flex: 1, padding: 10, borderRadius: 12, background: section === "grades" ? "#B7A6E8" : "#F3F4F6", color: section === "grades" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>📊 الدرجات</button>
      </div>

      {child && (section === "memorization" ? (
        <MemorizationSection child={child} motherId={motherId} />
      ) : (
        <GradesSection child={child} motherId={motherId} />
      ))}

      <ResetYearButton motherId={motherId} onDone={onDataCleared} />
    </div>
  );
}

function MemorizationSection({ child, motherId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/memorization?childId=${child.id}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [child.id, motherId]);

  async function handleToggle(id) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
    const res = await fetch(`/api/memorization/${id}/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
    if (!res.ok) load();
  }

  if (loading) return <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>...جاري التحميل</p>;
  if (items.length === 0) return <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>ما فيه مطلوبات حفظ حالياً لـ{child.name} — تُستخرج تلقائياً من صور الخطة الأسبوعية.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it) => (
        <label key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, background: it.done ? "#F7F7F5" : "white", border: "1px solid #EEEDE8", cursor: "pointer" }}>
          <input type="checkbox" checked={it.done} onChange={() => handleToggle(it.id)} style={{ marginTop: 3, width: 18, height: 18, accentColor: "#B7A6E8", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: it.done ? "#9CA3AF" : "#374151", textDecoration: it.done ? "line-through" : "none" }}>
              {it.kind === "حديث" ? "📗" : "📖"} {it.reference}
            </p>
            {it.details && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF" }}>{it.details}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}

function GradesSection({ child, motherId }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [subject, setSubject] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [examName, setExamName] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/grades?childId=${child.id}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setGrades(data.grades || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [child.id, motherId]);

  async function handleAdd() {
    if (!subject.trim() || !score || !maxScore) return;
    setSaving(true);
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motherId, childId: child.id, subject, score, maxScore, examName }),
    });
    if (res.ok) {
      setSubject(""); setScore(""); setMaxScore(""); setExamName("");
      setShowAdd(false);
      load();
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("حذف هذه الدرجة؟")) return;
    setGrades((prev) => prev.filter((g) => g.id !== id));
    await fetch(`/api/grades/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
  }

  const bySubject = {};
  for (const g of grades) {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(g);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button onClick={() => setShowAdd((s) => !s)} style={{ padding: 10, borderRadius: 12, background: "#F1EFFA", color: "#5C4B8C", fontWeight: 700, fontSize: 13 }}>
        {showAdd ? "إلغاء" : "+ إضافة درجة"}
      </button>

      {showAdd && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, background: "#FAFAF8", border: "1px solid #EEEDE8" }}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="المادة (مثال: الرياضيات)" style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="الدرجة" type="number" style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 14 }} />
            <span style={{ alignSelf: "center", color: "#9CA3AF" }}>من</span>
            <input value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="الدرجة الكلية" type="number" style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 14 }} />
          </div>
          <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="اسم الاختبار (اختياري)" style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 14 }} />
          <button disabled={saving || !subject.trim() || !score || !maxScore} onClick={handleAdd} style={{ padding: 10, borderRadius: 10, background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 13, opacity: saving || !subject.trim() || !score || !maxScore ? 0.5 : 1 }}>
            {saving ? "جاري الحفظ..." : "حفظ الدرجة"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>...جاري التحميل</p>
      ) : Object.keys(bySubject).length === 0 ? (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>ما فيه درجات مسجّلة بعد لـ{child.name}</p>
      ) : (
        Object.entries(bySubject).map(([subj, entries]) => {
          const totalScore = entries.reduce((s, e) => s + Number(e.score), 0);
          const totalMax = entries.reduce((s, e) => s + Number(e.max_score), 0);
          const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
          return (
            <div key={subj} style={{ border: "1px solid #EEEDE8", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{subj}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#5C4B8C" }}>{pct}% ({totalScore}/{totalMax})</span>
              </div>
              {entries.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12.5, color: "#6B7280" }}>
                  <span>{e.exam_name || "اختبار"} — {e.score}/{e.max_score}</span>
                  <button onClick={() => handleDelete(e.id)} style={{ background: "none", color: "#D1785A", fontSize: 12 }}>حذف</button>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function ResetYearButton({ motherId, onDone }) {
  const [busy, setBusy] = useState(false);

  async function handleReset() {
    if (!confirm("مسح كل بيانات هذا العام الدراسي (الواجبات، المتطلبات، جدول الحصص، الحفظ، الدرجات، ومحادثات المعلم الذكي) لكل الأطفال؟ هذا الإجراء نهائي ولا يمكن التراجع عنه. ملفات الأطفال نفسها تبقى، بس لازم تحدّثين الصف يدوياً بعدها.")) return;
    if (!confirm("تأكيد أخير: راح تنمسح البيانات نهائياً. متأكدة؟")) return;
    setBusy(true);
    const res = await fetch("/api/reset-year", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
    setBusy(false);
    if (res.ok) {
      alert("تم مسح بيانات العام الدراسي ✅");
      onDone();
    } else {
      alert("تعذّر المسح، حاولي مرة ثانية.");
    }
  }

  return (
    <button onClick={handleReset} disabled={busy} style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "none", color: "#B91C1C", fontWeight: 700, fontSize: 12.5, border: "1px solid #FECACA", opacity: busy ? 0.6 : 1 }}>
      🗑️ مسح بيانات العام الدراسي (نهاية السنة)
    </button>
  );
}
