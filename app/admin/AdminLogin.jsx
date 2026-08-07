"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الدخول");
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#F7F5FC,#F1EFFA)", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 360, background: "white", borderRadius: 20, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 20, color: "#5C4B8C", textAlign: "center", fontWeight: 800 }}>لوحة تحكم دفتري</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>دخول المشرف فقط</p>
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>البريد الإلكتروني</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 14, marginBottom: 14 }} />
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>كلمة المرور</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 14, marginBottom: 16 }} />
        {error && <p style={{ color: "#B91C1C", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <button disabled={loading} type="submit" style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, border: "none", opacity: loading ? 0.6 : 1 }}>
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
