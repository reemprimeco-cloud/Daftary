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

// ————— الشراء داخل التطبيق (StoreKit) —————
// نرجّع معرّف المعاملة فقط، والسيرفر هو اللي يتحقق منه عند آبل قبل ما يمنح
// الرصيد. الثقة بما يرسله العميل وحده تعني إن أي أحد يقدر يمنح نفسه اشتراكاً.
function purchases() {
  const p = plugin("NativePurchases");
  if (!p) throw new Error("الشراء غير متاح بهذه النسخة من التطبيق — حدّثه من آب ستور.");
  return p;
}

// أسعار المتجر الحقيقية. آبل تشترط عرض السعر اللي بينخصم فعلاً — وهو يختلف
// بحسب متجر البلد والضريبة، فما نعتمد على أرقامنا المكتوبة إلا لو فشل الجلب.
export async function nativeProductPrices(productIds) {
  try {
    const { products } = await purchases().getProducts({ productIdentifiers: productIds });
    return Object.fromEntries(
      (products || []).map((p) => [p.identifier || p.productIdentifier, p.priceString || p.price])
    );
  } catch {
    return {};
  }
}

export function storePlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

// المتجران يعرّفان الشراء بشكل مختلف: آبل بـtransactionId، وجوجل بـ
// purchaseToken (وtransactionId عندها فاضي أصلاً). فنرجّع الاثنين مع المنصة
// بدل ما نفترض واحداً — الافتراض هنا يعني إن الشراء على أندرويد يفشل بصمت.
function txRef(tx) {
  const platform = storePlatform();
  const token = platform === "android" ? tx?.purchaseToken : tx?.transactionId;
  return token ? { platform, token, productId: tx?.productIdentifier || null } : null;
}

// motherId معرّف UUID — وهي الصيغة اللي تطلبها آبل لـappAccountToken، وجوجل
// تقبلها كـobfuscatedAccountId. فنربط معاملة المتجر بحساب ولي الأمر عندنا،
// وهذا يخلي الاستعادة تجيب مشترياته هو بالذات بدل أي شي على الجهاز.
export async function nativePurchase(productId, { subscription = true, accountToken } = {}) {
  const tx = await purchases().purchaseProduct({
    productIdentifier: productId,
    productType: subscription ? "subs" : "inapp",
    ...(accountToken ? { appAccountToken: accountToken } : {}),
  });
  return txRef(tx);
}

// استعادة المشتريات — المتجران يطلبان زراً لها بأي تطبيق فيه اشتراكات.
// restorePurchases() تزامن مع المتجر وما ترجّع شي، فنقرأ المعاملات بعدها.
// onlyCurrentEntitlements تقصر النتيجة على اشتراكات الحساب الحالي النشطة،
// بدل كل معاملة صارت على الجهاز — بدونها جهاز مستعمل يسرّب مشتريات صاحبه
// السابق لمستخدمنا.
export async function nativeRestorePurchases(accountToken) {
  const store = purchases();
  await store.restorePurchases();
  const { purchases: list } = await store.getPurchases({
    onlyCurrentEntitlements: true,
    ...(accountToken ? { appAccountToken: accountToken } : {}),
  });
  return (list || []).map(txRef).filter(Boolean);
}

// صفحة إدارة الاشتراكات بآبل — نوجّه لها بدل ما نشرح للمستخدم مسار الإعدادات.
export async function nativeManageSubscriptions() {
  try {
    await purchases().manageSubscriptions();
    return true;
  } catch {
    return false;
  }
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

// ————— مشاركة/طباعة ملف PDF —————
// pdf.save() بمكتبة jsPDF يعتمد على تنزيل الملف من المتصفح، وهذا ما يشتغل
// داخل WebView تطبيق آبل. هنا نكتب الملف بمجلد مؤقت بالجهاز ثم نفتح قائمة
// المشاركة الأصلية — اللي فيها خيار «طباعة» عبر AirPrint إضافة لحفظ
// الملف أو إرساله.
// المسافات وبعض المحارف تكسر تحويل المسار لـfile:// URL بالطبقة الأصلية،
// فنبدّلها بشرطات قبل ما نكتب الملف.
function safeFileName(name) {
  return name.replace(/[\s/\\:*?"<>|]+/g, "-");
}

function base64ToBlob(base64, type) {
  const chars = atob(base64);
  const bytes = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
  return new Blob([bytes], { type });
}

// إلغاء المستخدمة لقائمة المشاركة مو خطأ نعرضه
function isCancel(e) {
  return e?.name === "AbortError" || /cancel|abort/i.test(e?.message || "");
}

// ترجّع نص الخطأ لو فشلت، وnull لو نجحت — عشان نعرض السبب الحقيقي للمستخدمة
// بدل رسالة عامة (ما نقدر نوصل Safari Web Inspector لكل جهاز).
//
// نجرّب مسارين: الإضافات الأصلية أولاً (الأفضل — تفتح قائمة المشاركة كاملة
// مع AirPrint)، وإذا الإضافة الأصلية غير مسجّلة بالنسخة المبنية نرجع لـWeb
// Share API اللي يفتح نفس القائمة بدون أي إضافة أصلية.
export async function nativeSharePdf(base64Data, fileName, title) {
  const Filesystem = plugin("Filesystem");
  const Share = plugin("Share");
  const path = safeFileName(fileName);
  const errors = [];

  if (Filesystem && Share) {
    let step = "writeFile";
    try {
      await Filesystem.writeFile({ path, data: base64Data, directory: "CACHE" });
      step = "getUri";
      const { uri } = await Filesystem.getUri({ path, directory: "CACHE" });
      step = "share";
      await Share.share({ title, dialogTitle: title, files: [uri] });
      return null;
    } catch (e) {
      if (step === "share" && isCancel(e)) return null;
      console.error(`nativeSharePdf failed at ${step}:`, e);
      errors.push(`${step}: ${e?.message || e}`);
    }
  } else {
    errors.push(`الإضافة الأصلية غير مسجّلة (Filesystem: ${!!Filesystem}، Share: ${!!Share})`);
  }

  // بديل بدون إضافات أصلية
  try {
    const file = new File([base64ToBlob(base64Data, "application/pdf")], path, {
      type: "application/pdf",
    });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return null;
    }
    errors.push("Web Share لا يدعم مشاركة الملفات هنا");
  } catch (e) {
    if (isCancel(e)) return null;
    console.error("nativeSharePdf web-share fallback failed:", e);
    errors.push(`webShare: ${e?.message || e}`);
  }

  return errors.join(" | ");
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

// ملاحظة: التطبيق يعتمد على إشعارات آبل المحلية (LocalNotifications) فقط —
// تنجدول على الجهاز نفسه بدون سيرفر ولا إنترنت. ما نستخدم الإشعارات البعيدة
// (APNs / Push) إطلاقاً، فما نطلب صلاحية Push ولا نعلن background mode.
