// حارس الإصلاحات الأمنية (فحص ١٢ نوفمبر ٢٠٢٦).
// التشغيل: node scripts/security_test.mjs
//
// يفحص نص المصدر لا سلوك الخادم: الأربعة كلها قواعد بنيوية («ما يطلع هذا
// للعميل»، «ما يُقرأ هذا من جسم الطلب») — وهذي يمسكها الفحص الساكن بدقة
// أعلى من اختبار يحتاج قاعدة بيانات وجلسة.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ck = (name, cond, debug) => {
  if (cond) { pass++; console.log("✓ " + name); }
  else { fail++; console.log("✗ " + name + (debug ? "\n    → " + debug : "")); }
};
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

// ————— ١) بصمة الرقم السري ما تطلع للعميل —————
const authRoutes = [
  "app/api/auth/login-password/route.js",
  "app/api/auth/signup/route.js",
  "app/api/auth/verify-otp/route.js",
];
const authPw = read("lib/authPassword.js");

// فحص سلوكي لا نصّي: نعطيها صفاً حقيقياً بكل أعمدة `mothers` ونشوف وش يطلع.
const { publicMother } = await import("../lib/authPassword.js");
const fullRow = {
  id: "m1", name: "ريم", phone: "+96512345678", created_at: "2026-01-01",
  paid_for_count: 2, paid_through: "2027-01-01", paid_academic_year: "2026/2027",
  last_seen_at: "2026-11-12", trial_schedule_used: true, trial_plan_used: true,
  password_hash: "ab12:cd34deadbeef", failed_login_attempts: 3,
  login_locked_until: "2026-11-12T10:00:00Z", family_id: "f1", family_role: "primary",
};
const out = publicMother(fullRow);
ck("البصمة ما تطلع فعلياً", !("password_hash" in out), JSON.stringify(out));
ck("عدّاد المحاولات ووقت القفل ما يطلعان",
  !("failed_login_attempts" in out) && !("login_locked_until" in out));
ck("بيانات الاشتراك ما تطلع",
  !("paid_through" in out) && !("paid_for_count" in out) && !("trial_plan_used" in out));
ck("الثلاثة اللي تحتاجها الواجهة تطلع",
  out.id === "m1" && out.name === "ريم" && out.phone === "+96512345678");
ck("عمود جديد بالجدول ما يتسرّب تلقائياً",
  Object.keys(publicMother({ ...fullRow, secret_new_column: "x" })).length === 3);
ck("publicMother تتحمّل null", publicMother(null) === null);

ck("publicMother قائمة بيضاء لا حذف من السوداء",
  /return\s*\{\s*id:\s*row\.id,\s*name:\s*row\.name,\s*phone:\s*row\.phone\s*\}/.test(authPw),
  "لازم تعدّد الأعمدة المسموحة صراحةً — الحذف يخلي أي عمود جديد يتسرب تلقائياً");

ck("publicMother ما ترجّع البصمة", !/password_hash/.test(
  authPw.slice(authPw.indexOf("export function publicMother"), authPw.indexOf("const MAX_ATTEMPTS"))));

for (const p of authRoutes) {
  const src = read(p);
  const name = p.split("/").slice(-2)[0];
  // كل رد فيه `mother` لازم يمر بـpublicMother
  const responses = [...src.matchAll(/NextResponse\.json\(\{[^}]*\bmother\b[^}]*\}/g)].map((m) => m[0]);
  ck(`${name}: يرد بـmother واحدة على الأقل`, responses.length >= 1);
  ck(`${name}: كل رد يمر بـpublicMother`,
    responses.every((r) => /mother:\s*publicMother\(/.test(r)),
    responses.filter((r) => !/publicMother/.test(r)).join(" | "));
  ck(`${name}: ما يرجّع الصف الخام`, !/\bmother,\s*token\b/.test(src) && !/mother:\s*data\b/.test(src));
}

