/** @type {import('next').NextConfig} */
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
    ];
  },
};
module.exports = nextConfig;
