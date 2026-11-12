// حارس «تم» بالخطة الأسبوعية (شكوى ١٢ نوفمبر).
// التشغيل: npx next build && npx next start -p 3499 &
//          node scripts/checkbox_test.cjs scripts/perf_fixture.json
//
// القاعدة اللي يحرسها: **العلامة تبيّن بلحظتها مهما بطأت الشبكة.**
// قبل الإصلاح كانت مهلة الـ٧٠٠ ms تبدأ من الضغطة والعلامة تنرسم بعد رد
// الخادم، فالشبكة تاكل المهلة — ورد ٩٠٠ ms ما يخلي للعلامة ولا لحظة.
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3499";
const DASH = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));

let pass = 0, fail = 0;
const ck = (n, c, d) => { if (c) { pass++; console.log("✓ " + n); } else { fail++; console.log("✗ " + n + (d ? "  → " + d : "")); } };

async function run(browser, { delay, failRequest }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await ctx.newPage();
  await ctx.addInitScript(() => {
    localStorage.setItem("daftary_mother", JSON.stringify({ id: "m1", name: "ريم" }));
    localStorage.setItem("daftary_token", "t");
  });
  const alerts = [];
  p.on("dialog", (d) => { alerts.push(d.message()); d.accept(); });
  await p.route("**/*", async (r) => {
    const u = r.request().url();
    if (/\/api\/tasks\/[^/?]+\/done/.test(u)) {
      await new Promise((x) => setTimeout(x, delay));
      return failRequest ? r.fulfill({ status: 500, json: { error: "x" } }) : r.fulfill({ json: { ok: true } });
    }
    if (u.includes("/api/dashboard")) return r.fulfill({ json: DASH });
    if (u.includes("/api/subscription/app-access/status")) return r.fulfill({ json: { allowed: true, phase: "off" } });
    if (u.includes("/api/broadcasts/latest")) return r.fulfill({ json: { broadcast: null } });
    if (u.includes("/api/")) return r.fulfill({ json: {} });
    return r.continue();
  });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('button:has-text("المعلم الذكي")');

  const probe = () => p.evaluate(() => {
    const title = [...document.querySelectorAll("p")].find((x) => x.textContent.trim().startsWith("رياضيات"));
    if (!title) return { rowVisible: false, pressed: null, struck: false };
    const row = title.closest("div[style*='border-top']") || title.closest("div").parentElement.parentElement;
    const cb = row ? row.querySelector("button[aria-pressed]") : null;
    return { rowVisible: true, struck: getComputedStyle(title).textDecorationLine.includes("line-through"), pressed: cb ? cb.getAttribute("aria-pressed") : null };
  });

  const t0 = Date.now();
  const frames = [];
  const watch = setInterval(async () => { try { frames.push({ t: Date.now() - t0, ...(await probe()) }); } catch {} }, 50);
  await p.evaluate(() => {
    const title = [...document.querySelectorAll("p")].find((x) => x.textContent.trim().startsWith("رياضيات"));
    const row = title.closest("div[style*='border-top']") || title.closest("div").parentElement.parentElement;
    row.querySelector("button[aria-pressed]").click();
  });
  await p.waitForTimeout(delay + 1800);
  clearInterval(watch);
  const final = await probe();
  await ctx.close();

  const marked = frames.filter((f) => f.rowVisible && (f.struck || f.pressed === "true"));
  return { marked, firstMark: marked[0]?.t ?? null, markedMs: marked.length * 50, final, alerts };
}

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });

  // ١) العلامة تبيّن فوراً مهما بطأت الشبكة
  for (const delay of [150, 900, 2000]) {
    const r = await run(b, { delay, failRequest: false });
    ck(`رد ${delay} ms: العلامة تبيّن بأول ٢٠٠ ms`,
      r.firstMark !== null && r.firstMark <= 200, `أول ظهور: ${r.firstMark}`);
    ck(`رد ${delay} ms: تبقى معلَّمة ≥ ٤٠٠ ms قبل ما تغادر`,
      r.markedMs >= 400, `${r.markedMs} ms`);
    ck(`رد ${delay} ms: ولا رسالة خطأ`, r.alerts.length === 0, r.alerts.join(" | "));
  }

  // ٢) الفشل يرجّع الصف مكانه ويقول السبب — ما ينحذف بصمت
  const f = await run(b, { delay: 300, failRequest: true });
  ck("الفشل: الصف يرجع ظاهراً غير معلَّم", f.final.rowVisible && f.final.pressed === "false",
    JSON.stringify(f.final));
  ck("الفشل: تطلع رسالة تقول إنه ما انحفظ", f.alerts.some((a) => /تعذّر/.test(a)), f.alerts.join(" | "));

  await b.close();
  console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} نجحت، ${fail} فشلت`);
  process.exit(fail === 0 ? 0 : 1);
})();
