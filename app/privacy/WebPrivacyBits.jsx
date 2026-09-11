"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";

// فقرات تخص الدفع بالبطاقة — لمستخدمات الموقع وحدهن.
//
// ما تظهر داخل التطبيق: بند آبل 3.1.1 يمنع توجيه مستخدم التطبيق لوسيلة شراء
// خارج المتجر، وصفحة الخصوصية مفتوحة من داخل التطبيق. والفحص بالمتصفح مو
// بالخادم لأن التطبيق يحمّل نفس الموقع بلا ترويسة مميزة (نفس ما بصفحة الشروط).
function useWebOnly() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_WEB_PAYMENTS !== "true") return;
    setShow(!isNativeApp());
  }, []);
  return show;
}

// بوابة الدفع تُضاف لقائمة الأطراف: بياناتك تمر بها فعلاً وقت الدفع.
export function WebPaymentProvider() {
  if (!useWebOnly()) return null;
  return (
    <li style={{ marginBottom: 6 }}>
      <strong>Tap Payments</strong> — معالجة الدفع بالبطاقة عند الاشتراك من الموقع.
    </li>
  );
}

export function WebPaymentNote() {
  if (!useWebOnly()) return null;
  return (
    <p style={{ margin: "0 0 10px" }}>
      أما الاشتراك من الموقع على المتصفح فيتم بالبطاقة عبر بوابة الدفع <strong>Tap</strong>. تُدخلين بيانات بطاقتك
      في صفحة Tap نفسها، ولا تمر بخوادمنا إطلاقاً — كل ما يصلنا منها رقم العملية ومبلغها وحالتها (ناجحة أو لا).
    </p>
  );
}
