"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// الأرقام وقائمة المشتركين تُرسم بالخادم مرة وحدة عند فتح الصفحة، وأزرار
// «تحديث» بالأقسام تحدّث قسمها وحده. بدون هذا الزر ما فيه طريقة تحدّثين
// بها الأرقام إلا إعادة تحميل الصفحة كاملة.
export default function RefreshPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    router.refresh();
    // router.refresh لا ترجّع وعداً ينتهي بانتهاء الجلب، فنعطي مهلة قصيرة
    // للمؤشر بدل ما يعلق «جاري...» للأبد.
    setTimeout(() => setBusy(false), 1200);
  }

  return (
    <button
      onClick={refresh}
      disabled={busy}
      style={{ background: "#F3F4F6", color: "#5C4B8C", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, opacity: busy ? 0.6 : 1 }}
    >
      {busy ? "جاري التحديث..." : "تحديث الأرقام"}
    </button>
  );
}
