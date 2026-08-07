"use client";

export default function AdminLogoutButton() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }
  return (
    <button onClick={logout} style={{ background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 13, padding: "8px 14px", borderRadius: 10, border: "none" }}>
      خروج
    </button>
  );
}
