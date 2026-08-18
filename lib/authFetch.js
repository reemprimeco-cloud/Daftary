"use client";

// نضيف ترويسة الجلسة تلقائياً لكل نداء يروح لـ /api — بدل ما نعدّل كل موضع
// نداء على حدة وننسى واحد. محصور على مسارات تطبيقنا فقط: أي نداء خارجي
// (صور، خطوط، أي نطاق ثاني) ما نلمسه ولا نسرّب له التوكن.
let installed = false;

export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const isOwnApi = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
    if (!isOwnApi) return original(input, init);

    const token = localStorage.getItem("daftary_token");
    if (!token) return original(input, init);

    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${token}`);
    return original(input, { ...init, headers });
  };
}
