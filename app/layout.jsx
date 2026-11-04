import "./globals.css";
import { Tajawal } from "next/font/google";

// الخط كان ينزل من قوقل بوسم <link> **حاجب للرسم**: قياس ٤ نوفمبر على
// 3G ضعيف أعطى ١٤٠٩ ms لطلب الخط وحده وأول رسم ١٩٥٢ ms. وفوقه ما كان فيه
// `preconnect` لـ`fonts.gstatic.com` — وهو مصدر ملفات الخط نفسها — فتنفتح
// وصلة ثانية كاملة (DNS + TCP + TLS) على المسار الحرج.
//
// `next/font` ينزّل الخط **وقت البناء** ويستضيفه معنا، فيصير من نفس الأصل
// بلا مصدر ثالث ولا وصلة زايدة، ويحشر `@font-face` بالصفحة مع preload
// تلقائي. الأوزان الأربعة هي نفسها اللي كانت بالوسم، لا أقل ولا أكثر.
// و`preload: false` **بقياس لا بتفضيل**: التحميل المسبق يطلب أوزان الخط
// الأربعة بأعلى أولوية، فيزاحم حزمة الجافاسكربت على نفس النطاق. على 3G
// ضعيف قيس: أول رسم تحسّن لكن **الشاشة الرئيسية تأخرت ٨٤٢ ms** لأن الخط
// سبق الكود. وبلا تحميل مسبق ياخذ أولوية عادية، و`display: swap` يرسم
// بالخط البديل فوراً ثم يبدله.
//
// وفوق هذا: داخل تطبيق آبل تغلب `.ios-native` العائلة إلى SF Arabic
// (globals.css) — يعني Tajawal كان **ينزل وما يُعرض أبداً** لأكبر مجموعة
// مستخدمين عندنا. وبلا تحميل مسبق ما ينزل إلا لو احتاجه عنصر فعلاً.
const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  preload: false,
  variable: "--font-tajawal",
});

export const metadata = {
  title: "دفتري — متابعة واجبات العيال",
  description: "متابعة واجبات واختبارات العيال بدون تعقيد",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <head>
        {/* بدون maximum-scale عشان ما نمنع تكبير الصفحة — كل الحقول 16px فما يصير
            تكبير تلقائي عند الكتابة، والتكبير اليدوي يبقى متاح لضعاف البصر. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="دفتري" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#B7A6E8" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
