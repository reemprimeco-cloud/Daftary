// قياس أداء متكرر — الشاشة الرئيسية على أجهزة وشبكات بطيئة.
//
// التشغيل:
//   npx next build && npx next start -p 3499 &
//   node scripts/perf_test.cjs "اسم القياس" scripts/perf_fixture.json
//
// ليش بمتصفح حقيقي وبتكرارات ووسيط: الفرق بين رفعتين يطلع بالضجيج لو
// قسنا مرة وحدة — التشتت المقيس ±٣٪، فأي «تحسين» أقل منه ما هو تحسيناً.
//
// والمسارات مردودة من ملف ثابت بكلفة شبكة مُضافة: نبي نقيس الواجهة لا
// سرعة قاعدة البيانات، وبنفس الرقم كل مرة.
//
// خط الأساس المسجّل (٤ نوفمبر ٢٠٢٦، بعد استضافة الخط ودمج مسارات اللوحة):
//   4G بطيء — أول رسم ٥٠٨ ms · الرئيسية ٢٤٧٦ ms · على السلك ٢٦١ KB
//   3G ضعيف — أول رسم ١٣٧٦ ms · الرئيسية ٦٥٩٦ ms · على السلك ٢٦١ KB

// فحص التشتت + البايتات الحقيقية على السلك.
// `transferSize` يرجّع صفراً لأي ملف من أصل ثانٍ (مصدر معتم)، فخط قوقل
// ما كان محسوباً بقياس «قبل» — ولهذا طلع الرقم أقل مما نُقل فعلاً.
// `Network.loadingFinished.encodedDataLength` من CDP يقيس المنقول الحقيقي
// للاثنين سواء، فهو الحكم.
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3499";
const DASH = JSON.parse(require("fs").readFileSync(process.argv[3], "utf8"));

async function one({ net, cpu }) {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => {
    localStorage.setItem("daftary_mother", JSON.stringify({ id: "m1", name: "ريم", phone: "+96500000000" }));
    localStorage.setItem("daftary_token", "t");
  });
  const apiCost = (url) => net.latency * 2 + (url.includes("/api/dashboard") ? 120 : 40);
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/")) await new Promise((r) => setTimeout(r, apiCost(url)));
    if (url.includes("/api/dashboard")) return route.fulfill({ json: DASH });
    if (url.includes("/api/subscription/app-access/status"))
      return route.fulfill({ json: { allowed: true, phase: "off", subscription: null } });
    if (url.includes("/api/broadcasts/latest")) return route.fulfill({ json: { broadcast: null } });
    if (url.includes("/api/")) return route.fulfill({ json: {} });
    if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
      await new Promise((r) => setTimeout(r, net.thirdPartyDelayMs));
      return route.continue();
    }
    return route.continue();
  });

  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  let wireBytes = 0, fontBytes = 0;
  const urlById = new Map();
  cdp.on("Network.requestWillBeSent", (e) => urlById.set(e.requestId, e.request.url));
  cdp.on("Network.loadingFinished", (e) => {
    wireBytes += e.encodedDataLength || 0;
    const u = urlById.get(e.requestId) || "";
    if (/\.woff2|fonts\.(googleapis|gstatic)/.test(u)) fontBytes += e.encodedDataLength || 0;
  });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });

  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "commit" });
  const fcp = await page.evaluate(() => new Promise((res) => {
    const s = performance.getEntriesByName("first-contentful-paint")[0];
    if (s) return res(s.startTime);
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") res(e.startTime); })
      .observe({ type: "paint", buffered: true });
    setTimeout(() => res(-1), 30000);
  }));
  let home = -1;
  try { await page.waitForSelector('button:has-text("المعلم الذكي")', { timeout: 40000 }); home = Date.now() - t0; } catch {}
  await page.waitForTimeout(1500); // نخلي الخط غير المحمّل مسبقاً يوصل عشان يُحسب
  await browser.close();
  return { fcp: Math.round(fcp), home, wireKB: Math.round(wireBytes / 1024), fontKB: Math.round(fontBytes / 1024) };
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

(async () => {
  const PROFILES = {
    "4G بطيء": { net: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8, thirdPartyDelayMs: 250 }, cpu: 4 },
    "3G ضعيف": { net: { latency: 400, down: 400e3 / 8, up: 400e3 / 8, thirdPartyDelayMs: 600 }, cpu: 6 },
  };
  const REPS = 3;
  console.log(`\n### ${process.argv[2]} — ${REPS} تكرارات، الوسيط ###`);
  for (const [name, cfg] of Object.entries(PROFILES)) {
    const runs = [];
    for (let i = 0; i < REPS; i++) runs.push(await one(cfg));
    const f = runs.map((r) => r.fcp), h = runs.map((r) => r.home);
    console.log(`\n  ${name}`);
    console.log(`    أول رسم      وسيط ${med(f)} ms   (${f.join(" / ")})`);
    console.log(`    الرئيسية     وسيط ${med(h)} ms   (${h.join(" / ")})`);
    console.log(`    على السلك    وسيط ${med(runs.map((r) => r.wireKB))} KB · منها خط ${med(runs.map((r) => r.fontKB))} KB`);
  }
})();
