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
const TYPE_META = {
  "واجب": { icon: "📝", done: "تم" },
  "حفظ": { icon: "📖", done: "تم الحفظ" },
  "اختبار": { icon: "📚", done: "تم المذاكرة" },
  "مشروع": { icon: "🎨", done: "تم" },
};
const stageForGrade = (g) => (g <= 5 ? "ابتدائي" : g <= 9 ? "متوسط" : "ثانوي");
const studentWord = (gender) => (gender === "بنات" ? "الطالبة" : "الطالب");

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

export default function Home() {
  const [mother, setMother] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState(null);
  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [view, setView] = useState("dashboard");
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [openTask, setOpenTask] = useState(null);
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramLinked, setTelegramLinked] = useState(false);

  useEffect(() => {
    fetch("/schools.json").then((r) => r.json()).then(setSchools);
    const saved = typeof window !== "undefined" ? localStorage.getItem("daftary_mother") : null;
    if (saved) {
      const m = JSON.parse(saved);
      setMother(m);
      loadAll(m.id);
    }
    setLoading(false);
  }, []);

  async function loadAll(motherId) {
    const res = await fetch(`/api/dashboard?motherId=${motherId}`);
    const data = await res.json();
    setChildren(data.children || []);
    setTasks(data.tasks || []);
    setRequirements(data.requirements || []);
    const tRes = await fetch(`/api/telegram/link?motherId=${motherId}`);
    const tData = await tRes.json();
    setTelegramLink(tData.link);
    setTelegramLinked(tData.linked);
  }

  function handleLogout() {
    if (!confirm("تسجيل الخروج من دفتري؟")) return;
    localStorage.removeItem("daftary_mother");
    setMother(null);
    setChildren([]);
    setTasks([]);
    setRequirements([]);
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
    }
  }

  async function handleUpdateChild(id, child) {
    const res = await fetch(`/api/children/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(child) });
    const data = await res.json();
    if (data.child) {
      setChildren((prev) => prev.map((c) => (c.id === id ? data.child : c)));
      setEditingChild(null);
    }
  }

  async function handleDeleteChild(id) {
    if (!confirm("حذف هذا الطالب/ـة نهائياً؟ راح تنحذف كل واجباته ومتطلباته معه.")) return;
    await fetch(`/api/children/${id}`, { method: "DELETE" });
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => prev.filter((t) => t.child_id !== id));
    setRequirements((prev) => prev.filter((r) => r.child_id !== id));
    setEditingChild(null);
  }

  async function handleMarkDone(taskId) {
    await fetch(`/api/tasks/${taskId}/done`, { method: "POST" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setOpenTask(null);
  }

  async function handleDeleteTask(taskId) {
    if (!confirm("حذف هذا الواجب نهائياً؟")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setOpenTask(null);
  }

  async function handleToggleReq(id) {
    await fetch(`/api/requirements/${id}/toggle`, { method: "POST" });
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, bought: !r.bought } : r)));
  }

  async function handleDeleteReq(id) {
    if (!confirm("حذف هذا الطلب؟")) return;
    await fetch(`/api/requirements/${id}`, { method: "DELETE" });
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading || (mother && !schools)) {
    return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#9CA3AF" }}>...جاري التحميل</div>;
  }

  if (!mother) return <Onboarding onDone={handleRegister} />;

  const weekTasksFor = (childId) => tasks.filter((t) => t.child_id === childId);

  return (
    <div dir="rtl" className="app-root" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, zIndex: 10, background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", padding: "calc(env(safe-area-inset-top) + 10px) 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EEE8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "#6FBFA0", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, flexShrink: 0 }}>د</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>مرحباً {mother.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{new Date().toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowUpload(true)} style={{ background: "#6FBFA0", color: "white", fontWeight: 700, fontSize: 14, padding: "10px 16px", borderRadius: 12, minHeight: 40 }}>
            رفع جدول
          </button>
          <button onClick={handleLogout} title="تسجيل خروج" style={{ background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 12, padding: "10px 12px", borderRadius: 12, minHeight: 40 }}>
            خروج
          </button>
        </div>
      </div>

      <div className="app-scroll" style={{ flex: 1 }}>
        {!telegramLinked && telegramLink && (
          <a href={telegramLink} target="_blank" rel="noreferrer" style={{ display: "block", margin: 12, padding: 14, borderRadius: 14, background: "#EBF7F1", color: "#3D7A63", fontSize: 13, fontWeight: 700, textAlign: "center", textDecoration: "none" }}>
            فعّلي تذكيرات تيليجرام الآن ⬅️
          </a>
        )}

        {view === "dashboard" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>واجبات هذا الأسبوع</span>
                  <button onClick={() => setShowAddChild(true)} style={{ background: "none", color: "#6FBFA0", fontWeight: 700, fontSize: 13, padding: "8px 4px", minHeight: 36 }}>+ إضافة طالب/ة</button>
                </div>
                {children.map((c) => (
                  <ChildCard key={c.id} child={c} tasks={weekTasksFor(c.id)} onOpenTask={setOpenTask} onEdit={() => setEditingChild(c)} />
                ))}
              </>
            )}
          </div>
        ) : (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              children.map((c) => (
                <RequirementsCard key={c.id} child={c} items={requirements.filter((r) => r.child_id === c.id)} onToggle={handleToggleReq} onEdit={() => setEditingChild(c)} onDeleteReq={handleDeleteReq} />
              ))
            )}
          </div>
        )}
        <div style={{ height: 8 }} />
      </div>

      <div style={{ flexShrink: 0, background: "white", borderTop: "1px solid #F0EEE8", display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button onClick={() => setView("dashboard")} style={{ flex: 1, padding: "12px 0", background: "none", color: view === "dashboard" ? "#6FBFA0" : "#9CA3AF", fontWeight: 700, fontSize: 12, minHeight: 48 }}>الرئيسية</button>
        <button onClick={() => setView("requirements")} style={{ flex: 1, padding: "12px 0", background: "none", color: view === "requirements" ? "#6FBFA0" : "#9CA3AF", fontWeight: 700, fontSize: 12, minHeight: 48 }}>المتطلبات</button>
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
      {showUpload && <UploadView children={children} motherId={mother.id} onClose={() => setShowUpload(false)} onDone={() => loadAll(mother.id)} />}
      {openTask && <TaskModal task={openTask} color={PALETTE[(children.find((c) => c.id === openTask.child_id)?.color_idx || 0) % PALETTE.length]} onClose={() => setOpenTask(null)} onMarkDone={handleMarkDone} onDelete={handleDeleteTask} />}
    </div>
  );
}

function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const canSubmit = name.trim().length > 1 && /^[0-9]{8}$/.test(phone.trim());
  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px)", background: "linear-gradient(180deg,#FAF7F2,#F3EFE7)" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#6FBFA0", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 28, fontWeight: 800 }}>د</div>
          <h1 style={{ color: "#3D7A63", margin: 0, fontSize: 24, fontWeight: 800 }}>دفتري</h1>
          <p style={{ color: "#6B7280", fontSize: 14, margin: "4px 0 0" }}>متابعة واجبات واختبارات العيال، بلا تعقيد</p>
          <p style={{ color: "#9CA3AF", fontSize: 12, margin: "6px 0 0" }}>الأب أو أي أحد بالعائلة يقدر يدخل بنفس رقم الجوال ويشوف نفس الجدول</p>
        </div>
        <div style={{ background: "white", borderRadius: 20, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>اسمك</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أم فهد" style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 14, marginBottom: 14 }} />
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>رقم الجوال</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            <span style={{ background: "#F3F4F6", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "#6B7280" }}>+965</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="XXXXXXXX" maxLength={8} style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 14 }} />
          </div>
          <button disabled={!canSubmit} onClick={() => onDone(name.trim(), "+965" + phone.trim())} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#6FBFA0", color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSubmit ? 1 : 0.4 }}>
            ابدئي المتابعة
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <p style={{ fontWeight: 800, marginBottom: 4 }}>ابدئي بإضافة أول طالب/ة</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 18 }}>سجّلي مدرسته وصفه، وبعدها ارفعي صور الجدول</p>
      <button onClick={onAdd} style={{ background: "#6FBFA0", color: "white", fontWeight: 700, padding: "10px 20px", borderRadius: 12 }}>+ إضافة طالب/ة</button>
    </div>
  );
}

function ChildCard({ child, tasks, onOpenTask, onEdit }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  const byDay = DAYS.map((day) => ({
    day,
    items: tasks.filter((t) => DAYS[new Date(t.due_date + "T00:00:00").getDay()] === day),
  }));
  return (
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
        {tasks.length === 0 && <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا واجبات هذا الأسبوع 🎉</p>}
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

function TaskModal({ task, color, onClose, onMarkDone, onDelete }) {
  const meta = TYPE_META[task.type] || TYPE_META["واجب"];
  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, borderRadius: "24px 24px 0 0", padding: "22px 22px calc(env(safe-area-inset-bottom) + 22px)", maxHeight: "85vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 22 }}>{meta.icon}</span>
            <h3 style={{ margin: "4px 0 2px", color: color.text, fontSize: 18 }}>{task.subject}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>{task.type} · {fmtDate(task.due_date)}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36, flexShrink: 0 }}>×</button>
        </div>
        {task.details && <div style={{ background: color.bg, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>{task.details}</div>}
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
              {photo ? <img src={photo} style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", border: `2px solid ${PALETTE[nextColorIdx % PALETTE.length].ring}` }} /> :
                <div style={{ width: 92, height: 92, borderRadius: "50%", border: "2px dashed #D1D5DB", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>📷</div>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await resizeToDataUrl(f, 160, true)); }} />
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
                <button key={g} onClick={() => { setGender(g); setSchool(""); }} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${gender === g ? "#6FBFA0" : "#E5E7EB"}`, background: gender === g ? "#EBF7F1" : "white", color: gender === g ? "#3D7A63" : "#6B7280", fontWeight: 700 }}>{g}</button>
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

          <button disabled={!canSave} onClick={() => onSave({ name: name.trim(), grade, section, gender, school, governorate: gov, photo })} style={{ padding: 14, borderRadius: 12, background: "#6FBFA0", color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSave ? 1 : 0.4 }}>
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