// verify-otp لازم يبقى يقرأ البصمة **داخلياً** لحساب needsPassword
ck("verify-otp يحسب needsPassword بالخادم من البصمة",
  /needsPassword:\s*!mother\.password_hash/.test(read(authRoutes[2])));

// ————— ٢) ترويسات الأمان —————
const cfg = read("next.config.js");
for (const [h, v] of [
  ["Content-Security-Policy", "frame-ancestors 'none'"],
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Strict-Transport-Security", "max-age=63072000"],
]) {
  ck(`ترويسة ${h}`, cfg.includes(h) && cfg.includes(v));
}
ck("الترويسات على كل المسارات", /source:\s*"\/:path\*",\s*headers:\s*SECURITY_HEADERS/.test(cfg));

// الفحوص التالية «ما فيه كذا» — فلازم تشيل التعليقات أولاً، وإلا أعطت
// إنذاراً كاذباً على شرح يقول **ليش** ما استخدمناها. (صار فعلاً أول تشغيل.)
const code = cfg.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ck("HSTS بلا preload (قرار صريح لا سطر إعدادات)", !/preload/.test(code));
// الكاميرا والرفع ما ينكسران
ck("ما فيه Permissions-Policy يقيّد الكاميرا", !/Permissions-Policy/.test(code));
ck("ما فيه script-src/style-src يكسر الأنماط السطرية",
  !/script-src|style-src/.test(code));
// وتخزين ملف المدارس ما انشال مع التعديل
ck("تخزين schools.json باقٍ", /schools\.json/.test(cfg) && /max-age=86400/.test(cfg));

// ————— ٣) ولا مسار يرتد لجسم الطلب بالهوية —————
import { readdirSync, statSync } from "node:fs";
const routes = [];
(function walk(dir) {
  for (const e of readdirSync(new URL("../" + dir, import.meta.url))) {
    const sub = dir + "/" + e;
    if (statSync(new URL("../" + sub, import.meta.url)).isDirectory()) walk(sub);
    else if (e === "route.js") routes.push(sub);
  }
})("app/api");

const fallbacks = routes.filter((p) =>
  /x-mother-id"\s*\)\s*\|\|/.test(read(p)));
ck(`ولا مسار يرتد لجسم الطلب بالهوية (فُحص ${routes.length} مساراً)`,
  fallbacks.length === 0, fallbacks.join(", "));

// والمسارات اللي تلمس بيانات طالب لازم تقرأ الهوية من الترويسة الموثوقة
const trusted = routes.filter((p) => /x-mother-id/.test(read(p)));
ck(`الهوية من الترويسة الموثوقة بـ${trusted.length} مساراً`, trusted.length >= 25);

// ————— ٤) نوع الصورة من القائمة البيضاء —————
for (const p of ["lib/uploadSources.js", "lib/attachments.js"]) {
  const src = read(p);
  const name = p.split("/").pop();
  ck(`${name}: النوع من EXT لا من الطلب`, /const mime = EXT\[raw\] \? raw : "image\/jpeg"/.test(src));
  ck(`${name}: يطبّع الحالة قبل الفحص`, /\.toLowerCase\(\)/.test(src));
  ck(`${name}: EXT ما فيه svg`, !/svg/i.test(src.slice(0, src.indexOf("function decodeDataUrl"))));
}

// ————— ما انكسر شي من الحراس القديمة —————
const mw = read("middleware.js");
ck("الحارس يكتب فوق x-mother-id (ما يثق بترويسة العميل)",
  /headers\.set\("x-mother-id",\s*sessionMotherId\)/.test(mw));
ck("الحارس يرفض motherId مخالف بالرابط", /requested !== sessionMotherId/.test(mw));
ck("الكرونات تفرض CRON_SECRET",
  ["recitation", "reminders", "evening", "meeting"].every((c) =>
    read(`app/api/cron/${c}/route.js`).includes("CRON_SECRET")));

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} نجحت، ${fail} فشلت`);
process.exit(fail === 0 ? 0 : 1);
