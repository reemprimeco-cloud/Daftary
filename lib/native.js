"use client";

// جسر بسيط لمزايا الجهاز الأصلية (Capacitor) داخل تطبيق آبل.
// كل دالة هنا آمنة على الويب: لو التطبيق مفتوح بالمتصفح ترجع null/false
// بدون ما تكسر شي، عشان نفس الكود يخدم النسختين.

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return !!window.Capacitor?.isNativePlatform?.();
}

function plugin(name) {
  if (!isNativeApp()) return null;
  return window.Capacitor?.Plugins?.[name] || null;
}

// ————— تصغير الصور —————
// الكاميرا الأصلية ترجع صور بدقة عالية جداً؛ نصغّرها قبل الإرسال للتحليل
// عشان ما نتجاوز حد حجم الطلب ولا نستهلك باقة الإنترنت بدون داعي.
export function resizeDataUrl(dataUrl, maxSize = 1400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ————— الكاميرا ومعرض الصور —————
// source: "camera" للتصوير المباشر، "photos" للاختيار من الألبوم.
export async function nativePickImage(source = "camera") {
  const Camera = plugin("Camera");
  if (!Camera) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: "dataUrl",
      source: source === "camera" ? "CAMERA" : "PHOTOS",
      presentationStyle: "fullscreen",
    });
    if (!photo?.dataUrl) return null;
    return await resizeDataUrl(photo.dataUrl);
  } catch {
    // المستخدمة ألغت الالتقاط أو رفضت الإذن — مو خطأ نعرضه
    return null;
  }
}

// ————— الاهتزاز اللمسي —————
export function hapticSuccess() {
  plugin("Haptics")?.notification({ type: "SUCCESS" }).catch(() => {});
}
export function hapticLight() {
  plugin("Haptics")?.impact({ style: "LIGHT" }).catch(() => {});
}

// ————— المشاركة —————
export async function nativeShare({ title, text, url }) {
  const Share = plugin("Share");
  if (!Share) return false;
  try {
    await Share.share({ title, text, url, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

// ————— تذكيرات محلية على الجهاز —————
// تشتغل بدون إنترنت وبدون سيرفر: نجدول تنبيه الساعة ٤ عصراً قبل موعد
// كل اختبار بيوم، وبيوم تسليم كل واجب.
function idFromUuid(uuid) {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash * 31 + uuid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2000000000;
}

export async function syncTaskReminders(tasks) {
  const LocalNotifications = plugin("LocalNotifications");
  if (!LocalNotifications) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const asked = await LocalNotifications.requestPermissions();
      if (asked.display !== "granted") return;
    }

    // نلغي المجدول سابقاً عشان ما تتكرر التنبيهات بعد كل تحديث للبيانات
    const pending = await LocalNotifications.getPending();
    if (pending?.notifications?.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const now = Date.now();
    const notifications = [];

    for (const t of tasks) {
      if (!t.due_date || t.status !== "active") continue;
      const isExam = t.type === "اختبار";
      const target = new Date(`${t.due_date}T16:00:00+03:00`);
      if (isExam) target.setDate(target.getDate() - 1);
      if (target.getTime() <= now) continue;

      const childName = t.children?.name || "";
      notifications.push({
        id: idFromUuid(t.id),
        title: isExam ? "تذكير اختبار غداً 📚" : "واجب اليوم 📝",
        body: isExam
          ? `اختبار ${t.subject}${childName ? ` لـ${childName}` : ""} غداً — وقت المذاكرة`
          : `${t.subject}${childName ? ` لـ${childName}` : ""} — موعد التسليم اليوم`,
        schedule: { at: target },
      });
      if (notifications.length >= 60) break; // حد آمن دون سقف iOS (64)
    }

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch {
    // التذكيرات المحلية إضافة مساعدة — لا نوقف التطبيق لو فشلت
  }
}

// ————— السحب للتحديث —————
// نربطها بحاوية التمرير: لما تكون بأعلى القائمة والمستخدمة تسحب لتحت،
// نظهر مؤشّر ونستدعي onRefresh. ترجّع دالة لإلغاء الربط.
export function attachPullToRefresh(el, onRefresh, setPull) {
  if (!el) return () => {};
  const THRESHOLD = 70;
  let startY = null;
  let pulling = false;

  function onStart(e) {
    if (el.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }
  function onMove(e) {
    if (!pulling || startY === null) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0 || el.scrollTop > 0) {
      setPull(0);
      return;
    }
    // مقاومة تدريجية عشان الحركة تحس طبيعية زي آبل
    setPull(Math.min(delta * 0.5, THRESHOLD + 20));
  }
  async function onEnd() {
    if (!pulling) return;
    pulling = false;
    startY = null;
    let shouldRefresh = false;
    setPull((cur) => {
      shouldRefresh = cur >= THRESHOLD;
      return shouldRefresh ? THRESHOLD : 0;
    });
    if (shouldRefresh) {
      hapticLight();
      try {
        await onRefresh();
      } finally {
        setPull(0);
      }
    }
  }

  el.addEventListener("touchstart", onStart, { passive: true });
  el.addEventListener("touchmove", onMove, { passive: true });
  el.addEventListener("touchend", onEnd);
  el.addEventListener("touchcancel", onEnd);
  return () => {
    el.removeEventListener("touchstart", onStart);
    el.removeEventListener("touchmove", onMove);
    el.removeEventListener("touchend", onEnd);
    el.removeEventListener("touchcancel", onEnd);
  };
}

// ————— تهيئة عامة عند فتح التطبيق —————
export async function initNative() {
  if (!isNativeApp()) return;

  // يفعّل مظهر آبل الأصلي (خط SF، شريط تبويبات، قوائم مجمّعة…) — كل قواعده
  // بـ globals.css تحت .ios-native، فنسخة الويب تبقى بتصميمها الحالي.
  document.documentElement.classList.add("ios-native");

  try {
    await plugin("StatusBar")?.setStyle({ style: "LIGHT" });
    await plugin("StatusBar")?.setBackgroundColor({ color: "#F7F5FC" });
  } catch {}

  try {
    await plugin("SplashScreen")?.hide();
  } catch {}
}

// تسجيل الإشعارات الفورية (APNs) — يتطلب حساب مطوّر آبل مفعّل.
// نرجّع الرمز لو نجح التسجيل عشان يُحفظ بالسيرفر.
export function registerPushNotifications(onToken) {
  const Push = plugin("PushNotifications");
  if (!Push) return;

  Push.addListener("registration", (token) => {
    if (token?.value) onToken(token.value);
  });
  Push.addListener("registrationError", () => {});

  Push.checkPermissions()
    .then((perm) => (perm.receive === "granted" ? perm : Push.requestPermissions()))
    .then((perm) => {
      if (perm.receive === "granted") return Push.register();
    })
    .catch(() => {});
}
