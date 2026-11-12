/** @type {import('next').NextConfig} */

// ترويسات أمان على كل رد (فحص ١٢ نوفمبر: ما كان فيه ولا وحدة).
//
// **المقصود عملياً هو منع التأطير**: التطبيق فيه أفعال مدمّرة بضغطة وحدة
// (حذف الحساب، `reset-year`، «امسح المنجز»)، فصفحة خبيثة تقدر تحمّل دفتري
// بإطار شفاف وتخلي الأم تضغط عليها وهي تظن إنها تضغط شي ثاني. وفُحص إن
// التطبيق ما يستخدم أي `iframe` بنفسه، وCapacitor يحمّل الصفحة كمستند
// أعلى لا داخل إطار — فالمنع ما يكسر شيئاً.
//
// `frame-ancestors` هي النسخة الحديثة و`X-Frame-Options` للمتصفحات الأقدم
// (حدّنا الأدنى iOS 15).
//
// **بلا `script-src`/`style-src` بالقصد**: الواجهة كلها أنماط سطرية
// (`style={{...}}`) وNext يحقن سكربتات ترطيب سطرية، فسياسة متشددة تكسر
// التطبيق كله. وما فيه منفذ XSS أصلاً (صفر `dangerouslySetInnerHTML`،
// صفر `innerHTML` — فُحص)، فالمكسب من تشديدها الحين أقل بكثير من خطره.
// لو انضاف يوم منفذ HTML غير موثوق، تنكتب السياسة الكاملة وقتها وتُختبر.
//
// **وبلا `Permissions-Policy`**: الرفع يمر بالكاميرا عبر إضافة Capacitor
// الأصلية و`<input type="file">`، وأي تضييق هنا خطره يكسر الرفع أكبر من
// نفعه — وما فيه استخدام لـ`getUserMedia` يستاهل الحماية (فُحص).
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // المتصفح ما يخمّن نوع الملف من محتواه — يلتزم بـContent-Type المرسل.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // ما نسرّب المسار الكامل (وفيه معرّفات) لأي موقع خارجي نروح له.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HTTPS إلزامي لسنتين. بلا `preload` بالقصد: الإدراج بقائمة المتصفحات
  // صعب التراجع عنه، ويُطلب بقرار صريح لا بسطر بملف إعدادات.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  async headers() {
    return [
      {
        // ملف المدارس بيانات ثابتة تتغيّر مرة بالسنة، وكان يُنزَّل **بكل
        // فتحة** للتطبيق (`Cache-Control: public, max-age=0` الافتراضي
        // لملفات `public/`) — ٣٣ KB بلا أي داعي، وعلى 3G ضعيف قيست
        // ٦٥٧ ms. يوم واحد كافي: مدرسة جديدة تتأخر يوماً ولا شي.
        source: "/schools.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      { source: "/:path*", headers: SECURITY_HEADERS },
    ];
  },
};
module.exports = nextConfig;
