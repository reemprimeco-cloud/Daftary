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
  const [mothersRes, childrenRes, activeTasksRes, scheduleRes, recentMothersRes, allChildrenRes] = await Promise.all([
    sb.from("mothers").select("*", { count: "exact", head: true }),
    sb.from("children").select("*", { count: "exact", head: true }),
    sb.from("tasks").select("*", { count: "exact", head: true }).eq("status", "active"),
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
    withSchedule,
    recentMothers: (recentMothersRes.data || []).map((m) => ({ ...m, childrenCount: childrenByMother[m.id] || 0 })),
    usage: await getUsage(sb, childrenRes.count || 0),
  };
}

// استهلاك الذكاء الاصطناعي الفعلي — الأساس اللي نسعّر عليه الاشتراك.
async function getUsage(sb, childrenCount) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [allRes, monthRes] = await Promise.all([
    sb.from("ai_usage").select("feature,cost_usd,child_id,created_at"),
    sb.from("ai_usage").select("cost_usd").gte("created_at", since),
  ]);
  const rows = allRes.data || [];
  if (!rows.length) return null;

  const byFeature = {};
  const children = new Set();
  let total = 0;
  for (const r of rows) {
    const c = Number(r.cost_usd) || 0;
    byFeature[r.feature] = byFeature[r.feature] || { calls: 0, cost: 0 };
    byFeature[r.feature].calls++;
    byFeature[r.feature].cost += c;
    total += c;
    if (r.child_id) children.add(r.child_id);
  }

  const month = (monthRes.data || []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const firstAt = rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), rows[0].created_at);
  const days = Math.max(1, (Date.now() - new Date(firstAt)) / 86400000);

  // نقسم على الطلاب اللي استهلكوا فعلاً — القسمة على كل المسجّلين تخفي
  // التكلفة الحقيقية للمستخدم النشط، وهي اللي يهمنا نسعّر عليها.
  const activeChildren = children.size || 1;
  return {
    total,
    month,
    days: Math.round(days),
    calls: rows.length,
    activeChildren,
    childrenCount,
    perChildYear: (total / activeChildren) * (270 / days), // ٩ أشهر دراسية
    byFeature: Object.entries(byFeature)
      .map(([feature, v]) => ({ feature, ...v, perCall: v.cost / v.calls }))
      .sort((a, b) => b.cost - a.cost),
  };
}

const FEATURE_LABELS = {
  ai_teacher: "المعلم الذكي",
  upload_homework: "رفع الواجبات",
  upload_class_schedule: "رفع جدول الحصص",
};

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

const usd = (n) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const kwd = (n) => `${(n * 0.307).toFixed(2)} د.ك`; // تقريبي، للمقارنة بسعر الاشتراك

function UsageSection({ usage }) {
  if (!usage) {
    return (
      <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16, color: "#5C4B8C" }}>استهلاك الذكاء الاصطناعي</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
          ما فيه بيانات بعد. الأرقام تبدأ بالتجمّع مع أول استخدام للمعلم الذكي أو رفع الصور.
        </p>
      </div>
    );
  }
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#5C4B8C" }}>استهلاك الذكاء الاصطناعي</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9CA3AF" }}>
        {usage.calls} استدعاء خلال {usage.days} يوم · {usage.activeChildren} طالب/ة استخدموا الميزات فعلياً
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <StatCard label="الإجمالي" value={usd(usage.total)} color={{ bg: "#F1EFFA", text: "#5C4B8C" }} />
        <StatCard label="آخر ٣٠ يوم" value={usd(usage.month)} color={{ bg: "#FDF3E7", text: "#8C6027" }} />
        <StatCard label="للطالب/ة بالعام الدراسي" value={kwd(usage.perChildYear)} color={{ bg: "#EBF7F1", text: "#2F6E56" }} />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "right", color: "#9CA3AF", fontSize: 12 }}>
            <th style={{ padding: "8px 10px" }}>الميزة</th>
            <th style={{ padding: "8px 10px" }}>عدد الاستخدامات</th>
            <th style={{ padding: "8px 10px" }}>تكلفة الاستخدام</th>
            <th style={{ padding: "8px 10px" }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {usage.byFeature.map((f) => (
            <tr key={f.feature} style={{ borderTop: "1px solid #F3F4F6" }}>
              <td style={{ padding: "10px", fontWeight: 700 }}>{FEATURE_LABELS[f.feature] || f.feature}</td>
              <td style={{ padding: "10px" }}>{f.calls}</td>
              <td style={{ padding: "10px", color: "#6B7280" }}>{usd(f.perCall)}</td>
              <td style={{ padding: "10px", fontWeight: 700 }}>{usd(f.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ margin: "12px 0 0", fontSize: 11, color: "#9CA3AF", lineHeight: 1.7 }}>
        «للطالب/ة بالعام الدراسي» تقدير: متوسط التكلفة للطالب النشط مضروباً في ٩ أشهر.
        كل ما طالت فترة القياس صار الرقم أدق — وبفترة قصيرة يتأثر كثيراً بأيام الذروة.
      </p>
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
          <StatCard label="عندهم جدول حصص" value={stats.withSchedule} color={{ bg: "#EBF4FA", text: "#31607C" }} />
        </div>

        <UsageSection usage={stats.usage} />

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
                  <td dir="ltr" style={{ padding: "10px 12px", color: "#6B7280", textAlign: "right" }}>{m.phone}</td>
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
      </div>
    </div>
  );
}