function UploadView({ children, motherId, onClose, onDone }) {
  const [school, setSchool] = useState("");
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef();
  const schoolsOfChildren = [...new Set(children.map((c) => c.school))];

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const urls = await Promise.all(files.map((f) => resizeToDataUrl(f)));
    setImages((prev) => [...prev, ...urls]);
  }

  async function run() {
    setStatus("loading");
    try {
      const res = await fetch("/api/upload-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId, school, images }) });
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
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>رفع الجدول</p>
      </div>
      <div className="app-scroll" style={{ padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 700 }}>هذي الصور من مدرسة:</label>
          <select value={school} onChange={(e) => setSchool(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
            <option value="">— اختاري —</option>
            {schoolsOfChildren.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
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
        <button disabled={!school || images.length === 0 || status === "loading"} onClick={run} style={{ padding: 13, borderRadius: 12, background: "#6FBFA0", color: "white", fontWeight: 800, opacity: (!school || images.length === 0) ? 0.4 : 1 }}>
          {status === "loading" ? "جاري التحليل والفرز..." : "تحليل وتوزيع الواجبات"}
        </button>
        {status === "done" && summary && (
          <div style={{ background: "#F0FDF4", color: "#166534", borderRadius: 12, padding: 12, fontSize: 13 }}>
            تم تحليل {summary.imagesProcessed} صورة ✓ — أُضيف {summary.matchedTasks} واجب/اختبار و {summary.matchedReqs} طلب مستلزمات.
            {summary.skippedOld > 0 && (
              <div style={{ marginTop: 6, opacity: 0.85 }}>تم تجاهل {summary.skippedOld} عنصر لأن تاريخه فات (صورة قديمة).</div>
            )}
          </div>
        )}
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
