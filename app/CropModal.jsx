"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "cropperjs/dist/cropper.css";

// شاشة قص بعد التصوير: الأم تحدد السؤال فقط بدل الصفحة كلها، فيقرأ المعلم
// المطلوب بدقة أعلى ولا يتشتت بباقي الصفحة. تشتغل بالويب وداخل التطبيق
// (لمس وسحب) بلا أي إضافة أصلية، والقص يتم على الجهاز.
export default function CropModal({ src, onDone, onCancel }) {
  const imgRef = useRef(null);
  const cropperRef = useRef(null);
  const [ready, setReady] = useState(false);
  // الشاشة كانت تُرسم داخل منطقة تمرير التطبيق، فشريط التبويبات (بطبقة
  // أعلى) يغطي أزرارها بالأسفل. نرسمها على body مباشرة فوق كل شيء.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // الصورة ما تُرسم قبل mounted (بسبب الـportal)، فلازم نعيد المحاولة بعده
    if (!mounted) return;
    let cancelled = false;
    let instance = null;
    (async () => {
      const { default: Cropper } = await import("cropperjs");
      if (cancelled || !imgRef.current) return;
      instance = new Cropper(imgRef.current, {
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 0.7,
        background: false,
        responsive: true,
        checkOrientation: false,
        ready: () => setReady(true),
      });
      cropperRef.current = instance;
    })();
    return () => {
      cancelled = true;
      instance?.destroy();
      cropperRef.current = null;
    };
  }, [src, mounted]);

  function useSelection() {
    const c = cropperRef.current;
    if (!c) return;
    // نفس سقف دقة الرفع (١٥٦٨) عشان الجزء المقصوص يوصل بأعلى وضوح ممكن.
    const canvas = c.getCroppedCanvas({ maxWidth: 1568, maxHeight: 1568, imageSmoothingQuality: "high" });
    onDone(canvas.toDataURL("image/jpeg", 0.9));
  }

  if (!mounted) return null;
  return createPortal(
    <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#111", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "calc(env(safe-area-inset-top) + 12px) 16px 10px", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>حدّدي السؤال</p>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,.12)", color: "white", borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>إلغاء</button>
      </div>
      <p style={{ margin: "0 16px 8px", color: "#C7C2D4", fontSize: 12, lineHeight: 1.6 }}>
        اسحبي الإطار وكبّريه أو صغّريه من أطرافه لين يغطي السؤال فقط.
      </p>
      {/* cropperjs ياخذ مقاس الحاوية من ارتفاعها الفعلي — وبداخل flex الارتفاع
          النسبي يصير auto فتتمدد الحاوية على طول الصورة (١٥٦٨ بكسل) وتدفع
          الأزرار تحت الشاشة. الحاوية المطلقة داخل عنصر نسبي تعطيه ارتفاعاً
          محدداً = المساحة المتبقية بالضبط. */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", margin: "0 8px", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img ref={imgRef} src={src} alt="" style={{ display: "block", maxWidth: "100%", maxHeight: "100%" }} />
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", gap: 8, padding: "10px 16px calc(env(safe-area-inset-bottom) + 12px)" }}>
        <button onClick={() => onDone(src)} style={{ flex: 1, background: "rgba(255,255,255,.12)", color: "white", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700 }}>
          الصفحة كاملة
        </button>
        <button onClick={useSelection} disabled={!ready} style={{ flex: 2, background: "#B7A6E8", color: "white", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 800, opacity: ready ? 1 : 0.5 }}>
          استخدمي المحدد ✓
        </button>
      </div>
    </div>,
    document.body
  );
}
