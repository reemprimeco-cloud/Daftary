import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import AdminLogin from "./AdminLogin";
import AdminLogoutButton from "./AdminLogoutButton";

export const dynamic = "force-dynamic";

function isAuthed() {
  const token = cookies().get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

async function getStats() {
  const sb = supabaseAdmin();
  const [mothersRes, childrenRes, activeTasksRes, telegramRes, scheduleRes, recentMothersRes, allChildrenRes] = await Promise.all([
    sb.from("mothers").select("*", { count: "exact", head: true }),
    sb.from("children").select("*", { count: "exact", head: true }),
    sb.from("tasks").select("*", { count: "exact", head: true }).eq("status", "active"),
    sb.from("mothers").select("*", { count: "exact", head: true }).not("telegram_chat_id", "is", null),
    sb.from("class_schedule").select("child_id"),
    sb.from("mothers").select("id,name,phone,created_at").order("created_at", { ascending: false }).limit(25),
    sb.from("children").select("mother_id"),
  ]);

  const withSchedule = new Set((scheduleRes.data || []).map((r) => r.child_id)).size;
  const childrenByMother = {};
  (allChildrenRes.data || []).forEach((c) => {
    childrenByMother[c.mother_id] = (childrenByMother[c.mother_id] || 0) + 1;
  });

  return {
    mothersCount: mothersRes.count || 0,
    childrenCount: childrenRes.count || 0,
    activeTasks: activeTasksRes.count || 0,
    telegramLinked: telegramRes.count || 0,
    withSchedule,
    recentMothers: (recentMothersRes.data || []).map((m) => ({ ...m, childrenCount: childrenByMother[m.id] || 0 })),
  };
}

export default async function AdminPage() {
  if (!isAuthed()) return <AdminLogin />;
  const stats = await getStats();
  return <AdminDashboard stats={stats} />;
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: color.bg, borderRadius: 16, padding: 16, flex: "1 1 140px" }}>
      <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.8, fontWeight: 700 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 26, color: color.text, fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("ar-KW", { day: "numeric", month: "short", year: "numeric" });
}

function AdminDashboard({ stats }) {
  return (
    <div dir="rtl" className="app-scroll" style={{ minHeight: "100%", background: "#FAF7F2", padding: "24px 16px calc(env(safe-area-inset-bottom) + 24px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: "#5C4B8C", fontWeight: 800 }}>لوحة تحكم دفتري</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>نظرة عامة على استخدام التطبيق</p>
          </div>
          <AdminLogoutButton />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          <StatCard label="أولياء الأمور المسجّلين" value={stats.mothersCount} color={{ bg: "#F1EFFA", text: "#5C4B8C" }} />
          <StatCard label="الطلاب المسجّلين" value={stats.childrenCount} color={{ bg: "#EBF7F1", text: "#2F6E56" }} />
          <StatCard label="واجبات نشطة" value={stats.activeTasks} color={{ bg: "#FDF3E7", text: "#8C6027" }} />
          <StatCard label="مرتبطين بتيليجرام" value={stats.telegramLinked} color={{ bg: "#FDEFF3", text: "#8C4E62" }} />
          <StatCard label="عندهم جدول حصص" value={stats.withSchedule} color={{ bg: "#EBF4FA", text: "#31607C" }} />
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 4, boxShadow: "0 1px 3px rgba(0,0,0,.06)", marginBottom: 20, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#9CA3AF", fontWeight: 700, fontSize: 12 }}>الاسم</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#9CA3AF", fontWeight: 700, fontSize: 12 }}>الجوال</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#9CA3AF", fontWeight: 700, fontSize: 12 }}>الطلاب</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#9CA3AF", fontWeight: 700, fontSize: 12 }}>تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentMothers.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{m.name}</td>
                  <td style={{ padding: "10px 12px", color: "#6B7280" }}>{m.phone}</td>
                  <td style={{ padding: "10px 12px", color: "#6B7280" }}>{m.childrenCount}</td>
                  <td style={{ padding: "10px 12px", color: "#6B7280" }}>{fmtDate(m.created_at)}</td>
                </tr>
              ))}
              {stats.recentMothers.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>ما فيه مستخدمين بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)", textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#374151" }}>💳 التحكم بالمدفوعات</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9CA3AF" }}>قريباً — لسا ما فيه نظام دفع مربوط بالتطبيق</p>
        </div>
      </div>
    </div>
  );
}
