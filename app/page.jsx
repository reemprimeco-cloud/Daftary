"use client";

import { useState, useEffect, useRef, useId } from "react";
import {
  isNativeApp,
  initNative,
  nativePickImage,
  nativeScanDocument,
  hasDocumentScanner,
  hapticSuccess,
  hapticLight,
  nativeShare,
  nativeSharePdf,
  syncTaskReminders,
  reportNotificationOpen,
  reportError,
  permissionStatus,
  requestPermission,
  registerPushDevice,
  attachPullToRefresh,
  rotateDataUrl,
  resizeDataUrl,
} from "@/lib/native";
import { installAuthFetch } from "@/lib/authFetch";
import { postUpload } from "@/lib/uploadRequest";
import CropModal from "./CropModal";
import { PLAN, SUBSCRIPTION_TIERS, CREDIT_PRODUCT_ID } from "@/lib/plans";
import { APP_TIERS, APP_PLAN, arabicDigits } from "@/lib/appPlans";

const PALETTE = [
  { bg: "#FDEFF3", ring: "#E8A0B4", solid: "#E39CB2", soft: "#F9D9E2", text: "#8C4E62" },
  { bg: "#EBF7F1", ring: "#7FCFB0", solid: "#68C29E", soft: "#D2EFE3", text: "#2F6E56" },
  { bg: "#FDF3E7", ring: "#F0BE84", solid: "#EBAE68", soft: "#FAE3C4", text: "#8C6027" },
  { bg: "#F1EFFA", ring: "#B7A6E8", solid: "#A692E0", soft: "#DFD8F5", text: "#5C4B8C" },
  { bg: "#FDF0EB", ring: "#F0AE91", solid: "#EA9976", soft: "#FADACB", text: "#8C5636" },
  { bg: "#F0F5EA", ring: "#ABCB8F", solid: "#96BE75", soft: "#DFEBCE", text: "#516F35" },
  { bg: "#F7F0F8", ring: "#CCA3D8", solid: "#BF8ACD", soft: "#EDD8F0", text: "#71427C" },
  { bg: "#EBF4FA", ring: "#93C6E2", solid: "#79B7DA", soft: "#D2E9F4", text: "#31607C" },
];
// يُعرض بصفحة الحساب — حدّثيه مع كل إصدار جديد بالتوازي مع
// MARKETING_VERSION بمشروع Xcode و version بملف package.json.
const APP_VERSION = "1.0.3";
const APP_STORE_URL = "https://apps.apple.com/app/id6801521796";
// wa.me يفتح تطبيق واتساب إذا كان منزّلاً، ونسخة الويب إذا لا — فيشتغل
// داخل تطبيق آبل وبالمتصفح بنفس الرابط.
const WHATSAPP_URL = "https://wa.me/96565068000";
// المسجات الدايركت بالانستقرام بدل الايميل — ig.me يفتح المحادثة مباشرة
// بالتطبيق لو منصّب، وإلا يحوّل للمتصفح.
const INSTAGRAM_URL = "https://ig.me/m/reemora.app";
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
// ترويسة أعمدة الحصص بنفس صيغة الجدول الورقي («الأولى» لا «الحصة ١») —
// أقصر فتدخل بعمود ضيق. أي رقم فوق الثامنة يبان رقماً كما هو.
const PERIOD_LABELS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];
const FULL_DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const TYPE_META = {
  "واجب": { done: "تم" },
  "حفظ": { done: "تم الحفظ" },
  "اختبار": { done: "تم المذاكرة" },
  "مشروع": { done: "تم" },
  // محتوى المنهج خلال الأسبوع — الأم تعلّمه «تمت المراجعة»، وبلا أي تذكير
  "درس": { done: "تمت المراجعة" },
};
// «المتطلبات» انضم لتبويب «جدول الحصص» بتبويب واحد «الطلبات والجداول»
// (طلب صاحبة التطبيق) — يفرّغ خانة بالشريط السفلي لميزة مستقبلية
// (المشاريع)، والتبديل بين القسمين بمفتاح داخلي (scheduleSubTab بالأسفل).
const TABS = [
  { key: "dashboard", label: "الرئيسية" },
  { key: "schedule", label: "الطلبات والجداول" },
  { key: "progress", label: "المتابعة والدرجات" },
  { key: "teacher", label: "المعلم الذكي" },
];

// أيقونات شريط التبويبات بنمط SF Symbols لتطبيق آبل — الإيموجي يبقى للويب.
// كل أيقونة ترسم نسختين: ممتلئة عند التحديد ومفرّغة عند عدم التحديد.
const TAB_ICONS = {
  dashboard: (on) =>
    on
      ? "M12 3.1 3 10.05V21h6v-6.4h6V21h6V10.05z"
      : "M12 4.37 4.5 10.16V19.5h3.75v-6.4h7.5v6.4h3.75v-9.34zM12 3.1 3 10.05V21h6v-6.4h6V21h6V10.05z",
  requirements: (on) =>
    on
      ? "M9 2h6a2 2 0 0 1 2 2v1h1.5A2.5 2.5 0 0 1 21 7.5v11A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5H7V4a2 2 0 0 1 2-2m.5 3h5V4.5h-5z"
      : "M9 2h6a2 2 0 0 1 2 2v1h1.5A2.5 2.5 0 0 1 21 7.5v11A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5H7V4a2 2 0 0 1 2-2m0 1.5a.5.5 0 0 0-.5.5v1h7V4a.5.5 0 0 0-.5-.5zm-3.5 3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1z",
  schedule: (on) =>
    on
      ? "M7 1.75a.75.75 0 0 1 .75.75V4h8.5V2.5a.75.75 0 0 1 1.5 0V4h.75A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4h.75V2.5A.75.75 0 0 1 7 1.75M4.5 9.5v9a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-9z"
      : "M7 1.75a.75.75 0 0 1 .75.75V4h8.5V2.5a.75.75 0 0 1 1.5 0V4h.75A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4h.75V2.5A.75.75 0 0 1 7 1.75M5.5 5.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-12a1 1 0 0 0-1-1zM4.5 9h15v1.5h-15z",
  progress: (on) =>
    on
      ? "M12 5.6C10.3 4.2 8.1 3.5 5.5 3.5c-.9 0-1.8.1-2.6.3-.5.1-.9.6-.9 1.1v12.4c0 .7.6 1.2 1.3 1.1.7-.1 1.4-.2 2.2-.2 2.3 0 4.3.6 5.7 1.7.5.4 1.1.4 1.6 0 1.4-1.1 3.4-1.7 5.7-1.7.8 0 1.5.1 2.2.2.7.1 1.3-.4 1.3-1.1V4.9c0-.5-.4-1-.9-1.1-.8-.2-1.7-.3-2.6-.3-2.6 0-4.8.7-6.5 2.1"
      : "M12 5.6C10.3 4.2 8.1 3.5 5.5 3.5c-.9 0-1.8.1-2.6.3-.5.1-.9.6-.9 1.1v12.4c0 .7.6 1.2 1.3 1.1.7-.1 1.4-.2 2.2-.2 2.3 0 4.3.6 5.7 1.7.5.4 1.1.4 1.6 0 1.4-1.1 3.4-1.7 5.7-1.7.8 0 1.5.1 2.2.2.7.1 1.3-.4 1.3-1.1V4.9c0-.5-.4-1-.9-1.1-.8-.2-1.7-.3-2.6-.3-2.6 0-4.8.7-6.5 2.1m-.75 12.8c-1.6-.9-3.5-1.4-5.75-1.4-.6 0-1.2 0-1.75.1V5.2c.55-.1 1.15-.2 1.75-.2 2.4 0 4.3.7 5.75 1.9zm1.5 0V6.9C14.2 5.7 16.1 5 18.5 5c.6 0 1.2.1 1.75.2v11.9c-.55-.1-1.15-.1-1.75-.1-2.25 0-4.15.5-5.75 1.4",
  teacher: (on) =>
    on
      ? "M11.6 2.2a1 1 0 0 1 .8 0l9.1 4a1 1 0 0 1 0 1.83l-2 .88V14a.75.75 0 0 1-1.5 0V9.57l-2 .88V14c0 .38-.2.72-.5.9-1.1.66-2.32.98-3.5.98s-2.4-.32-3.5-.98a1.05 1.05 0 0 1-.5-.9v-3.55L2.5 8.03a1 1 0 0 1 0-1.83z"
      : "M11.6 2.2a1 1 0 0 1 .8 0l9.1 4a1 1 0 0 1 0 1.83l-2 .88V14a.75.75 0 0 1-1.5 0V9.57l-2 .88V14c0 .38-.2.72-.5.9-1.1.66-2.32.98-3.5.98s-2.4-.32-3.5-.98a1.05 1.05 0 0 1-.5-.9v-3.55L2.5 8.03a1 1 0 0 1 0-1.83zM12 3.72 4.72 7.11 12 10.3l7.28-3.19zm-2.6 7.4v2.42c.8.4 1.68.6 2.6.6s1.8-.2 2.6-.6v-2.42l-2.2.96a1 1 0 0 1-.8 0z",
};

// ————— بلاطات أيقونات الويب —————
// الإيموجي شكله يختلف من جهاز لجهاز (🔒 بالآيفون غير الأندرويد غير ويندوز)
// وما نتحكم فيه، فالموقع كان يطلع بهوية مختلفة عند كل مستخدمة. نرسم بدالها
// بلاطات بنفس أسلوب أيقونات المواد بالجداول: تدرّج بستيل + لمعة علوية + رمز
// أبيض بسيط. SVG مو صور: بلا تحميل إضافي، وحادّة بأي حجم، ولونها بمتغيّر.
function mixColor(hex, to, t) {
  const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = parse(hex);
  const [R, G, B] = parse(to);
  const c = (a, z) => Math.round(a + (z - a) * t);
  return `rgb(${c(r, R)},${c(g, G)},${c(b, B)})`;
}

// كل رمز يستقبل لون البلاطة ليرسم فيه التفاصيل الداخلية (طيّة المظروف،
// شريط البطاقة، شريطة الهدية) — أبيض على أبيض ما يبين.
const TILE_GLYPHS = {
  lock: (sh) => (
    <>
      <path d="M12 2.5A4.5 4.5 0 0 0 7.5 7v3h2V7a2.5 2.5 0 0 1 5 0v3h2V7A4.5 4.5 0 0 0 12 2.5" />
      <path d="M6.75 10.75h10.5A2.25 2.25 0 0 1 19.5 13v6a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19v-6a2.25 2.25 0 0 1 2.25-2.25" />
      <circle cx="12" cy="15.2" r="1.5" fill={sh} />
      <rect x="11.25" y="15" width="1.5" height="3" rx=".75" fill={sh} />
    </>
  ),
  mail: (sh) => (
    <>
      <path d="M4 6.5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2" />
      <path d="M3.4 8 12 13.6 20.6 8" fill="none" stroke={sh} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  card: (sh) => (
    <>
      <path d="M3 4.5h18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2" />
      <rect x="1" y="8" width="22" height="3" fill={sh} />
      <rect x="3.6" y="13.8" width="6" height="1.9" rx=".95" fill={sh} />
    </>
  ),
  gift: (sh) => (
    <>
      <path d="M8.4 1.9c1.7 0 2.9 1.4 3.6 3.1.7-1.7 1.9-3.1 3.6-3.1a2.85 2.85 0 0 1 .9 5.55h-9A2.85 2.85 0 0 1 8.4 1.9" />
      <path d="M3 8.2h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1" />
      <path d="M4.3 13.5h15.4v6.1A1.9 1.9 0 0 1 17.8 21.5H6.2a1.9 1.9 0 0 1-1.9-1.9z" />
      <rect x="10.4" y="4.4" width="3.2" height="17.1" rx=".4" fill={sh} />
    </>
  ),
  trash: (sh) => (
    <>
      <path d="M9.6 2.5h4.8a1.1 1.1 0 0 1 1.1 1.1V5h4.15a.85.85 0 0 1 0 1.7h-.72l-.83 12.05A2.6 2.6 0 0 1 15.5 21.2h-7A2.6 2.6 0 0 1 5.9 18.75L5.07 6.7h-.72a.85.85 0 0 1 0-1.7H8.5V3.6a1.1 1.1 0 0 1 1.1-1.1m.6 2.5h3.6V4.2h-3.6z" />
      <rect x="9.1" y="9" width="1.7" height="8" rx=".85" fill={sh} />
      <rect x="13.2" y="9" width="1.7" height="8" rx=".85" fill={sh} />
    </>
  ),
  whatsapp: (sh) => (
    <>
      <path d="M12 2.2a9.5 9.5 0 0 0-8.1 14.45L2.6 21.1a.6.6 0 0 0 .74.74l4.53-1.28A9.5 9.5 0 1 0 12 2.2" />
      <path d="M9.15 7.4c.2-.02.42-.02.6.02.22.05.35.42.45.66l.5 1.2c.08.2.04.42-.1.58l-.45.5a.4.4 0 0 0-.07.45 6 6 0 0 0 2.85 2.5c.17.07.36.02.47-.12l.5-.62c.14-.17.37-.23.57-.15l1.5.6c.2.08.33.28.32.5-.04.62-.32 1.2-.85 1.5-.6.34-1.35.4-2.02.2a8.4 8.4 0 0 1-5.1-4.6c-.3-.7-.35-1.48-.05-2.15.25-.55.72-.99 1.3-1.07" fill={sh} />
    </>
  ),
  instagram: (sh) => (
    <>
      <path d="M7.9 2.4h8.2a5.5 5.5 0 0 1 5.5 5.5v8.2a5.5 5.5 0 0 1-5.5 5.5H7.9a5.5 5.5 0 0 1-5.5-5.5V7.9a5.5 5.5 0 0 1 5.5-5.5" />
      <path d="M12 7.35A4.65 4.65 0 1 0 12 16.65 4.65 4.65 0 0 0 12 7.35m0 1.7a2.95 2.95 0 1 1 0 5.9 2.95 2.95 0 0 1 0-5.9" fill={sh} />
      <circle cx="17.1" cy="6.9" r="1.2" fill={sh} />
    </>
  ),
  star: () => <path d="M12 2.2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 18l-6.2 3.3 1.2-6.9-5-4.9 6.9-1z" />,
  gear: (sh) => (
    <>
      {[0, 45, 90, 135].map((a) => (
        <rect key={a} x="10.6" y="1.7" width="2.8" height="20.6" rx="1.3" transform={`rotate(${a} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="6.4" />
      <circle cx="12" cy="12" r="2.7" fill={sh} />
    </>
  ),
  doc: (sh) => (
    <>
      <path d="M6.6 2h6.9L19 7.6V20a2 2 0 0 1-2 2H6.6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2" />
      <path d="M13.2 2.6v4.2a1 1 0 0 0 1 1h4.3" fill="none" stroke={sh} strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="7.7" y="11.6" width="8.6" height="1.6" rx=".8" fill={sh} />
      <rect x="7.7" y="15" width="5.8" height="1.6" rx=".8" fill={sh} />
    </>
  ),
  pencil: () => (
    <path d="M17.2 2.6a2.2 2.2 0 0 1 3.1 0l1.1 1.1a2.2 2.2 0 0 1 0 3.1l-1.5 1.5-4.2-4.2zM14.6 5.2l4.2 4.2-9.3 9.3-5.2 1 1-5.2z" />
  ),
  refresh: () => (
    <>
      <path d="M12 4a8 8 0 0 1 6.9 4H16a1 1 0 0 0 0 2h5a1 1 0 0 0 1-1V4a1 1 0 0 0-2 0v1.9A10 10 0 0 0 2.1 10.8a1 1 0 0 0 2 .3A8 8 0 0 1 12 4" />
      <path d="M12 20a8 8 0 0 1-6.9-4H8a1 1 0 0 0 0-2H3a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-1.9A10 10 0 0 0 21.9 13.2a1 1 0 0 0-2-.3A8 8 0 0 1 12 20" />
    </>
  ),
  chart: () => (
    <>
      <rect x="3.5" y="12" width="4" height="8.5" rx="1.3" />
      <rect x="10" y="7" width="4" height="13.5" rx="1.3" />
      <rect x="16.5" y="3.5" width="4" height="17" rx="1.3" />
    </>
  ),
  // أنواع المهام وبقية الأيقونات تعيد استخدام مسارات ICONS نفسها.
  homework: () => <path d={ICONS.homework} />,
  memorize: () => <path d={ICONS.memorize} />,
  exam: () => <path d={ICONS.exam} />,
  project: () => <path d={ICONS.project} />,
  warning: () => <path d={ICONS.warning} />,
  calendar: () => <path d={ICONS.calendar} />,
  bell: () => <path d={ICONS.bell} />,
  camera: () => <path d={ICONS.camera} />,
  // تبويبات الأسفل — نعيد استخدام نفس مسارات أيقونات التطبيق فيطلع الموقع
  // والتطبيق من عائلة وحدة بلا رسم جديد. نأخذ النسخة المفرّغة مو الممتلئة:
  // الشكل الممتلئ أبيض بالكامل يطلع كبقعة بلا ملامح بحجم ٢٥ بكسل، والمفرّغ
  // يخلي لون البلاطة يبين من داخل الأيقونة فتنقرأ.
  dashboard: () => <path d={TAB_ICONS.dashboard(false)} />,
  requirements: () => <path d={TAB_ICONS.requirements(false)} />,
  schedule: () => <path d={TAB_ICONS.schedule(false)} />,
  progress: () => <path d={TAB_ICONS.progress(false)} />,
  teacher: () => <path d={TAB_ICONS.teacher(false)} />,
};

const TILE_TINTS = {
  lock: "#7FA8E0",
  mail: "#E39AB4",
  card: "#A38FDE",
  gift: "#E0B073",
  trash: "#DE8B8B",
  gear: "#A8A2C4",
  star: "#E8C05C",
  whatsapp: "#3FC45E",
  instagram: "#D9518C",
  pencil: "#E0A873",
  refresh: "#7FA8E0",
  chart: "#7FC2A0",
  doc: "#7FA8E0",
  homework: "#A38FDE",
  memorize: "#7FC2A0",
  exam: "#E0A873",
  project: "#E39AB4",
  warning: "#E0A873",
  calendar: "#7FA8E0",
  bell: "#E0B073",
  camera: "#A38FDE",
  dashboard: "#A38FDE",
  requirements: "#E0A873",
  schedule: "#7FA8E0",
  progress: "#7FC2A0",
  teacher: "#E39AB4",
};

function TileIcon({ name, size = 26, tint, style }) {
  const uid = useId();
  const base = tint || TILE_TINTS[name] || "#A38FDE";
  const light = mixColor(base, "#ffffff", 0.74);
  const mid = mixColor(base, "#ffffff", 0.16);
  const deep = mixColor(base, "#4A3F6B", 0.3);
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: size, height: size, display: "block", flexShrink: 0, ...style }}>
      <defs>
        <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset=".5" stopColor={mid} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${uid}f)`} />
      {/* اللمعة العلوية — نفس لمعة بلاطات المواد */}
      <path d="M0 13A13 13 0 0 1 13 0h22a13 13 0 0 1 13 13v8c-7 5.5-41 5.5-48 0z" fill={`url(#${uid}s)`} />
      <g transform="translate(11.5 11.5) scale(1.042)" fill="#fff">
        {TILE_GLYPHS[name](mid)}
      </g>
    </svg>
  );
}

function TabIcon({ tab, active }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={TAB_ICONS[tab](active)} />
    </svg>
  );
}

// أيقونات متجهية بنمط SF Symbols تحلّ محل الإيموجي داخل تطبيق آبل.
// الإيموجي يبقى بنسخة الويب لأن طابعها أدفأ وأقرب لهوية الموقع.
const ICONS = {
  homework:
    "M6 2h7.5L19 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m0 1.5a.5.5 0 0 0-.5.5v16a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V8.5h-4A1.5 1.5 0 0 1 12 7V3.5zm1.75 7h8.5V12h-8.5zm0 3.5h8.5v1.5h-8.5zm0 3.5h5.5V18h-5.5z",
  memorize:
    "M12 5.6C10.3 4.2 8.1 3.5 5.5 3.5c-.9 0-1.8.1-2.6.3-.5.1-.9.6-.9 1.1v12.4c0 .7.6 1.2 1.3 1.1.7-.1 1.4-.2 2.2-.2 2.3 0 4.3.6 5.7 1.7.5.4 1.1.4 1.6 0 1.4-1.1 3.4-1.7 5.7-1.7.8 0 1.5.1 2.2.2.7.1 1.3-.4 1.3-1.1V4.9c0-.5-.4-1-.9-1.1-.8-.2-1.7-.3-2.6-.3-2.6 0-4.8.7-6.5 2.1m-.75 12.8c-1.6-.9-3.5-1.4-5.75-1.4-.6 0-1.2 0-1.75.1V5.2c.55-.1 1.15-.2 1.75-.2 2.4 0 4.3.7 5.75 1.9zm1.5 0V6.9C14.2 5.7 16.1 5 18.5 5c.6 0 1.2.1 1.75.2v11.9c-.55-.1-1.15-.1-1.75-.1-2.25 0-4.15.5-5.75 1.4",
  exam:
    "M11.6 2.2a1 1 0 0 1 .8 0l9.1 4a1 1 0 0 1 0 1.83l-2 .88V14a.75.75 0 0 1-1.5 0V9.57l-2 .88V14c0 .38-.2.72-.5.9-1.1.66-2.32.98-3.5.98s-2.4-.32-3.5-.98a1.05 1.05 0 0 1-.5-.9v-3.55L2.5 8.03a1 1 0 0 1 0-1.83zM12 3.72 4.72 7.11 12 10.3l7.28-3.19zm-2.6 7.4v2.42c.8.4 1.68.6 2.6.6s1.8-.2 2.6-.6v-2.42l-2.2.96a1 1 0 0 1-.8 0z",
  project:
    "M12 2c5.5 0 10 4 10 8.9 0 2.7-2.2 4.9-4.9 4.9h-1.8c-.8 0-1.5.7-1.5 1.5 0 .4.15.7.4 1 .25.3.4.65.4 1.05 0 .9-.75 1.65-1.7 1.65C6.9 21 2 16.7 2 11.4 2 6.2 6.5 2 12 2m-5.25 9.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8m3.5-3.9a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8m3.5 0a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8m3.5 3.9a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8",
  camera:
    "M9.4 3h5.2c.6 0 1.15.32 1.44.85L16.7 5h1.8A2.5 2.5 0 0 1 21 7.5v10A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10A2.5 2.5 0 0 1 5.5 5h1.8l.66-1.15A1.65 1.65 0 0 1 9.4 3m.3 1.5-.66 1.15A1.65 1.65 0 0 1 7.6 6.5H5.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1h-2.1c-.6 0-1.15-.32-1.44-.85L14.3 4.5zM12 8.25a4.25 4.25 0 1 1 0 8.5 4.25 4.25 0 0 1 0-8.5m0 1.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5",
  photo:
    "M5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11A2.5 2.5 0 0 1 5.5 4m0 1.5a1 1 0 0 0-1 1v11c0 .12.02.23.06.33l5.3-5.3a2 2 0 0 1 2.83 0l1.4 1.4 2.26-2.26a2 2 0 0 1 2.83 0l1.32 1.32V6.5a1 1 0 0 0-1-1zm3.4 3a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2",
  warning:
    "M12 2.9c.62 0 1.2.33 1.51.87l8.2 14.2A1.75 1.75 0 0 1 20.2 20.6H3.8a1.75 1.75 0 0 1-1.51-2.63l8.2-14.2c.31-.54.89-.87 1.51-.87m0 1.85L4.16 19.1h15.68zM12 9a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4A.75.75 0 0 1 12 9m0 6.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2",
  calendar:
    "M7 1.75a.75.75 0 0 1 .75.75V4h8.5V2.5a.75.75 0 0 1 1.5 0V4h.75A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4h.75V2.5A.75.75 0 0 1 7 1.75M5.5 5.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-12a1 1 0 0 0-1-1zM4.5 9h15v1.5h-15z",
  bell:
    "M12 2.25c.83 0 1.5.67 1.5 1.5v.42A6.26 6.26 0 0 1 18.25 10.4v3.35l1.4 2.4a1.25 1.25 0 0 1-1.08 1.88H15.6a3.6 3.6 0 0 1-7.2 0H5.43a1.25 1.25 0 0 1-1.08-1.88l1.4-2.4V10.4A6.26 6.26 0 0 1 10.5 4.17v-.42c0-.83.67-1.5 1.5-1.5m0 3.35a4.76 4.76 0 0 0-4.75 4.8v3.55c0 .26-.07.52-.2.75l-1.1 1.88h12.1l-1.1-1.88a1.5 1.5 0 0 1-.2-.75V10.4A4.76 4.76 0 0 0 12 5.6m-2.1 12.03a2.1 2.1 0 0 0 4.2 0z",
  wave:
    "M11 2.6a1.6 1.6 0 0 1 3.2 0v5.2h.4V4.2a1.6 1.6 0 0 1 3.2 0v6.9h.4V7.6a1.6 1.6 0 0 1 3.2 0v6.15c0 4.3-3.1 7.65-7.4 7.65-2.35 0-4.3-.85-5.75-2.5L3.1 14.4a1.65 1.65 0 0 1 .2-2.4 1.7 1.7 0 0 1 2.3.25l2.2 2.4V4.2a1.6 1.6 0 0 1 3.2 0z",
  // square.and.arrow.up — أيقونة المشاركة الرسمية بنظام آبل
  share:
    "M12 1.9c.2 0 .39.08.53.22l3.3 3.3a.75.75 0 0 1-1.06 1.06l-2.02-2.02V14a.75.75 0 0 1-1.5 0V4.46L9.23 6.48a.75.75 0 0 1-1.06-1.06l3.3-3.3A.75.75 0 0 1 12 1.9M6.5 9h2v1.5h-2a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7.5a1 1 0 0 0-1-1h-2V9h2a2.5 2.5 0 0 1 2.5 2.5V19a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19v-7.5A2.5 2.5 0 0 1 6.5 9",
};

function Icon({ name, size = 17, style }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// يرجّع أيقونة متجهية بتطبيق آبل وإيموجي بالويب.
function TypeGlyph({ type, native, size = 15 }) {
  const map = { "واجب": "homework", "حفظ": "memorize", "اختبار": "exam", "مشروع": "project" };
  const name = map[type] || "homework";
  if (!native) return <TileIcon name={name} size={size + 3} />;
  return <Icon name={name} size={size} />;
}
const SUBJECT_ICON_MAP = [
  { file: "islamic", keywords: ["اسلام", "قرآن", "تجويد", "فقه", "حديث"] },
  { file: "arabic", keywords: ["عربي"] },
  { file: "english", keywords: ["انجليزي", "english"] },
  { file: "math", keywords: ["رياضيات"] },
  { file: "science", keywords: ["علوم", "فيزياء", "كيمياء", "أحياء"] },
  { file: "social", keywords: ["اجتماعيات", "وطني", "جغرافيا", "تاريخ"] },
  { file: "pe", keywords: ["رياضة", "بدنية", "بدني"] },
  { file: "art", keywords: ["فنية", "رسم"] },
  { file: "music", keywords: ["موسيقى", "نشيد"] },
  { file: "computer", keywords: ["حاسوب", "حاسب", "كمبيوتر", "تقنية"] },
  // مادة بمدرسة عجيل وعبدالله (الصف السادس) — طلبتها صاحبة التطبيق بأيقونة برق
  { file: "electricity", keywords: ["كهرب"] },
];
const PE_COLORS = [
  { value: "#3B82F6", label: "أزرق" },
  { value: "#EF4444", label: "أحمر" },
  { value: "#EAB308", label: "أصفر" },
  { value: "#22C55E", label: "أخضر" },
  { value: "#FFFFFF", label: "أبيض" },
  { value: "#F97316", label: "برتقالي" },
  { value: "#A855F7", label: "بنفسجي" },
];
// «الصف ٦/٣» ينقلب بصرياً: الشرطة المائلة تخلي الرقمين كتلة تُرسم من
// اليسار لليمين، والعين العربية تمشي من اليمين فتلقى ٣ أولاً وتقرأها
// «٣/٦» — أي الصف والشعبة معكوسين. وهذا يصير بالأرقام اللاتينية والعربية
// معاً، ولا يصلحه dir="ltr". تسمية كل رقم تنهي اللبس بأي اتجاه قراءة.
function classLabel(grade, section) {
  const g = arabicDigits(String(grade ?? "").trim());
  const raw = String(section ?? "").trim();
  if (!raw) return `الصف ${g}`;
  // الشعبة أحياناً حرف (أ/ب) وأحياناً رقم — نعرّب الأرقام فقط.
  const sec = /^\d+$/.test(raw) ? arabicDigits(raw) : raw;
  return `الصف ${g} · شعبة ${sec}`;
}

const stageForGrade = (g) => (g <= 5 ? "ابتدائي" : g <= 9 ? "متوسط" : "ثانوي");
const studentWord = (gender) => (gender === "بنات" ? "الطالبة" : "الطالب");

function normalizeAr(s) {
  return (s || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}

function getSubjectIconFile(subject) {
  const s = normalizeAr(subject);
  for (const entry of SUBJECT_ICON_MAP) {
    if (entry.keywords.some((k) => s.includes(normalizeAr(k)))) return entry.file;
  }
  return null;
}

// عدد مكتوب بمجموعات (٤١٠ ٠٧٢ ٠١٠ أو 410,072,010) يصير بالنص العربي عدة
// كتل رقمية، والمتصفح يرتّب الكتل من اليمين لليسار — فيقرأ ولي الأمر العدد
// معكوساً. نفس علة «الصف ٦/٣». نعزل العدد كله بكتلة واحدة اتجاهها يسار.
// النمط يمسك التجميع الثلاثي فقط، فقائمة مثل «٣ ، ٤ ، ٥» تبقى كما هي.
const GROUPED_NUMBER_RE = /[٠-٩\d]{1,3}(?:[ ,،٬][٠-٩\d]{3})+/g;
function renderWithNumbers(text) {
  const s = String(text ?? "");
  const out = [];
  let last = 0;
  for (const m of s.matchAll(GROUPED_NUMBER_RE)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(<span key={m.index} dir="ltr" style={{ unicodeBidi: "isolate", whiteSpace: "nowrap" }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" });
}


async function resizeToDataUrl(file, maxSize = 900, square = false, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        if (square) {
          canvas.width = maxSize; canvas.height = maxSize;
          const ctx = canvas.getContext("2d");
          const min = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, maxSize, maxSize);
        } else {
          let { width, height } = img;
          if (width > height && width > maxSize) { height = height*maxSize/width; width = maxSize; }
          else if (height > maxSize) { width = width*maxSize/height; height = maxSize; }
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Avatar({ child, size = 52 }) {
  const pal = PALETTE[child.color_idx % PALETTE.length];
  if (child.photo_url) {
    return <img src={child.photo_url} alt={child.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `3px solid ${pal.ring}` }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: pal.soft, border: `3px solid ${pal.ring}`, color: pal.text, fontWeight: 700, fontSize: size*0.38 }}>
      {child.name?.[0] || "؟"}
    </div>
  );
}

// أيقونات المواد: فيكتور فلات بلون واحد مصمت بلا تدرّج ولا لمعة (قرار
// صاحبة التطبيق ١٨ سبتمبر). كانت صوراً PNG بنمط ثلاثي الأبعاد لامع —
// يضيع تفصيلها بخانة جدول الحصص الصغيرة (١٧ بكسل) وتطلع ضبابية بشاشة
// الريتينا. الفيكتور يبقى حاداً بأي مقاس وأوضح للعين.
const SUBJECT_ICONS = {
  islamic: { color: "#D2A046", glyph: (c) => (
    <>
      <path d="M13.9 4.6a7.4 7.4 0 1 0 0 14.8 8.9 8.9 0 0 1 0-14.8Z" fill="#fff" />
      <path d="m18.4 5.6.95 1.98 2.15.3-1.55 1.5.37 2.14-1.92-1.02-1.92 1.02.37-2.14-1.55-1.5 2.15-.3z" fill="#fff" />
    </>
  ) },
  arabic: { color: "#DB6489", glyph: () => <BookGlyph /> },
  english: { color: "#4B8FD4", glyph: () => <BookGlyph /> },
  math: { color: "#3DA37A", glyph: (c) => (
    <>
      <rect x="5" y="2.8" width="14" height="18.4" rx="2.6" fill="#fff" />
      <rect x="7.1" y="5" width="9.8" height="3.7" rx="1.1" fill={c} />
      {[0, 1, 2].map((r) => [0, 1, 2].map((k) => (
        <circle key={`${r}-${k}`} cx={8.7 + k * 3.3} cy={11.9 + r * 3.1} r="1.15" fill={c} />
      )))}
    </>
  ) },
  science: { color: "#8A6DD4", glyph: (c) => (
    <>
      <path d="M9.6 2.9h4.8a.95.95 0 0 1 0 1.9h-.35v4.02l4.62 8.34A2.6 2.6 0 0 1 16.4 21.1H7.6a2.6 2.6 0 0 1-2.27-3.94l4.62-8.34V4.8H9.6a.95.95 0 0 1 0-1.9Z" fill="#fff" />
      <circle cx="10.4" cy="16.6" r="1.25" fill={c} />
      <circle cx="13.7" cy="18.1" r=".95" fill={c} />
    </>
  ) },
  social: { color: "#DD8C3C", glyph: (c) => (
    <>
      <circle cx="12" cy="12" r="8.7" fill="#fff" />
      <g fill="none" stroke={c} strokeWidth="1.35">
        <path d="M3.5 12h17" />
        <path d="M12 3.4c2.1 2.3 3.2 5.3 3.2 8.6s-1.1 6.3-3.2 8.6c-2.1-2.3-3.2-5.3-3.2-8.6S9.9 5.7 12 3.4Z" />
      </g>
    </>
  ) },
  pe: { color: "#56B05B", glyph: () => (
    <g fill="#fff">
      <rect x="2.2" y="9.6" width="2.8" height="4.8" rx="1.1" />
      <rect x="19" y="9.6" width="2.8" height="4.8" rx="1.1" />
      <rect x="5.4" y="7.6" width="3.2" height="8.8" rx="1.3" />
      <rect x="15.4" y="7.6" width="3.2" height="8.8" rx="1.3" />
      <rect x="8.4" y="10.7" width="7.2" height="2.6" />
    </g>
  ) },
  art: { color: "#A56ED4", glyph: (c) => (
    <>
      <path d="M12 3.1c-5.1 0-8.9 3.7-8.9 8.4 0 4.8 3.9 8.5 8.9 8.5 1.6 0 2.5-.9 2.5-2.1 0-.6-.2-1.05-.6-1.45-.3-.4-.5-.8-.5-1.3 0-1.15.9-1.95 2.05-1.95h1.65c2.25 0 3.9-1.75 3.9-4.05 0-3.35-3.7-6.1-9-6.1Z" fill="#fff" />
      <g fill={c}>
        <circle cx="7.6" cy="11.9" r="1.35" />
        <circle cx="9.9" cy="7.9" r="1.35" />
        <circle cx="14.5" cy="7.5" r="1.35" />
        <circle cx="17.6" cy="10.4" r="1.35" />
      </g>
    </>
  ) },
  music: { color: "#DB65A4", glyph: () => (
    <path d="M18.6 2.6 8.9 4.65v10.1a3.35 3.35 0 1 0 1.9 3.02V8.1l5.9-1.25v5.55a3.35 3.35 0 1 0 1.9 3.02z" fill="#fff" />
  ) },
  electricity: { color: "#E0A526", glyph: () => (
    <path d="M13.9 2.2 6.3 13.05a.8.8 0 0 0 .65 1.26h3.62l-1.5 7.35a.42.42 0 0 0 .75.33l7.85-11.02a.8.8 0 0 0-.65-1.27h-3.75l1.45-7.2a.42.42 0 0 0-.75-.3Z" fill="#fff" />
  ) },
  computer: { color: "#3CA69E", glyph: (c) => (
    <>
      <rect x="2.6" y="4.2" width="18.8" height="12.6" rx="2.1" fill="#fff" />
      <rect x="4.7" y="6.3" width="14.6" height="8.4" rx="1" fill={c} />
      <rect x="10.3" y="17.3" width="3.4" height="2.2" fill="#fff" />
      <rect x="6.8" y="19.4" width="10.4" height="2" rx="1" fill="#fff" />
    </>
  ) },
};

// صفحتان مفتوحتان — نفس الرسم للغة العربية والإنجليزية، يفرّقهما اللون
// (كما كان بالصور السابقة).
function BookGlyph() {
  return (
    <g fill="#fff">
      <path d="M11.35 7.2C9.75 6 7.7 5.3 5.3 5.3c-.62 0-1.1.45-1.1 1.03v10.44c0 .58.48 1.03 1.1 1.03 2.4 0 4.45.6 6.05 1.8z" />
      <path d="M12.65 7.2C14.25 6 16.3 5.3 18.7 5.3c.62 0 1.1.45 1.1 1.03v10.44c0 .58-.48 1.03-1.1 1.03-2.4 0-4.45.6-6.05 1.8z" />
    </g>
  );
}

// أول حرف دالّ على المادة: «الكهرباء» تعطي «ك» لا «ا» — أداة التعريف
// ما تفرّق بين مادة وثانية، وكل المواد تقريباً تبدأ بها.
function subjectInitial(subject) {
  const s = (subject || "").trim();
  if (!s) return "؟";
  const bare = s.replace(/^ال(?=.)/, "");
  return (bare || s)[0];
}

function SubjectIcon({ subject, size = 28 }) {
  const file = getSubjectIconFile(subject);
  const icon = file && SUBJECT_ICONS[file];
  // مادة ما نعرف لها أيقونة (مثل «الكهرباء») تاخذ نفس شكل البلاطة بلون
  // محايد وأول حرف من اسمها — بدل دائرة رمادية بشكل مختلف عن جيرانها.
  const color = icon ? icon.color : "#9AA3AF";
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={subject || ""} style={{ width: size, height: size, display: "block", flexShrink: 0 }}>
      <rect width="24" height="24" rx="6.2" fill={color} />
      {icon ? icon.glyph(color) : (
        <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="12.5" fontWeight="800">
          {subjectInitial(subject)}
        </text>
      )}
    </svg>
  );
}

export default function Home() {
  const [mother, setMother] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState(null);
  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [undatedTasks, setUndatedTasks] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  // المنجز يبقى ظاهراً بقائمة الإنجاز (✓) ويدخل بنسبة الإنجاز
  const [doneTasks, setDoneTasks] = useState([]);
  const [weekRange, setWeekRange] = useState(null);
  // الرئيسية = الخطة الأسبوعية كقائمة إنجاز؛ مع أكثر من طالب/ة نعرض واحداً
  // ونبدّل بينهم من شريط علوي (الاختيار محفوظ بالجهاز).
  const [planChildId, setPlanChildId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("daftary_plan_child") : null));
  const [requirements, setRequirements] = useState([]);
  const [classSchedule, setClassSchedule] = useState([]);
  // طلب التقييم: الخادم يقرر متى يستحق العرض (بعد أسبوع من التسجيل وطالما
  // ما قيّمت)، والواجهة تعرضه وتخفيه فور الإرسال بلا انتظار تحديث.
  const [feedbackDue, setFeedbackDue] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [view, setView] = useState("dashboard");
  // التبديل داخل تبويب «الطلبات والجداول» بين قسم الجداول وقسم الطلبات
  const [scheduleSubTab, setScheduleSubTab] = useState("schedule");
  // يتغيّر بعد كل رفعة عشان تعيد بطاقة المرفقات جلب قائمتها — الروابط
  // موقّعة وتنتهي، فالتحديث جلب جديد لا مجرد إعادة رسم.
  const [attachmentsKey, setAttachmentsKey] = useState(0);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showUploadSchedule, setShowUploadSchedule] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { child, day, period, entry } — entry فاضي لو خانة جديدة
  // نتيجة تحليل خطة تنتظر مراجعة الأم — ما تنحفظ إلا باعتمادها
  const [reviewDraft, setReviewDraft] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSubscriptionManage, setShowSubscriptionManage] = useState(false);
  const [openTask, setOpenTask] = useState(null);
  const [native, setNative] = useState(false);
  const [pull, setPull] = useState(0);
  const [appAccess, setAppAccess] = useState(null); // { allowed, phase, studentsCount } — null قبل أول فحص
  // هل اكتمل أول تحميل للبيانات؟ بدونه تُعرض الشاشة الرئيسية والقوائم
  // فاضية، فتطلع رسالة «ما فيه طلاب مسجّلين» لعائلة عندها أبناء فعلاً —
  // وهذا أسوأ من انتظار: يخوّف الأم إن بياناتها راحت. ما نرجّعه false
  // أبداً بعد أول تحميل، عشان السحب للتحديث ما يومض شاشة انتظار.
  const [dataLoaded, setDataLoaded] = useState(false);
  // مشتركة قديمة دخلت قبل ما يصير الرقم السري إلزامياً: جلستها سارية
  // وتثبت هويتها، فنطلب منها الرقم السري **داخل التطبيق** بلا أي كود.
  // بدون هذا تبقى بلا رقم سري وما تقدر تدخل من جهاز جديد بعد إلغاء الكود.
  const [needsPassword, setNeedsPassword] = useState(false);
  const scrollRef = useRef(null);

  // WebKit «يكبّر النص تلقائياً» بالفقرات الطويلة داخل كتل عريضة، والتكبير
  // اللي يحسبه بالوضع الأفقي يعلق حتى بعد ما ترجع الشاشة للطول — فتبان
  // الخطوط كبيرة (شوهد بالإنتاج بشاشتي المعلم الذكي والمتابعة والدرجات:
  // فقرة حجمها ١٢ بكسل تنرسم بضعف الحجم). قفل الخاصية بـCSS ما كفى لأن
  // القيمة المحسوبة ما تُعاد بعد الدوران، فنجبره يعيد حسابها: نبدّل قيمة
  // الخاصية ونرجّعها بالإطار التالي بعد كل دوران.
  useEffect(() => {
    const root = document.documentElement;
    const vp = document.querySelector('meta[name="viewport"]');
    const base = vp?.getAttribute("content") || "";
    let timer = 0;
    const recompute = () => {
      clearTimeout(timer);
      root.style.webkitTextSizeAdjust = "100.001%";
      // وبعد الدوران من العرض للطول يبقى WebKit على مقياس عرض الوضع
      // الأفقي، فتطلع الشاشة مكبّرة وتحتاج تصغيراً يدوياً كل مرة. تثبيت
      // maximum-scale=1 للحظة يرجّع العرض «fit» بالضبط، ثم نرجّع الوسم
      // كما كان عشان التكبير اليدوي يبقى متاحاً لضعاف البصر — القرار
      // القديم بـlayout.jsx كان تركه مفتوحاً عمداً، وما نبي نلغيه.
      if (vp && base) vp.setAttribute("content", `${base}, maximum-scale=1`);
      timer = setTimeout(() => {
        root.style.webkitTextSizeAdjust = "100%";
        if (vp && base) vp.setAttribute("content", base);
      }, 400);
    };
    window.addEventListener("orientationchange", recompute);
    window.addEventListener("resize", recompute);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("orientationchange", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, []);

  useEffect(() => {
    installAuthFetch();
    setNative(isNativeApp());
    fetch("/schools.json").then((r) => r.json()).then(setSchools);
    // جلسة محفوظة من قبل — تبقى شغالة لين تسجّل خروج. الجلسات القديمة (قبل
    // إضافة التحقق) ما عندها توكن، فنطلع المستخدمة عشان تتحقق من رقمها مرة وحدة.
    const saved = typeof window !== "undefined" ? localStorage.getItem("daftary_mother") : null;
    const token = typeof window !== "undefined" ? localStorage.getItem("daftary_token") : null;
    if (saved && token) {
      const m = JSON.parse(saved);
      setMother(m);
      loadAll(m.id);
      // فتحت من إشعار إعلان بالمتصفح (?n=). التطبيق له مستمع أصلي للنقر،
      // أما المتصفح فما عنده، فنمرر المعرّف بالرابط. ننظّفه بعدها عشان
      // ما يتكرر التبليغ مع كل تحديث للصفحة ولا يبقى بالمفضلة.
      const campaign = new URLSearchParams(window.location.search).get("n");
      if (campaign) {
        reportNotificationOpen(campaign);
        window.history.replaceState({}, "", window.location.pathname);
      }
    } else if (saved) {
      localStorage.removeItem("daftary_mother");
    }
    setLoading(false);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    initNative();
  }, []);

  // السحب للتحديث — داخل تطبيق آبل فقط
  useEffect(() => {
    if (!native || !mother) return;
    return attachPullToRefresh(scrollRef.current, () => loadAll(mother.id), setPull);
  }, [native, mother]);

  async function loadAll(motherId) {
    // الطلبان متوازيان مو متتاليين: التتابع كان يضاعف زمن الشاشة الفاضية
    // عند كل فتح للتطبيق. لو طلع إن الوصول محجوب، نتجاهل نتيجة اللوحة
    // (والحارس المركزي يرفضها بـ402 أصلاً) — فما نخسر شي بجلبها مسبقاً.
    const [access, data] = await Promise.all([
      fetch("/api/subscription/app-access/status").then((r) => r.json()).catch(() => ({ allowed: true, phase: "off" })),
      fetch(`/api/dashboard?motherId=${motherId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setAppAccess(access);
    // نرفع العلم بكل الحالات (نجاح، حجب، فشل شبكة) — وإلا تبقى شاشة
    // «جاري التحميل» للأبد بدل ما يشوف المستخدم شي يتصرف معه.
    setDataLoaded(true);
    if (!access.allowed || !data) return;

    setChildren(data.children || []);
    setTasks(data.tasks || []);
    setUndatedTasks(data.undatedTasks || []);
    setUpcomingTasks(data.upcomingTasks || []);
    setDoneTasks(data.doneTasks || []);
    setWeekRange(data.weekRange || null);
    setRequirements(data.requirements || []);
    setClassSchedule(data.classSchedule || []);
    setFeedbackDue(!!data.feedbackDue);
    setNeedsPassword(!!data.needsPassword);
    // التذكيرات المحلية انلغت (قرار ٢٣ سبتمبر) — الخادم صار يغطيها كلها
    // ويوصّلها لوليَّي الأمر. النداء باقٍ ليمسح المجدول سابقاً من الأجهزة.
    syncTaskReminders();
    // تسجيل الجهاز لإشعارات السيرفر — هي مصدر كل التذكيرات الحين.
    registerPushDevice();
  }

  function handleLogout() {
    if (!confirm("تسجيل الخروج من دفتري؟")) return;
    localStorage.removeItem("daftary_mother");
    localStorage.removeItem("daftary_token");
    setMother(null);
    setChildren([]);
    setTasks([]);
    setUndatedTasks([]);
    setUpcomingTasks([]);
    setRequirements([]);
    setClassSchedule([]);
    // القوائم انمسحت، فلو دخلت أم ثانية بعدها لازم ننتظر بياناتها قبل
    // ما نعرض الشاشة — وإلا شافت «ما فيه طلاب» وهي عندها أبناء.
    setDataLoaded(false);
    setAppAccess(null);
    setView("dashboard");
  }

  function handleAccountDeleted() {
    localStorage.removeItem("daftary_mother");
    localStorage.removeItem("daftary_token");
    setMother(null);
    setChildren([]);
    setTasks([]);
    setUndatedTasks([]);
    setUpcomingTasks([]);
    setRequirements([]);
    setClassSchedule([]);
    // القوائم انمسحت، فلو دخلت أم ثانية بعدها لازم ننتظر بياناتها قبل
    // ما نعرض الشاشة — وإلا شافت «ما فيه طلاب» وهي عندها أبناء.
    setDataLoaded(false);
    setAppAccess(null);
    setView("dashboard");
    alert("تم حذف حسابك وكل بياناتك نهائياً.");
  }

  // تُستدعى بعد ما يتأكد الكود بنجاح — شاشة الدخول تتكفّل بعرض الأخطاء.
  function handleAuthenticated(m, token) {
    localStorage.setItem("daftary_mother", JSON.stringify(m));
    localStorage.setItem("daftary_token", token);
    setMother(m);
    loadAll(m.id);
  }

  async function handleAddChild(child) {
    // اشتراك دفتري الشامل يغطي عدداً محدداً من الطلاب — لو إضافة هالطالب/ة
    // تتجاوز الحد، نمنعها هنا ونوجّه لترقية الباقة، بدل ما نضيفه ثم يُقفل
    // كامل التطبيق بلا طريقة يرجع فيها ولي الأمر بنفسه إلا الترقية.
    const maxStudents = appAccess?.subscription?.max_students;
    if (maxStudents != null && children.length + 1 > maxStudents) {
      setShowAddChild(false);
      if (confirm(`باقتك الحالية تغطي ${maxStudents} ${maxStudents === 1 ? "طالب/ة" : "طلاب"} بس. رقّي باقتك الحين لإضافة طالب/ة جديد؟`)) {
        setShowSubscriptionManage(true);
      }
      return;
    }
    const res = await fetch("/api/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...child, motherId: mother.id }) });
    const data = await res.json();
    if (data.child) {
      setChildren((prev) => [...prev, data.child]);
      setShowAddChild(false);
    } else {
      alert(data.error || "تعذّرت إضافة الطالب/ة، حاولي مرة ثانية.");
    }
  }

  async function handleUpdateChild(id, child) {
    const res = await fetch(`/api/children/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...child, motherId: mother.id }) });
    const data = await res.json();
    if (data.child) {
      setChildren((prev) => prev.map((c) => (c.id === id ? data.child : c)));
      setEditingChild(null);
    } else {
      alert(data.error || "تعذّر حفظ التعديلات، حاولي مرة ثانية.");
    }
  }

  async function handleDeleteChild(id) {
    if (!confirm("حذف هذا الطالب/ـة نهائياً؟ راح تنحذف كل واجباته ومتطلباته معه.")) return;
    const res = await fetch(`/api/children/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر حذف الطالب/ة، حاولي مرة ثانية."); return; }
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => prev.filter((t) => t.child_id !== id));
    setUndatedTasks((prev) => prev.filter((t) => t.child_id !== id));
    setUpcomingTasks((prev) => prev.filter((t) => t.child_id !== id));
    setRequirements((prev) => prev.filter((r) => r.child_id !== id));
    setClassSchedule((prev) => prev.filter((s) => s.child_id !== id));
    setEditingChild(null);
  }

  // «تم» تنقل الواجب لقائمة المنجز (يبقى ظاهراً بـ✓ بالخطة الأسبوعية)،
  // وdone=false ترجّعه لمكانه حسب تاريخه. تحديث محلي فوري بلا إعادة تحميل.
  async function handleMarkDone(taskId, done = true) {
    const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id, done }) });
    if (!res.ok) { alert("تعذّر تحديث الواجب، حاولي مرة ثانية."); return; }
    done ? hapticSuccess() : hapticLight();
    const found = [...tasks, ...undatedTasks, ...upcomingTasks, ...doneTasks].find((t) => t.id === taskId);
    const strip = (prev) => prev.filter((t) => t.id !== taskId);
    setTasks(strip); setUndatedTasks(strip); setUpcomingTasks(strip); setDoneTasks(strip);
    if (found) {
      const updated = { ...found, status: done ? "done" : "active" };
      if (done) setDoneTasks((prev) => [...prev, updated]);
      else if (!updated.due_date) setUndatedTasks((prev) => [...prev, updated]);
      else if (weekRange?.saturday && updated.due_date > weekRange.saturday) setUpcomingTasks((prev) => [...prev, updated]);
      else setTasks((prev) => [...prev, updated]);
    }
    setOpenTask(null);
  }

  async function handleDeleteTask(taskId) {
    if (!confirm("حذف هذا الواجب نهائياً؟")) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر حذف الواجب، حاولي مرة ثانية."); return; }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUndatedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUpcomingTasks((prev) => prev.filter((t) => t.id !== taskId));
    setDoneTasks((prev) => prev.filter((t) => t.id !== taskId));
    setOpenTask(null);
  }

  // تحديث جزئي أو كامل لواجب موجود — تاريخ فقط (السطر القديم) أو مادة/نوع/
  // تفاصيل/تاريخ معاً (التعديل الكامل من TaskModal). يرمي عند الفشل عشان
  // الشاشة تعرض رسالة الخطأ وتبقى مفتوحة بدل ما تقفل بصمت.
  async function handleUpdateTask(taskId, updates) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "تعذّر حفظ التعديلات");
    }
    await loadAll(mother.id);
  }

  async function handleToggleReq(id) {
    const res = await fetch(`/api/requirements/${id}/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر تحديث الطلب، حاولي مرة ثانية."); return; }
    hapticLight();
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, bought: !r.bought } : r)));
  }

  async function handleDeleteReq(id) {
    if (!confirm("حذف هذا الطلب؟")) return;
    const res = await fetch(`/api/requirements/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر حذف الطلب، حاولي مرة ثانية."); return; }
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleUpdateReq(id, updates) {
    const res = await fetch(`/api/requirements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "تعذّر حفظ التعديلات");
    }
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, item: updates.item ?? r.item, due_date: "dueDate" in updates ? updates.dueDate : r.due_date } : r)));
  }

  async function handleClearBought(childId) {
    if (!confirm("مسح كل المستلزمات المُشتراة لهذا الطالب/ة؟")) return;
    const res = await fetch("/api/requirements/clear-bought", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId, motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر المسح، حاولي مرة ثانية."); return; }
    setRequirements((prev) => prev.filter((r) => !(r.child_id === childId && r.bought)));
  }

  // إضافة واجب/اختبار يدوياً — تأخذ نفس مسار الترتيب والتذكيرات اللي
  // تمشي عليه المهام المستخرجة من الصور (نفس الجدول، نفس كرون التذكيرات).
  async function handleAddTask(taskData) {
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskData) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || "تعذّرت إضافة الواجب، حاولي مرة ثانية."); return; }
    setShowAddTask(false);
    await loadAll(mother.id);
  }

  // تعديل خانة بجدول الحصص — إضافة (POST) لو الخانة فاضية أو تحديث (PATCH)
  // لو فيها حصة أصلاً. اليوم ورقم الحصة يحددان الخانة نفسها فما يتغيّران.
  async function handleSaveScheduleCell(entryId, payload) {
    const res = entryId
      ? await fetch(`/api/class-schedule/${entryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/class-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "تعذّر حفظ الحصة");
    }
    setEditingCell(null);
    await loadAll(mother.id);
  }

  async function handleDeleteScheduleCell(entryId) {
    if (!confirm("حذف هذه الحصة من الجدول؟")) return;
    const res = await fetch(`/api/class-schedule/${entryId}`, { method: "DELETE" });
    if (!res.ok) { alert("تعذّر الحذف، حاولي مرة ثانية."); return; }
    setEditingCell(null);
    await loadAll(mother.id);
  }

  if (loading || (mother && (!schools || !dataLoaded))) {
    return (
      <>
        <div style={{ height: "100%", background: "#FAF7F2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 28 }}>
          <img src="/logo.png" alt="دفتري" className="splash-logo" style={{ width: 68, height: 68, borderRadius: 21 }} />
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: "#5C4B8C", textAlign: "center", lineHeight: 1.9, maxWidth: 280 }}>
            مع دفتري ما راح تنسين واجب ولا اختبار
          </p>
        </div>
        <InstallPrompt />
      </>
    );
  }

  if (!mother) {
    return (
      <>
        <Onboarding onDone={handleAuthenticated} />
        <InstallPrompt />
      </>
    );
  }

  // مشتركة قديمة بلا رقم سري: نطلبه أول ما تفتح التطبيق، قبل أي شي ثاني.
  // جلستها الحالية هي إثبات الهوية، فما نحتاج كوداً ولا تكلفة Twilio —
  // وبعدها يصير دخولها من أي جهاز بالموبايل + الرقم السري.
  if (mother && dataLoaded && needsPassword) {
    return (
      <>
        <ExistingUserPasswordSetup name={mother.name} onDone={() => setNeedsPassword(false)} />
        <InstallPrompt />
      </>
    );
  }

  // اشتراك التطبيق الشامل — appAccess تكون null لحظياً وقت الفحص الأول،
  // ونعتبرها "مسموح" بهالحالة عشان ما نعطّل تجربة التحميل المعتادة طول ما
  // الميزة معطّلة (الوضع الافتراضي). القفل الفعلي بس لما يرجع allowed:false.
  if (appAccess && !appAccess.allowed) {
    return (
      <>
        <AppAccessPaywall studentsCount={appAccess.studentsCount || children.length} subscription={appAccess.subscription} onUnlocked={() => loadAll(mother.id)} motherId={mother.id} onLogout={handleLogout} />
        <InstallPrompt />
      </>
    );
  }

  const planChild = children.find((c) => c.id === planChildId) || children[0] || null;
  const weekTasksFor = (childId) => tasks.filter((t) => t.child_id === childId);
  const undatedTasksFor = (childId) => undatedTasks.filter((t) => t.child_id === childId);
  const upcomingTasksFor = (childId) => upcomingTasks.filter((t) => t.child_id === childId);
  const todayDayName = DAYS[new Date().getDay()];
  const hasPEToday = (childId) => classSchedule.some((s) => s.child_id === childId && s.day === todayDayName && getSubjectIconFile(s.subject) === "pe");

  return (
    <div dir="rtl" className="app-root" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* بالوضع الأفقي ما فيه إلا ~٣٩٠ بكسل ارتفاع: الترحيب والعنوان
          والتاريخ مكدّسين كانوا ياكلون ثلث الشاشة. الأصناف هنا تخلي
          globals.css يصفّهم بسطر واحد مضغوط لما تنقلب الشاشة. */}
      {native ? (
        <div className="ios-navbar">
          <div className="ios-navbar-row">
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <button onClick={() => setShowProfile(true)} aria-label="حسابي" className="ios-navbar-logo" style={{ background: "none", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
                <img src="/logo.png" alt="" />
              </button>
              <span className="ios-navbar-greeting">مرحباً، {mother.name}</span>
            </div>
            {view === "dashboard" && (
              <button onClick={() => setShowUpload(true)} className="ios-btn-plain" style={{ fontWeight: 600, flexShrink: 0 }}>
                رفع جدول
              </button>
            )}
          </div>
          <div className="ios-navbar-titles">
            <h1 className="ios-large-title">{TABS.find((t) => t.key === view)?.label}</h1>
            <p className="ios-navbar-date">
              {new Date().toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
      ) : (
        <div className="web-header" style={{ flexShrink: 0, zIndex: 10, background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EEE8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <img src="/logo.png" alt="دفتري" className="web-header-logo" style={{ borderRadius: 14, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>مرحباً، {mother.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{new Date().toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {view === "dashboard" && (
              <button onClick={() => setShowUpload(true)} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 14, padding: "10px 16px", borderRadius: 12, minHeight: 40 }}>
                رفع جدول
              </button>
            )}
            <button onClick={() => setShowProfile(true)} title="حسابي" aria-label="حسابي" style={{ background: "#F3F4F6", padding: "8px 10px", borderRadius: 12, minHeight: 40, lineHeight: 1 }}>
              <TileIcon name="gear" size={23} />
            </button>
          </div>
        </div>
      )}

      {/* شاشة المعلم كانت height:100% من منطقة التمرير، وفوقها شريط الأذونات أو
          التقييم — فالمجموع يزيد عن الشاشة بارتفاع الشريط وصف الإرسال ينزل تحت.
          بعمود flex تاخذ الشاشة المساحة المتبقية بالضبط. */}
      <div className="app-scroll" style={{ flex: 1, ...(view === "teacher" ? { display: "flex", flexDirection: "column" } : {}) }} ref={scrollRef}>
        {native && (
          <div className="ios-refresh" style={{ height: pull }}>
            {pull > 8 && <div className="ios-spinner" />}
          </div>
        )}
        <PermissionsBanner />
        <FamilyInviteBanner onJoined={() => loadAll(mother.id)} />
        {feedbackDue && <FeedbackBanner onOpen={() => setShowFeedback(true)} />}
        {view === "dashboard" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>الخطة الأسبوعية</span>
                  <button onClick={() => setShowAddChild(true)} style={{ background: "none", color: "#B7A6E8", fontWeight: 700, fontSize: 13, padding: "8px 4px", minHeight: 36 }}>+ إضافة طالب/ة</button>
                </div>
                {children.length > 1 && (
                  <ChildSwitcher children={children} selectedId={planChild.id} onSelect={(id) => { setPlanChildId(id); try { localStorage.setItem("daftary_plan_child", id); } catch {} }} />
                )}
                <WeekPlanPanel
                  key={planChild.id}
                  child={planChild}
                  motherId={mother.id}
                  tasks={[...weekTasksFor(planChild.id), ...undatedTasksFor(planChild.id), ...upcomingTasksFor(planChild.id)]}
                  doneTasks={doneTasks.filter((t) => t.child_id === planChild.id)}
                  weekRange={weekRange}
                  hasPEToday={hasPEToday(planChild.id)}
                  onToggle={handleMarkDone}
                  onOpenTask={setOpenTask}
                  onEdit={() => setEditingChild(planChild)}
                  onAddTask={() => setShowAddTask(true)}
                  onClearedDone={(childId) => setDoneTasks((prev) => prev.filter((t) => t.child_id !== childId))}
                />
              </>
            )}
          </div>
        ) : view === "schedule" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <>
                {native ? (
                  <div className="ios-segmented">
                    <button onClick={() => setScheduleSubTab("schedule")} data-active={scheduleSubTab === "schedule"}>الجداول</button>
                    <button onClick={() => setScheduleSubTab("requirements")} data-active={scheduleSubTab === "requirements"}>الطلبات</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setScheduleSubTab("schedule")} style={{ flex: 1, padding: 10, borderRadius: 12, background: scheduleSubTab === "schedule" ? "#B7A6E8" : "#F3F4F6", color: scheduleSubTab === "schedule" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <TileIcon name="schedule" size={17} />
                        الجداول
                      </span>
                    </button>
                    <button onClick={() => setScheduleSubTab("requirements")} style={{ flex: 1, padding: 10, borderRadius: 12, background: scheduleSubTab === "requirements" ? "#B7A6E8" : "#F3F4F6", color: scheduleSubTab === "requirements" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <TileIcon name="requirements" size={17} />
                        الطلبات
                      </span>
                    </button>
                  </div>
                )}

                {scheduleSubTab === "requirements" ? (
                  children.map((c) => (
                    <RequirementsCard key={c.id} child={c} items={requirements.filter((r) => r.child_id === c.id)} onToggle={handleToggleReq} onDeleteReq={handleDeleteReq} onClearBought={handleClearBought} onUpdateReq={handleUpdateReq} />
                  ))
                ) : (
                  <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>جدول الحصص الأسبوعي</span>
                  <button onClick={() => setShowUploadSchedule(true)} style={{ background: "none", color: "#B7A6E8", fontWeight: 700, fontSize: 13, padding: "8px 4px", minHeight: 36 }}>+ رفع/تحديث الجدول</button>
                </div>
                {children.map((c) => (
                  <ScheduleCard key={c.id} child={c} schedule={classSchedule.filter((s) => s.child_id === c.id)} onUpload={() => setShowUploadSchedule(true)} onCellClick={(day, period, entry) => setEditingCell({ child: c, day, period, entry })} />
                ))}
                <AttachmentsCard children={children} refreshKey={attachmentsKey} />
                  </>
                )}
              </>
            )}
          </div>
        ) : view === "progress" ? (
          <div style={{ padding: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <ProgressView children={children} motherId={mother.id} classSchedule={classSchedule} />
            )}
          </div>
        ) : (
          children.length === 0 ? (
            <div style={{ padding: 16 }}><EmptyState onAdd={() => setShowAddChild(true)} /></div>
          ) : (
            <TeacherView children={children} motherId={mother.id} />
          )
        )}
        <div style={{ height: 8 }} />
      </div>

      {native ? (
        <div className="ios-tabbar">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setView(t.key)} data-active={view === t.key}>
              <TabIcon tab={t.key} active={view === t.key} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ flexShrink: 0, zIndex: 10, background: "rgba(255,255,255,.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid #F0EEE8", display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setView(t.key)} style={{ flex: 1, padding: "8px 0 6px", background: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: view === t.key ? "#B7A6E8" : "#9CA3AF", fontWeight: 700, fontSize: 11, minHeight: 52 }}>
              {/* التبويب غير المحدد يخفت بدل ما يختفي لونه — يبقى الشريط
                  هادياً والمحدد واضح. */}
              <TileIcon name={t.key} size={25} style={{ opacity: view === t.key ? 1 : 0.6 }} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {showAddChild && <AddChildModal schools={schools} nextColorIdx={children.length} onClose={() => setShowAddChild(false)} onSave={handleAddChild} />}
      {showAddTask && planChild && <AddTaskModal child={planChild} onClose={() => setShowAddTask(false)} onSave={handleAddTask} />}
      {editingCell && (
        <EditScheduleCellModal
          child={editingCell.child}
          day={editingCell.day}
          period={editingCell.period}
          entry={editingCell.entry}
          onClose={() => setEditingCell(null)}
          onSave={handleSaveScheduleCell}
          onDelete={handleDeleteScheduleCell}
        />
      )}
      {editingChild && (
        <AddChildModal
          schools={schools}
          nextColorIdx={editingChild.color_idx}
          child={editingChild}
          onClose={() => setEditingChild(null)}
          onSave={(data) => handleUpdateChild(editingChild.id, data)}
          onDelete={() => handleDeleteChild(editingChild.id)}
        />
      )}
      {showUpload && (
        <UploadView
          children={children}
          motherId={mother.id}
          hint="ارفعي الخطط الأسبوعية، جدول الاختبارات ومتطلبات العام الدراسي هنا"
          onClose={() => setShowUpload(false)}
          onDone={() => { loadAll(mother.id); setAttachmentsKey((k) => k + 1); }}
          onReview={(draft) => { setShowUpload(false); setReviewDraft(draft); }}
        />
      )}
      {reviewDraft && (
        <ReviewDraftScreen
          draft={reviewDraft}
          child={children.find((c) => c.id === reviewDraft.childId)}
          onClose={() => setReviewDraft(null)}
          onApplied={() => { setReviewDraft(null); loadAll(mother.id); }}
        />
      )}
      {showUploadSchedule && (
        <UploadView
          children={children}
          motherId={mother.id}
          endpoint="/api/upload-class-schedule"
          title="رفع جدول الحصص"
          buttonLabel="تحليل وتصميم الجدول"
          hint="ارفعي صورة جدول الحصص الأسبوعي (جدول المواد اليومي) هنا"
          renderSummary={(s) => (
            <div style={{ background: "#F0FDF4", color: "#166534", borderRadius: 12, padding: 12, fontSize: 13 }}>
              تم تحليل {s.imagesProcessed} صورة ✓ — تصميم جدول الحصص ({s.matchedPeriods} حصة).
            </div>
          )}
          onClose={() => setShowUploadSchedule(false)}
          onDone={() => { loadAll(mother.id); setAttachmentsKey((k) => k + 1); }}
        />
      )}
      {openTask && <TaskModal task={openTask} motherId={mother.id} color={PALETTE[(children.find((c) => c.id === openTask.child_id)?.color_idx || 0) % PALETTE.length]} onClose={() => setOpenTask(null)} onMarkDone={handleMarkDone} onDelete={handleDeleteTask} onUpdateTask={handleUpdateTask} />}
      {showProfile && (
        <ProfileView
          mother={mother}
          childrenCount={children.length}
          onClose={() => setShowProfile(false)}
          onLogout={handleLogout}
          onAccountDeleted={handleAccountDeleted}
          onDataCleared={() => loadAll(mother.id)}
          onManageSubscription={() => setShowSubscriptionManage(true)}
        />
      )}
      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          onDone={() => { setShowFeedback(false); setFeedbackDue(false); }}
        />
      )}
      {showSubscriptionManage && (
        <SubscriptionManageView
          motherId={mother.id}
          studentsCount={children.length}
          onClose={() => setShowSubscriptionManage(false)}
          onChanged={() => loadAll(mother.id)}
        />
      )}
      <InstallPrompt />
    </div>
  );
}

function InstallPrompt() {
  const [platform, setPlatform] = useState(null);
  const [visible, setVisible] = useState(false);
  const promptRef = useRef(null);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone || isNativeApp() || localStorage.getItem("daftary_install_dismissed")) return;

    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS) {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    function handler(e) {
      e.preventDefault();
      promptRef.current = e;
      setPlatform("android");
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("daftary_install_dismissed", "1");
  }

  async function install() {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    await promptRef.current.userChoice;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div dir="rtl" style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 12px)", left: 12, right: 12, zIndex: 60, background: "white", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.18)", padding: 14, display: "flex", alignItems: "center", gap: 10, maxWidth: 420, margin: "0 auto" }}>
      <img src="/logo.png" alt="دفتري" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 13 }}>
          {platform === "ios" ? "حمّلي تطبيق دفتري" : "أضيفي دفتري للشاشة الرئيسية"}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>
          {platform === "ios" ? "تجربة أسرع وإشعارات فورية" : "وصول أسرع من شاشة موبايلك مباشرة"}
        </p>
      </div>
      {platform === "ios" ? (
        // شارة App Store الرسمية. آبل تشترط عرضها بلا تعديل على الفن نفسه
        // ومع مساحة فارغة حولها لا تقل عن ١٠٪ من ارتفاعها — فنعطيها هامشاً
        // وما نضغطها داخل الشريط.
        <a href={APP_STORE_URL} target="_blank" rel="noreferrer" style={{ flexShrink: 0, lineHeight: 0, padding: "4px 0" }}>
          <img src="/app-store-badge.png" alt="حمّلي دفتري من App Store" width={120} height={36} style={{ display: "block" }} />
        </a>
      ) : (
        <button onClick={install} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, flexShrink: 0 }}>تثبيت</button>
      )}
      <button onClick={dismiss} style={{ background: "none", color: "#9CA3AF", fontSize: 18, width: 28, height: 28, flexShrink: 0 }}>×</button>
    </div>
  );
}

function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // step: "login" (موبايل + رقم سري) | "signup" (اسم + موبايل + رقم سري)
  // — الاثنان بلا أي كود. و"code"/"setPassword" ما تُستخدمان إلا بمسار
  // «نسيت الرقم السري»، وهو المكان الوحيد اللي بقي فيه Twilio: بدون أي
  // قناة تحقق يقدر أي شخص يعيد تعيين رقم سري لأي حساب ويدخل بيانات عياله.
  const [step, setStep] = useState("login");
  // دخلنا من «نسيت الرقم السري»؟ لازم نعرف: verify-otp يرجّع
  // needsPassword=false لمن عندها رقم سري أصلاً، فبدون هالعلم كانت اللي
  // نسيت رقمها تدخل بالكود وتطلع بلا ما تحدّد رقماً جديداً — ويبقى القديم
  // المنسي هو الوحيد اللي يدخّلها.
  const [forgot, setForgot] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // نتيجة الكود الناجح (ولي الأمر + الجلسة) نخزّنها هنا لين تنتهي خطوة
  // الرقم السري (اختيارية) — عشان onDone يُنادى مرة وحدة بالنهاية.
  const [verified, setVerified] = useState(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const phoneOk = /^[0-9]{8}$/.test(phone.trim());
  const canLogin = phoneOk && password.trim().length >= 4;
  const canSignup = phoneOk && name.trim().length > 1 && password.trim().length >= 4 && password === password2;

  // عدّاد تنازلي قبل ما نسمح بإعادة الإرسال — Twilio يحدّها بـ٥ مرات كل ١٠ دقائق،
  // فنمنع المستخدمة من حرق محاولاتها بالضغط المتكرر.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "صار خطأ، حاولي مرة ثانية.");
    return data;
  }

  function friendly(err) {
    return String(err.message).includes("Failed to fetch")
      ? "تعذّر الاتصال بالإنترنت، تأكدي من الشبكة وحاولي مرة ثانية."
      : err.message;
  }

  // bypassPassword=true لما تضغط «نسيت الرقم السري» — تجبر إرسال الكود
  // حتى لو عندها رقم سري محدّد أصلاً.
  async function sendCode(isResend = false, bypassPassword = false) {
    setBusy(true);
    setError("");
    if (bypassPassword) setForgot(true);
    try {
      const data = await post("/api/auth/request-otp", { phone: phone.trim(), resend: isResend === true, bypassPassword });
      if (data.channel === "password") {
        setStep("password");
        setPassword("");
      } else {
        setStep("code");
        setCode("");
        setResendIn(30);
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/auth/verify-otp", {
        name: name.trim(),
        phone: phone.trim(),
        code: code.trim(),
      });
      if (data.needsPassword || forgot) {
        // خطوة اختيارية — الحساب مسجَّل دخول فعلياً، بس نعرض فرصة تحديد
        // رقم سري قبل ما نكمّل، عشان الدخول القادم يصير بلا كود.
        setVerified(data);
        setStep("setPassword");
        setBusy(false);
      } else {
        onDone(data.mother, data.token);
      }
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }

  async function submitPassword() {
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/auth/login-password", { phone: phone.trim(), password });
      onDone(data.mother, data.token);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }

  // إنشاء حساب بلا كود: الاسم + الموبايل + رقم سري.
  async function submitSignup() {
    if (password.trim().length < 4) { setError("الرقم السري لازم يكون ٤ أحرف/أرقام على الأقل"); return; }
    if (password !== password2) { setError("الرقمان غير متطابقين"); return; }
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/auth/signup", { name: name.trim(), phone: phone.trim(), password });
      onDone(data.mother, data.token);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }

  function goto(next) {
    setStep(next);
    setError("");
    setPassword("");
    setPassword2("");
    setForgot(false);
  }

  async function saveNewPassword() {
    if (password.trim().length < 4) { setError("الرقم السري لازم يكون ٤ أحرف/أرقام على الأقل"); return; }
    if (password !== password2) { setError("الرقمان غير متطابقين"); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${verified.token}` },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "تعذّر الحفظ");
      onDone(verified.mother, verified.token);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }


  if (step === "setPassword") {
    return (
      <SetPasswordScreen
        password={password}
        setPassword={setPassword}
        password2={password2}
        setPassword2={setPassword2}
        busy={busy}
        error={error}
        onSave={saveNewPassword}
        title={forgot ? "اختاري رقماً سرياً جديداً" : undefined}
        subtitle={forgot ? "تأكدنا من رقمك بالكود — حدّدي رقمك السري الجديد وبتدخلين فيه من أي جهاز" : undefined}
      />
    );
  }

  if (step === "code") {
    return (
      <VerifyCodeScreen
        phone={phone.trim()}
        code={code}
        setCode={setCode}
        busy={busy}
        error={error}
        resendIn={resendIn}
        onSubmit={submitCode}
        onResend={() => sendCode(true)}
        onBack={() => goto("login")}
      />
    );
  }

  return (
    <AuthShell>
      {step === "signup" ? (
        <>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <img src="/logo.png" alt="دفتري" style={{ width: 96, height: 96, borderRadius: 24, margin: "0 auto 12px", display: "block", boxShadow: "0 6px 18px rgba(183,166,232,.4)" }} />
            <h1 style={{ color: "#5C4B8C", margin: 0, fontSize: 22, fontWeight: 800 }}>إنشاء حساب</h1>
            <p style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "10px 0 0", background: "#FFF7E6", color: "#8C6027", fontWeight: 800, fontSize: 12.5, padding: "7px 14px", borderRadius: 999 }}>
              🎁 جرّبي مجاناً: طالب واحد + جدول حصص + خطة أسبوعية، بلا اشتراك
            </p>
          </div>

          <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <label style={AUTH_LABEL}>الاسم</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" style={{ ...AUTH_FIELD, marginBottom: 12 }} />

            <label style={AUTH_LABEL}>رقم الموبايل</label>
            <PhoneField phone={phone} setPhone={setPhone} />

            <label style={AUTH_LABEL}>الرقم السري</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="٤ أحرف/أرقام على الأقل"
              autoComplete="new-password" style={{ ...AUTH_FIELD, marginBottom: 10, direction: "ltr", textAlign: "center" }} />
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="أعيدي كتابته"
              autoComplete="new-password" style={{ ...AUTH_FIELD, marginBottom: 14, direction: "ltr", textAlign: "center" }} />

            <button disabled={!canSignup || busy} onClick={submitSignup}
              style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: canSignup && !busy ? 1 : 0.4 }}>
              {busy ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </button>
            {error && <p style={AUTH_ERROR}>{error}</p>}
          </div>

          <button onClick={() => goto("login")} style={AUTH_SWITCH}>
            عندك حساب؟ <span style={{ color: "#5C4B8C", fontWeight: 800 }}>سجّلي دخول</span>
          </button>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <img src="/logo.png" alt="دفتري" style={{ width: 120, height: 120, borderRadius: 28, margin: "0 auto 12px", display: "block", boxShadow: "0 6px 18px rgba(183,166,232,.4)" }} />
            <h1 style={{ color: "#5C4B8C", margin: 0, fontSize: 24, fontWeight: 800 }}>دفتري</h1>
            <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>متابعة واجبات واختبارات العيال، بلا تعقيد</p>
          </div>

          <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <label style={AUTH_LABEL}>رقم الموبايل</label>
            <PhoneField phone={phone} setPhone={setPhone} />

            <label style={AUTH_LABEL}>الرقم السري</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رقمك السري"
              autoComplete="current-password" style={{ ...AUTH_FIELD, marginBottom: 14, direction: "ltr", textAlign: "center" }} />

            <button disabled={!canLogin || busy} onClick={submitPassword}
              style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: canLogin && !busy ? 1 : 0.4 }}>
              {busy ? "جاري الدخول..." : "تسجيل الدخول"}
            </button>
            {error && <p style={AUTH_ERROR}>{error}</p>}

            {/* المكان الوحيد اللي بقي فيه كود تحقق: بدونه يقدر أي شخص يعيد
                تعيين رقم سري لأي رقم ويدخل حساب غيره. */}
            <button disabled={busy || !/^[0-9]{8}$/.test(phone.trim())} onClick={() => sendCode(false, true)}
              style={{ width: "100%", padding: 10, background: "none", color: "#6B7280", fontWeight: 700, fontSize: 12.5, minHeight: 40, marginTop: 4, opacity: /^[0-9]{8}$/.test(phone.trim()) ? 1 : 0.45 }}>
              نسيت الرقم السري
            </button>
          </div>

          <button onClick={() => goto("signup")} style={AUTH_SWITCH}>
            ما عندك حساب؟ <span style={{ color: "#5C4B8C", fontWeight: 800 }}>أنشئي حساب</span>
          </button>
        </>
      )}
    </AuthShell>
  );
}

const AUTH_LABEL = { fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 };
const AUTH_FIELD = { width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 16 };
const AUTH_ERROR = { color: "#B91C1C", fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.7 };
const AUTH_SWITCH = { width: "100%", padding: 12, marginTop: 12, background: "none", color: "#6B7280", fontWeight: 700, fontSize: 13.5, minHeight: 44 };

// لوحة أرقام بدل لوحة الحروف — والتنظيف يقبل اللصق بمسافات أو شرطات
// (65 068 000) بدل ما يرفضه التحقق بلا ما تعرف السبب.
function PhoneField({ phone, setPhone }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      <span style={{ background: "#F3F4F6", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "#6B7280" }}>+965</span>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
        placeholder="XXXXXXXX"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={8}
        style={{ ...AUTH_FIELD, flex: 1, direction: "ltr" }}
      />
    </div>
  );
}

// شاشة إلزامية للمشتركات القديمات بعد إلغاء الكود (قرار ١٩ سبتمبر):
// حساباتهن انفتحت أيام كان الرقم السري اختيارياً، و٨٠٪ تخطّوه. الحين
// الدخول صار بالموبايل + الرقم السري بس، فبدون رقم سري ما يقدرن يدخلن
// من جهاز جديد. نطلبه منهن وهن داخلات أصلاً — الجلسة السارية تثبت
// الهوية، فبلا كود ولا رسالة.
function ExistingUserPasswordSetup({ name, onDone }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (password.trim().length < 4) { setError("الرقم السري لازم يكون ٤ أحرف/أرقام على الأقل"); return; }
    if (password !== password2) { setError("الرقمان غير متطابقين"); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "تعذّر الحفظ");
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <SetPasswordScreenBody
        title={`أهلاً ${name || ""}، أكملي حسابك`}
        subtitle="صار الدخول بالموبايل + رقم سري بدل الكود. حدّدي رقمك السري مرة وحدة الحين — بياناتك وعيالك كلهم باقين كما هم."
        password={password} setPassword={setPassword}
        password2={password2} setPassword2={setPassword2}
        busy={busy} error={error} onSave={save}
      />
    </AuthShell>
  );
}

// الإطار المشترك لشاشات الدخول — نفس الخلفية والتذييل بكل الشاشات.
function AuthShell({ children }) {
  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 24px calc(env(safe-area-inset-bottom) + 14px)", background: "linear-gradient(180deg,#F7F5FC,#F1EFFA)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", maxWidth: 380, margin: "0 auto", paddingBottom: 24 }}>
        {children}
      </div>
      <div style={{ textAlign: "center", flexShrink: 0, width: "100%", maxWidth: 380, margin: "0 auto" }}>
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "8px 18px", borderRadius: 12, background: "white", color: "#5C4B8C", fontWeight: 700, fontSize: 13, textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          تواصل معنا
        </a>
        <p style={{ color: "#B7B2C4", fontSize: 11, margin: "8px 0 0" }}>Copyright © Reemora.app 2026</p>
      </div>
    </div>
  );
}

function VerifyCodeScreen({ phone, code, setCode, busy, error, resendIn, onSubmit, onResend, onBack }) {
  const canSubmit = /^[0-9]{4,10}$/.test(code.trim()) && !busy;
  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 24px calc(env(safe-area-inset-bottom) + 14px)", background: "linear-gradient(180deg,#F7F5FC,#F1EFFA)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", maxWidth: 380, margin: "0 auto", paddingBottom: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 100, height: 100, borderRadius: 24, margin: "0 auto 14px", display: "block", boxShadow: "0 6px 18px rgba(183,166,232,.4)" }} />
          <h1 style={{ color: "#5C4B8C", margin: 0, fontSize: 21, fontWeight: 800 }}>أدخلي كود التحقق</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "6px 0 0", lineHeight: 1.7 }}>
            أرسلنا كود على واتساب للرقم<br />
            <span style={{ direction: "ltr", display: "inline-block", fontWeight: 700, color: "#5C4B8C" }}>+965 {phone}</span>
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="------"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px", fontSize: 24, fontWeight: 700, textAlign: "center", letterSpacing: 8, direction: "ltr", marginBottom: 14 }}
          />
          <button disabled={!canSubmit} onClick={onSubmit} style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: canSubmit ? 1 : 0.4 }}>
            {busy ? "جاري التحقق..." : "دخول"}
          </button>
          {error && <p style={{ color: "#B91C1C", fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.7 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 8 }}>
            <button onClick={onBack} disabled={busy} style={{ background: "none", color: "#6B7280", fontSize: 12.5, fontWeight: 700, padding: "8px 0", minHeight: 40 }}>
              تغيير الرقم
            </button>
            <button onClick={onResend} disabled={busy || resendIn > 0} style={{ background: "none", color: resendIn > 0 ? "#B7B2C4" : "#7B68C4", fontSize: 12.5, fontWeight: 700, padding: "8px 0", minHeight: 40 }}>
              {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn}` : "إعادة إرسال الكود"}
            </button>
          </div>
        </div>

        <p style={{ color: "#9CA3AF", fontSize: 11.5, margin: "14px 0 0", lineHeight: 1.7, textAlign: "center" }}>
          ما وصلك واتساب؟ بنرسله رسالة نصية تلقائياً خلال ثواني
        </p>
      </div>
    </div>
  );
}

// دخول برقم سري — يظهر بدل خطوة الكود لرقم سبق أن حدّد رقماً سرياً، فما
// فيه انتظار رسالة ولا تكلفة Twilio.
function PasswordLoginScreen({ password, setPassword, busy, error, onSubmit, onForgot, onBack }) {
  const canSubmit = password.trim().length >= 4 && !busy;
  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 24px calc(env(safe-area-inset-bottom) + 14px)", background: "linear-gradient(180deg,#F7F5FC,#F1EFFA)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", maxWidth: 380, margin: "0 auto", paddingBottom: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 100, height: 100, borderRadius: 24, margin: "0 auto 14px", display: "block", boxShadow: "0 6px 18px rgba(183,166,232,.4)" }} />
          <h1 style={{ color: "#5C4B8C", margin: 0, fontSize: 21, fontWeight: 800 }}>أدخلي رقمك السري</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "6px 0 0" }}>مرحباً بعودتك 🤍</p>
        </div>

        <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="الرقم السري"
            autoComplete="current-password"
            style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px", fontSize: 18, textAlign: "center", direction: "ltr", marginBottom: 14 }}
            onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) onSubmit(); }}
          />
          <button disabled={!canSubmit} onClick={onSubmit} style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: canSubmit ? 1 : 0.4 }}>
            {busy ? "جاري الدخول..." : "دخول"}
          </button>
          {error && <p style={{ color: "#B91C1C", fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.7 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 8 }}>
            <button onClick={onBack} disabled={busy} style={{ background: "none", color: "#6B7280", fontSize: 12.5, fontWeight: 700, padding: "8px 0", minHeight: 40 }}>
              تغيير الرقم
            </button>
            <button onClick={onForgot} disabled={busy} style={{ background: "none", color: "#7B68C4", fontSize: 12.5, fontWeight: 700, padding: "8px 0", minHeight: 40 }}>
              نسيت الرقم السري؟
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// تحديد الرقم السري — **إلزامي** (قرار صاحبة التطبيق ١٩ سبتمبر). كان
// اختيارياً بزر «تخطي الآن»، والنتيجة إن ٨٠٪ من الحسابات (١٢٦ من ١٥٨)
// تخطّوه فصار يوصلهم كود بكل دخول، وهذا هو مصدر فاتورة Twilio كلها.
// بالإلزام يصير الكود مرة واحدة لكل رقم مدى الحياة بدل مرة كل دخول.
function SetPasswordScreen(props) {
  return (
    <AuthShell>
      <SetPasswordScreenBody {...props} />
    </AuthShell>
  );
}

// جسم شاشة الرقم السري بلا إطار — تستخدمه شاشتان: بعد «نسيت الرقم السري»
// وشاشة المشتركات القديمات.
function SetPasswordScreenBody({ password, setPassword, password2, setPassword2, busy, error, onSave, title, subtitle }) {
  return (
    <>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 40 }}>🔒</span>
          <h1 style={{ color: "#5C4B8C", margin: "8px 0 0", fontSize: 20, fontWeight: 800 }}>{title || "حدّدي رقماً سرياً"}</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "6px 0 0", lineHeight: 1.7 }}>
            {subtitle || "عشان دخولك القادم — حتى من جهاز جديد — يصير بلا كود"}
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رقم سري جديد (٤ أحرف/أرقام على الأقل)"
            autoComplete="new-password"
            style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 16, marginBottom: 10, direction: "ltr", textAlign: "center" }}
          />
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="أعيدي كتابته"
            autoComplete="new-password"
            style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 16, marginBottom: 14, direction: "ltr", textAlign: "center" }}
          />
          <button disabled={busy} onClick={onSave} style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: busy ? 0.6 : 1 }}>
            {busy ? "جاري الحفظ..." : "حفظ"}
          </button>
          {error && <p style={{ color: "#B91C1C", fontSize: 12.5, margin: "6px 0 0", lineHeight: 1.7, textAlign: "center" }}>{error}</p>}
        </div>
    </>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <p style={{ fontWeight: 800, marginBottom: 4 }}>ابدئي بإضافة أول طالب/ة</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 18 }}>سجّلي مدرسته وصفه، وبعدها ارفعي صور الجدول</p>
      <button onClick={onAdd} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, padding: "10px 20px", borderRadius: 12 }}>+ إضافة طالب/ة</button>
    </div>
  );
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

// مربّع ✓ بمساحة لمس ٤٤ بكسل: أخضر عند الإنجاز، إطار رمادي قبله.
function CheckBox({ checked, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={checked} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", flexShrink: 0, padding: 0 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, border: checked ? "none" : "2px solid #C9C6D6", background: checked ? "#22C55E" : "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>
        {checked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
      </span>
    </button>
  );
}

function ProgressRing({ pct, color, size = 78, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ECEAF3" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .4s" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#1F2937" }}>{pct}%</span>
    </div>
  );
}

function PlanRow({ task, onToggle, onOpen }) {
  const done = task.status === "done";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 0", borderTop: "1px solid #F3F2EE" }}>
      <button onClick={() => onOpen(task)} style={{ flex: 1, minWidth: 0, background: "none", textAlign: "right", padding: "4px 0", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <SubjectIcon subject={task.subject} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: done ? "#9CA3AF" : "#1F2937", textDecoration: done ? "line-through" : "none", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {task.subject}
            {task.type === "اختبار" && <span style={{ fontSize: 10.5, fontWeight: 800, background: "#FEE2E2", color: "#B91C1C", borderRadius: 999, padding: "2px 8px" }}>اختبار</span>}
            {task.type === "مشروع" && <span style={{ fontSize: 10.5, fontWeight: 800, background: "#DBEAFE", color: "#1D4ED8", borderRadius: 999, padding: "2px 8px" }}>مشروع</span>}
            {task.type === "حفظ" && <span style={{ fontSize: 10.5, fontWeight: 800, background: "#EDE9FE", color: "#5B21B6", borderRadius: 999, padding: "2px 8px" }}>حفظ</span>}
            {task.type === "درس" && <span style={{ fontSize: 10.5, fontWeight: 800, background: "#E0F2F1", color: "#0F766E", borderRadius: 999, padding: "2px 8px" }}>درس</span>}
          </p>
          {/* النص كما كُتب بالخطة حرفياً — بلا تلخيص ولا تعديل */}
          {task.details && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: done ? "#B0B3BA" : "#6B7280", lineHeight: 1.65, whiteSpace: "pre-line" }}>{renderWithNumbers(task.details)}</p>}
        </div>
      </button>
      <CheckBox checked={done} label={done ? "إرجاعه لغير مكتمل" : "تم"} onClick={() => onToggle(task.id, !done)} />
    </div>
  );
}

// شريط تبديل الطالب/ة فوق الخطة لما يكون فيه أكثر من واحد.
function ChildSwitcher({ children, selectedId, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
      {children.map((c) => {
        const pal = PALETTE[c.color_idx % PALETTE.length];
        const on = c.id === selectedId;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 8px", borderRadius: 999, background: on ? pal.solid : "white", color: on ? "white" : pal.text, border: `1px solid ${on ? pal.solid : pal.soft}`, fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", minHeight: 40, flexShrink: 0 }}>
            <Avatar child={c} size={26} />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

// الخطة الأسبوعية للطالب/ة كقائمة إنجاز — وهي الواجهة الرئيسية للتطبيق
// (قرار صاحبة التطبيق ١٥ سبتمبر): كل واجب بسطر مع تفاصيله كما كُتبت بالخطة
// وعلامة ✓، مجمّعة باليوم، مع نسبة الإنجاز وفلاتر.
// عارض صورة بملء الشاشة مع تكبير: قرصة بإصبعين، وضغطتان سريعتان للتبديل
// بين ملء الشاشة و٢٫٥×، وأزرار − / + لمن ما تنفعه القرصة. التمرير
// والسحب من الحاوية نفسها (overflow: auto) بدل حساب إزاحة يدوي — أقل
// كوداً وأثبت سلوكاً على iOS.
function ImageZoomViewer({ urls, startIndex = 0, onClose }) {
  const [i, setI] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const boxRef = useRef(null);
  const pinch = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => { setZoom(1); }, [i]);

  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  function onTouchStart(e) {
    if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: zoom };
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      const next = pinch.current.z * (dist(e.touches) / pinch.current.d);
      setZoom(Math.min(5, Math.max(1, next)));
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) pinch.current = null;
  }
  function onImgClick() {
    const now = Date.now();
    if (now - lastTap.current < 320) setZoom((z) => (z > 1 ? 1 : 2.5));
    lastTap.current = now;
  }

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 130, background: "#0B0B10", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "calc(env(safe-area-inset-top) + 10px) 14px 10px" }}>
        <button onClick={onClose} aria-label="إغلاق الصورة" style={{ background: "rgba(255,255,255,.14)", color: "white", borderRadius: 999, width: 34, height: 34, fontSize: 18, lineHeight: 1 }}>×</button>
        {urls.length > 1 && (
          <span style={{ color: "rgba(255,255,255,.75)", fontSize: 12.5, fontWeight: 700 }}>صورة {i + 1} من {urls.length}</span>
        )}
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="تصغير" style={{ background: "rgba(255,255,255,.14)", color: "white", borderRadius: 10, width: 36, height: 34, fontSize: 18, lineHeight: 1 }}>−</button>
          <button onClick={() => setZoom((z) => Math.min(5, z + 0.5))} aria-label="تكبير" style={{ background: "rgba(255,255,255,.14)", color: "white", borderRadius: 10, width: 36, height: 34, fontSize: 18, lineHeight: 1 }}>+</button>
        </div>
      </div>

      <div
        ref={boxRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ flex: 1, minHeight: 0, overflow: "auto", display: "grid", placeItems: zoom > 1 ? "start" : "center", touchAction: zoom > 1 ? "pan-x pan-y" : "none" }}
      >
        <img
          src={urls[i]}
          alt="الجدول المرفق"
          onClick={onImgClick}
          style={{ width: `${zoom * 100}%`, maxWidth: "none", display: "block", cursor: zoom > 1 ? "grab" : "zoom-in" }}
        />
      </div>

      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 14px calc(env(safe-area-inset-bottom) + 12px)" }}>
        {urls.length > 1 && (
          <>
            <button onClick={() => setI((n) => (n - 1 + urls.length) % urls.length)} style={{ background: "rgba(255,255,255,.14)", color: "white", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>السابقة</button>
            <button onClick={() => setI((n) => (n + 1) % urls.length)} style={{ background: "rgba(255,255,255,.14)", color: "white", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>التالية</button>
          </>
        )}
        {zoom > 1 && (
          <button onClick={() => setZoom(1)} style={{ background: "rgba(255,255,255,.14)", color: "white", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>ملء الشاشة</button>
        )}
      </div>
    </div>
  );
}

// «الصور المرفقة»: الجداول اللي رفعتها الأم بوضع «إرفاق فقط» — تُعرض
// للرجوع إليها لا أكثر، فما فيها علامة إنجاز ولا تذكير.
function AttachmentsCard({ children, refreshKey }) {
  const [items, setItems] = useState(null);
  const [view, setView] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/attachments")
      .then((r) => r.json())
      .then((d) => { if (alive) setItems(d.attachments || []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [refreshKey]);

  async function remove(id) {
    if (!confirm("حذف هذه الصورة المرفقة نهائياً؟")) return;
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("تعذّر الحذف، حاولي مرة ثانية."); return; }
    setItems((prev) => (prev || []).filter((a) => a.id !== id));
  }

  if (!items || items.length === 0) return null;
  const nameOf = (id) => children.find((c) => c.id === id)?.name || "";

  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid #EEEDE8", overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", background: "#F6F4FB", display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ margin: 0, fontWeight: 900, fontSize: 14, color: "#5C4B8C" }}>الصور المرفقة</p>
        <span style={{ marginInlineStart: "auto", fontSize: 11.5, color: "#9CA3AF", fontWeight: 700 }}>للعرض فقط — بلا تذكير</span>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => a.urls.length && setView(a.urls)}
              style={{ width: 54, height: 54, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1px solid #E5E7EB", padding: 0, background: "#F3F4F6" }}
            >
              {a.urls[0] && <img src={a.urls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#374151" }}>
                {a.kind === "class_schedule" ? "جدول حصص" : "خطة أسبوعية"}
                {nameOf(a.child_id) ? ` — ${nameOf(a.child_id)}` : ""}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#9CA3AF" }}>
                {shortDate(String(a.created_at).slice(0, 10))}
                {a.count > 1 ? ` · ${a.count} صور` : ""}
              </p>
            </div>
            <button onClick={() => a.urls.length && setView(a.urls)} style={{ background: "#F1EFFA", color: "#5C4B8C", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>فتح</button>
            <button onClick={() => remove(a.id)} aria-label="حذف" style={{ background: "none", padding: 6, flexShrink: 0 }}>
              <TileIcon name="trash" size={16} />
            </button>
          </div>
        ))}
      </div>
      {view && <ImageZoomViewer urls={view} onClose={() => setView(null)} />}
    </div>
  );
}

function WeekPlanPanel({ child, motherId, tasks, doneTasks, weekRange, hasPEToday, onToggle, onOpenTask, onEdit, onAddTask, onClearedDone }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  const [filter, setFilter] = useState("all");
  const [memo, setMemo] = useState([]);
  const [editingMemo, setEditingMemo] = useState(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetch(`/api/memorization?childId=${child.id}&motherId=${motherId}`)
      .then((r) => r.json()).then((d) => setMemo(d.items || [])).catch(() => {});
  }, [child.id, motherId]);

  async function toggleMemo(id) {
    const flip = (prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it));
    setMemo(flip);
    hapticLight();
    const res = await fetch(`/api/memorization/${id}/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
    if (!res.ok) setMemo(flip);
  }

  async function saveMemo(id, updates) {
    const res = await fetch(`/api/memorization/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "تعذّر حفظ التعديلات");
    }
    setMemo((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    setEditingMemo(null);
  }

  async function deleteMemo(id) {
    if (!confirm("حذف هذا العنصر من الحفظ نهائياً؟")) return;
    const res = await fetch(`/api/memorization/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("تعذّر الحذف، حاولي مرة ثانية."); return; }
    setMemo((prev) => prev.filter((m) => m.id !== id));
    setEditingMemo(null);
  }

  // ترتيب السطور داخل اليوم = ترتيب استخراجها من الخطة (created_at)، فلا
  // يتغير مكان الواجب لما تعلّمه الأم ✓ أو تتراجع.
  const all = [...tasks, ...doneTasks].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const isDone = (t) => t.status === "done";
  const show = (t) => filter === "all" || (filter === "open" && !isDone(t)) || (filter === "done" && isDone(t)) || (filter === "exam" && t.type === "اختبار");
  const memoShown = memo.filter((m) => filter === "all" || (filter === "open" && !m.done) || (filter === "done" && m.done));

  const total = all.length + memo.length;
  const doneCount = all.filter(isDone).length + memo.filter((m) => m.done).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const female = child.gender === "بنات";
  const mood = total === 0 ? "ما فيه واجبات هذا الأسبوع 🎉" : pct === 100 ? `أكملتِ كل شي يا ${child.name} 🎉` : pct === 0 ? "يلا نبدأ 💪" : `أحسنت يا ${child.name} 💜`;

  const sunday = weekRange?.sunday;
  const saturday = weekRange?.saturday || (sunday ? addDays(sunday, 6) : null);
  const groups = [];
  if (sunday) {
    for (let i = 0; i < 7; i++) {
      const date = addDays(sunday, i);
      const items = all.filter((t) => t.type !== "درس" && t.due_date === date && show(t));
      if (items.length) groups.push({ key: date, label: FULL_DAY_NAMES[i], sub: shortDate(date), items, tone: "day" });
    }
  }
  // «درس» = محتوى المنهج خلال الأسبوع، مو تكليفاً بموعد — قسمه لحاله بدل ما
  // يظهر تحت يوم كأنه تسليم. الأم تعلّمه «تمت المراجعة» وما يجيها عنه تذكير.
  const lessons = all.filter((t) => t.type === "درس" && show(t));
  if (lessons.length) groups.push({ key: "lessons", label: "دروس الأسبوع (المنهج)", items: lessons, tone: "lesson" });
  const upcoming = all.filter((t) => t.type !== "درس" && t.due_date && saturday && t.due_date > saturday && show(t));
  if (upcoming.length) groups.push({ key: "upcoming", label: "واجبات الأسبوع", items: upcoming, tone: "upcoming" });
  const undated = all.filter((t) => t.type !== "درس" && !t.due_date && show(t));
  if (undated.length) groups.push({ key: "undated", label: "بدون تاريخ محدد", items: undated, tone: "undated" });

  const chips = [["all", "الكل"], ["open", "غير مكتمل"], ["done", "مكتمل"], ["exam", "اختبارات"]];
  const groupDone = (items) => items.filter(isDone).length;

  // مسح المنجز: حذف نهائي، فنقول لها بالضبط وش بينمسح قبل ما تضغط —
  // بالتفصيل حسب النوع، لأن «المكتمل» يشمل الدروس المراجَعة والحفظ كذلك
  // لا الواجبات وحدها.
  const doneNow = all.filter(isDone);
  const doneMemoNow = memo.filter((m) => m.done);
  async function clearDone() {
    const parts = [];
    const homework = doneNow.filter((t) => t.type !== "درس").length;
    const lessons = doneNow.filter((t) => t.type === "درس").length;
    if (homework) parts.push(`${homework} واجب/اختبار`);
    if (lessons) parts.push(`${lessons} درس`);
    if (doneMemoNow.length) parts.push(`${doneMemoNow.length} حفظ`);
    if (!parts.length) return;
    if (!confirm(`مسح المنجز لـ ${child.name} نهائياً؟\n\n${parts.join(" · ")}\n\nغير المنجز يبقى كما هو.`)) return;

    setClearing(true);
    const res = await fetch("/api/tasks/clear-done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: child.id }),
    }).catch(() => null);
    setClearing(false);
    if (!res?.ok) { alert("تعذّر المسح، حاولي مرة ثانية."); return; }
    hapticSuccess();
    setMemo((prev) => prev.filter((m) => !m.done));
    onClearedDone?.(child.id);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}`, background: color.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14 }}>
            <Avatar child={child} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>{classLabel(child.grade, child.section)} · {child.school}</p>
              {hasPEToday && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: "white", color: "#8C6027", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999 }}>
                  <img src="/icons/pe.png" alt="" width={14} height={14} style={{ display: "block" }} />
                  بدنية اليوم
                  {child.pe_uniform_color && <span style={{ width: 9, height: 9, borderRadius: "50%", background: child.pe_uniform_color, border: child.pe_uniform_color === "#FFFFFF" ? "1px solid #E5E7EB" : "1px solid rgba(0,0,0,.15)" }} />}
                </span>
              )}
            </div>
            <button onClick={onAddTask} style={{ background: "white", color: color.text, fontSize: 12, fontWeight: 800, padding: "8px 12px", borderRadius: 10, flexShrink: 0 }}>
              + واجب
            </button>
            <button onClick={onEdit} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <TileIcon name="pencil" size={15} />
                تعديل
              </span>
            </button>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 18, padding: 14, display: "flex", alignItems: "center", gap: 14, border: `1px solid ${color.soft}` }}>
          <ProgressRing pct={pct} color={color.solid} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: "#1F2937" }}>{doneCount} من {total} مكتمل</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6B7280" }}>{mood}</p>
          </div>
          {total > 0 && pct >= 80 && (
            <div style={{ flexShrink: 0, background: "#FFF7E6", color: "#8C6027", borderRadius: 14, padding: "8px 10px", fontSize: 11, fontWeight: 800, textAlign: "center", lineHeight: 1.4 }}>
              🏆<br />{female ? "مستمرة" : "مستمر"} نحو التميز
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, background: "white", borderRadius: 14, padding: 4, border: "1px solid #EEEDE8" }}>
          {chips.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} style={{ flex: 1, padding: "8px 4px", borderRadius: 11, fontSize: 12.5, fontWeight: 800, background: filter === key ? color.solid : "transparent", color: filter === key ? "white" : "#6B7280", minHeight: 36 }}>
              {label}
            </button>
          ))}
        </div>

        {doneCount > 0 && (
          <button
            onClick={clearDone}
            disabled={clearing}
            style={{ alignSelf: "flex-start", background: "none", color: "#9CA3AF", fontSize: 12.5, fontWeight: 700, padding: "2px 2px 6px", minHeight: 32, opacity: clearing ? 0.5 : 1 }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <TileIcon name="trash" size={14} />
              {clearing ? "...جاري المسح" : `امسحي المنجز (${doneCount})`}
            </span>
          </button>
        )}

        {groups.length === 0 && memoShown.length === 0 && (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "24px 0" }}>
            {total === 0 ? "ما فيه واجبات هذا الأسبوع — ارفعي الخطة الأسبوعية من زر «رفع جدول» فوق." : "ما فيه شي بهالفلتر."}
          </p>
        )}

        {groups.map((g) => (
          <div key={g.key} style={{ background: "white", borderRadius: 18, overflow: "hidden", border: "1px solid #EEEDE8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: g.tone === "undated" ? "#FEF3C7" : g.tone === "upcoming" ? "#EBF4FA" : g.tone === "lesson" ? "#E0F2F1" : color.bg }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 14, color: g.tone === "undated" ? "#92400E" : g.tone === "upcoming" ? "#31607C" : g.tone === "lesson" ? "#0F766E" : color.text }}>{g.label}</p>
              {g.sub && <span style={{ fontSize: 11.5, color: "#9CA3AF", fontWeight: 700 }}>{g.sub}</span>}
              <span style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 800, color: groupDone(g.items) === g.items.length ? "#15803D" : "#6B7280", background: "white", borderRadius: 999, padding: "3px 9px" }}>
                {groupDone(g.items) === g.items.length ? "✓ " : ""}{groupDone(g.items)} من {g.items.length}
              </span>
            </div>
            <div style={{ padding: "0 12px" }}>
              {g.items.map((t) => <PlanRow key={t.id} task={t} onToggle={onToggle} onOpen={onOpenTask} />)}
            </div>
          </div>
        ))}

        {memoShown.length > 0 && (
          <div style={{ background: "white", borderRadius: 18, overflow: "hidden", border: "1px solid #EEEDE8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#EDE9FE" }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 14, color: "#5B21B6" }}>الحفظ والتسميع</p>
              <span style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 800, color: "#6B7280", background: "white", borderRadius: 999, padding: "3px 9px" }}>
                {memo.filter((m) => m.done).length} من {memo.length}
              </span>
            </div>
            <div style={{ padding: "0 12px" }}>
              {memoShown.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 0", borderTop: "1px solid #F3F2EE" }}>
                  <button onClick={() => setEditingMemo(m)} style={{ flex: 1, minWidth: 0, background: "none", textAlign: "right", padding: "4px 0", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <SubjectIcon subject={m.kind === "حديث" ? "التربية الإسلامية" : "القرآن الكريم"} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: m.done ? "#9CA3AF" : "#1F2937", textDecoration: m.done ? "line-through" : "none" }}>{m.kind === "حديث" ? "حديث" : "القرآن الكريم"} · {m.reference}</p>
                      {m.recite_on && !m.done && <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 800, color: "#5B21B6" }}>موعد التسميع: {fmtDate(m.recite_on)}</p>}
                      {m.details && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: m.done ? "#B0B3BA" : "#6B7280", lineHeight: 1.65 }}>{m.details}</p>}
                    </div>
                  </button>
                  <CheckBox checked={m.done} label={m.done ? "إرجاعه لغير مكتمل" : "تم"} onClick={() => toggleMemo(m.id)} />
                </div>
              ))}
            </div>
          </div>
        )}
        {editingMemo && <EditMemoModal item={editingMemo} onClose={() => setEditingMemo(null)} onSave={saveMemo} onDelete={deleteMemo} />}
    </div>
  );
}

// تعديل عنصر حفظ/تسميع — النوع (آية/حديث) والمرجع والتفاصيل، مستخدَمة من
// الخطة الأسبوعية — العارض الوحيد للحفظ بعد ما انشال تبويبه.
function EditMemoModal({ item, onClose, onSave, onDelete }) {
  const [kind, setKind] = useState(item.kind);
  const [reference, setReference] = useState(item.reference || "");
  const [details, setDetails] = useState(item.details || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canSave = reference.trim().length > 0 && !saving;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(item.id, { kind, reference: reference.trim(), details: details.trim() || null });
    } catch (e) {
      setError(e.message || "تعذّر الحفظ، حاولي مرة ثانية.");
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: "24px 24px 0 0" }}>
        <div style={{ position: "sticky", top: 0, background: "white", padding: "16px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>تعديل الحفظ</h2>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36 }}>×</button>
        </div>
        <div style={{ padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>النوع</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {["آية", "حديث"].map((v) => (
                <button key={v} onClick={() => setKind(v)} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${kind === v ? "#B7A6E8" : "#E5E7EB"}`, background: kind === v ? "#F1EFFA" : "white", color: kind === v ? "#5C4B8C" : "#6B7280", fontWeight: 700 }}>{v === "آية" ? "قرآن" : "حديث"}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>المرجع</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مثال: سورة البقرة ١-٥" style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>التفاصيل (اختياري)</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: 0 }}>{error}</p>}
          <button disabled={!canSave} onClick={save} style={{ padding: 14, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSave ? 1 : 0.4 }}>
            {saving ? "جارِ الحفظ..." : "حفظ التعديلات"}
          </button>
          <button onClick={() => onDelete(item.id)} style={{ padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}

// دائرة ✓ للمستلزمات — دائرة كاملة (بخلاف مربّع الخطة الأسبوعية)، بمساحة
// لمس ٤٤ بكسل.
function CircleCheck({ checked, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={checked} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", flexShrink: 0, padding: 0 }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", border: checked ? "none" : "2px solid #C9C6D6", background: checked ? "#22C55E" : "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>
        {checked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
      </span>
    </button>
  );
}

function RequirementsCard({ child, items, onToggle, onDeleteReq, onClearBought, onUpdateReq }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  const boughtCount = items.filter((r) => r.bought).length;
  const [editingItem, setEditingItem] = useState(null);
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: color.bg }}>
        <Avatar child={child} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>{items.length} طلب</p>
        </div>
        {boughtCount > 0 && (
          <button onClick={() => onClearBought(child.id)} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 10, fontWeight: 700, background: "white", color: color.text, flexShrink: 0 }}>
            مسح الكل ({boughtCount})
          </button>
        )}
      </div>
      <div style={{ background: "white", padding: 12 }}>
        {items.length === 0 && <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا توجد طلبات حالياً</p>}
        {items.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #F3F4F6", gap: 4 }}>
            <button onClick={() => setEditingItem(r)} style={{ flex: 1, minWidth: 0, background: "none", textAlign: "right", padding: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: r.bought ? "#9CA3AF" : "#374151", textDecoration: r.bought ? "line-through" : "none" }}>{r.item}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{fmtDate(r.due_date)}</p>
            </button>
            <CircleCheck checked={r.bought} onClick={() => onToggle(r.id)} label={r.bought ? "إرجاعه لغير مُشترى" : "تحديد كمُشترى"} />
            <button onClick={() => onDeleteReq(r.id)} title="حذف" style={{ background: "none", color: "#B91C1C", opacity: 0.6, fontSize: 16, width: 24, height: 24, flexShrink: 0, padding: 0 }}>×</button>
          </div>
        ))}
      </div>
      {editingItem && (
        <EditRequirementModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (id, updates) => { await onUpdateReq(id, updates); setEditingItem(null); }}
          onDelete={(id) => { onDeleteReq(id); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

// تعديل اسم المستلزم أو تاريخه — يفتح بالضغط على نص الطلب بالقائمة.
function EditRequirementModal({ item, onClose, onSave, onDelete }) {
  const [name, setName] = useState(item.item || "");
  const [dueDate, setDueDate] = useState(item.due_date || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canSave = name.trim().length > 0 && !saving;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(item.id, { item: name.trim(), dueDate: dueDate || null });
    } catch (e) {
      setError(e.message || "تعذّر الحفظ، حاولي مرة ثانية.");
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: "24px 24px 0 0" }}>
        <div style={{ position: "sticky", top: 0, background: "white", padding: "16px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>تعديل الطلب</h2>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36 }}>×</button>
        </div>
        <div style={{ padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>اسم المستلزم</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>التاريخ المطلوب (اختياري)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>
          {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: 0 }}>{error}</p>}
          <button disabled={!canSave} onClick={save} style={{ padding: 14, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSave ? 1 : 0.4 }}>
            {saving ? "جارِ الحفظ..." : "حفظ التعديلات"}
          </button>
          <button onClick={() => onDelete(item.id)} style={{ padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleCard({ child, schedule, onUpload, onCellClick }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  const maxPeriod = schedule.reduce((max, s) => Math.max(max, s.period_number), 0);
  const grid = {};
  schedule.forEach((s) => { grid[`${s.day}-${s.period_number}`] = s; });
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
  const printRef = useRef();
  const [exporting, setExporting] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);

  async function exportPdf() {
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const margin = 10;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      const canvasRatio = canvas.width / canvas.height;
      let w = maxW;
      let h = w / canvasRatio;
      if (h > maxH) {
        h = maxH;
        w = h * canvasRatio;
      }
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;
      pdf.addImage(imgData, "PNG", x, y, w, h);

      const fileName = `جدول-حصص-${child.name}.pdf`;
      if (native) {
        // ما فيه تنزيل ملفات داخل WebView — نفتح قائمة المشاركة الأصلية
        // بدلاً من ذلك (فيها حفظ بالملفات، إرسال، أو طباعة عبر AirPrint).
        const dataUri = pdf.output("datauristring");
        const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
        const failure = await nativeSharePdf(base64, fileName, fileName);
        if (failure) throw new Error(failure);
      } else {
        pdf.save(fileName);
      }
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("تعذّر تصدير PDF.\n\nالسبب: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: color.bg }}>
        <Avatar child={child} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>{classLabel(child.grade, child.section)}</p>
        </div>
        <button onClick={onUpload} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>
          {schedule.length ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <TileIcon name="refresh" size={15} />
              تحديث
            </span>
          ) : (
            "+ رفع"
          )}
        </button>
      </div>
      <div style={{ background: "white", padding: 12, overflowX: "auto" }}>
        {schedule.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا يوجد جدول حصص مضاف بعد</p>
        ) : (
          <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>اضغطي أي خانة للتعديل</span>
            <button onClick={exportPdf} disabled={exporting} style={{ background: color.soft, color: color.text, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 10, opacity: exporting ? 0.6 : 1 }}>
              {exporting ? (
                "جاري التصدير..."
              ) : native ? (
                "📄 تصدير / طباعة"
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <TileIcon name="doc" size={16} />
                  تصدير PDF
                </span>
              )}
            </button>
          </div>
          {/* نفس ترتيب الجدول الورقي اللي تعرفه الأم: الأيام صفوف والحصص
              أعمدة. والمقاسات مضغوطة عشان الجدول كله يبان بشاشة الآيفون
              بلا سحب أفقي — الخانة ٧ حصص × ٥ أيام تدخل بعرض ٣٩٠ بكسل. */}
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 2, fontSize: 10 }}>
            <colgroup>
              <col style={{ width: 40 }} />
              {periods.map((p) => <col key={p} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: "5px 2px", background: "#F3F4F6", color: "#6B7280", borderRadius: 6, fontWeight: 800, fontSize: 9 }}>اليوم</th>
                {periods.map((p) => (
                  <th key={p} style={{ padding: "5px 1px", background: "#F3F4F6", color: "#6B7280", borderRadius: 6, fontWeight: 800, fontSize: 8.5, lineHeight: 1.2 }}>
                    {PERIOD_LABELS[p - 1] || p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => {
                const dayPal = PALETTE[di % PALETTE.length];
                return (
                  <tr key={d}>
                    <td style={{ padding: "4px 2px", textAlign: "center", background: dayPal.soft, color: dayPal.text, borderRadius: 6, fontWeight: 800, fontSize: 9, lineHeight: 1.2 }}>{d}</td>
                    {periods.map((p) => {
                      const entry = grid[`${d}-${p}`];
                      return (
                        <td key={p} onClick={() => onCellClick(d, p, entry || null)} style={{ padding: "4px 1px", textAlign: "center", background: dayPal.bg, borderRadius: 6, verticalAlign: "middle", cursor: "pointer" }}>
                          {entry ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                              <div style={{ position: "relative", lineHeight: 0 }}>
                                <SubjectIcon subject={entry.subject} size={17} />
                                {getSubjectIconFile(entry.subject) === "pe" && child.pe_uniform_color && (
                                  <span style={{ position: "absolute", bottom: -2, left: -2, width: 7, height: 7, borderRadius: "50%", background: child.pe_uniform_color, border: child.pe_uniform_color === "#FFFFFF" ? "1px solid #E5E7EB" : "1px solid rgba(0,0,0,.15)" }} />
                                )}
                              </div>
                              <span style={{ fontSize: 7.5, fontWeight: 800, color: dayPal.text, lineHeight: 1.2, wordBreak: "break-word" }}>{entry.subject}</span>
                              {entry.teacher && <span style={{ fontSize: 6.5, color: dayPal.text, opacity: 0.75, lineHeight: 1.15, wordBreak: "break-word" }}>{entry.teacher}</span>}
                              {/* dir="ltr" إجباري — بدونه يعكس RTL ترتيب الوقتين فتبان
                                  الحصة كأنها تنتهي قبل ما تبدأ (08:15 - 07:30). */}
                              {(entry.start_time || entry.end_time) && (
                                <span dir="ltr" style={{ fontSize: 6, color: dayPal.text, opacity: 0.55, direction: "ltr" }}>{[entry.start_time, entry.end_time].filter(Boolean).join(" - ")}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: dayPal.text, opacity: 0.35, fontWeight: 800 }}>+</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>
      {schedule.length > 0 && (
        <div style={{ position: "fixed", top: 0, left: -9999, width: 1100 }}>
          {/* letterSpacing: "normal" إجباري هنا — قاعدة .ios-native h2 تضبط
              letter-spacing داخل تطبيق آبل، وhtml2canvas عندها يرسم كل حرف
              لحاله بدل الكلمة كاملة، فينكسر تشكيل الحروف العربية المتصلة. */}
          <div ref={printRef} style={{ background: "white", padding: 24, direction: "rtl", letterSpacing: "normal" }}>
            <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #111", paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: "#111", letterSpacing: "normal" }}>جدول حصص {child.name}</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#333" }}>{child.school} — {classLabel(child.grade, child.section)}</p>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #999", padding: "8px 6px" }}></th>
                  {periods.map((p) => (
                    <th key={p} style={{ border: "1px solid #999", padding: "8px 6px", color: "#111" }}>الحصة {p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d}>
                    <td style={{ border: "1px solid #999", padding: "8px 6px", fontWeight: 800, color: "#111", textAlign: "center" }}>{d}</td>
                    {periods.map((p) => {
                      const entry = grid[`${d}-${p}`];
                      return (
                        <td key={p} style={{ border: "1px solid #999", padding: "8px 6px", textAlign: "center", color: "#111" }}>
                          {entry ? (
                            <div>
                              <div style={{ fontWeight: 800 }}>{entry.subject}</div>
                              {getSubjectIconFile(entry.subject) === "pe" && child.pe_uniform_color && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2 }}>
                                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: child.pe_uniform_color, border: "1px solid #999" }} />
                                  <span style={{ fontSize: 8, color: "#666" }}>لون البدنية</span>
                                </div>
                              )}
                              {entry.teacher && <div style={{ fontSize: 9, color: "#444" }}>{entry.teacher}</div>}
                              {(entry.start_time || entry.end_time) && (
                                <div style={{ fontSize: 8, color: "#666" }}>{[entry.start_time, entry.end_time].filter(Boolean).join(" - ")}</div>
                              )}
                            </div>
                          ) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// تعديل أو إضافة حصة بخانة معيّنة من جدول الحصص — اليوم ورقم الحصة ثابتان
// (يحددان مكان الخانة)، والمادة/المعلّم/الوقت هي المُعدَّلة يدوياً.
function EditScheduleCellModal({ child, day, period, entry, onClose, onSave, onDelete }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  const [subject, setSubject] = useState(entry?.subject || "");
  const [teacher, setTeacher] = useState(entry?.teacher || "");
  const [startTime, setStartTime] = useState(entry?.start_time || "");
  const [endTime, setEndTime] = useState(entry?.end_time || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canSave = subject.trim().length > 0 && !saving;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(entry?.id || null, { childId: child.id, day, periodNumber: period, subject: subject.trim(), teacher: teacher.trim() || null, startTime: startTime.trim() || null, endTime: endTime.trim() || null });
    } catch (e) {
      setError(e.message || "تعذّر الحفظ، حاولي مرة ثانية.");
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: "24px 24px 0 0" }}>
        <div style={{ position: "sticky", top: 0, background: "white", padding: "16px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{entry ? "تعديل الحصة" : "إضافة حصة"} — {day} · الحصة {period}</h2>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36 }}>×</button>
        </div>
        <div style={{ padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>المادة</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: رياضيات" style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>المعلّم/ـة (اختياري)</label>
            <input value={teacher} onChange={(e) => setTeacher(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>وقت البداية</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>وقت النهاية</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
            </div>
          </div>
          {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: 0 }}>{error}</p>}
          <button disabled={!canSave} onClick={save} style={{ padding: 14, borderRadius: 12, background: color.solid, color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSave ? 1 : 0.4 }}>
            {saving ? "جارِ الحفظ..." : "حفظ"}
          </button>
          {entry && (
            <button onClick={() => onDelete(entry.id)} style={{ padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
              حذف هذه الحصة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskModal({ task, motherId, color, onClose, onMarkDone, onDelete, onUpdateTask }) {
  const meta = TYPE_META[task.type] || TYPE_META["واجب"];
  const TYPES = ["واجب", "اختبار", "مشروع", "حفظ", "درس"];
  const [editing, setEditing] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [subject, setSubject] = useState(task.subject || "");
  const [type, setType] = useState(task.type);
  const [details, setDetails] = useState(task.details || "");
  const [dateValue, setDateValue] = useState(task.due_date || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = subject.trim() !== (task.subject || "") || type !== task.type || (details.trim() || "") !== (task.details || "") || dateValue !== (task.due_date || "");
  // داخل التطبيق التذكيرات تجي من الخادم تلقائياً، وملف الـ .ics ما ينفتح
  // أصلاً داخل WebView — فنخفي الزر ونخليه بنسخة الويب بس.
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);

  async function save() {
    if (!subject.trim()) { setError("المادة مطلوبة"); return; }
    setSaving(true);
    setError("");
    try {
      await onUpdateTask(task.id, { subject: subject.trim(), type, details: details.trim() || null, dueDate: dateValue || null });
      onClose();
    } catch (e) {
      setError(e.message || "تعذّر حفظ التعديلات، حاولي مرة ثانية.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, borderRadius: "24px 24px 0 0", padding: "22px 22px calc(env(safe-area-inset-bottom) + 22px)", maxHeight: "85vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 22, color: color.text }}><TypeGlyph type={task.type} native={typeof window !== "undefined" && isNativeApp()} size={22} /></span>
            <h3 style={{ margin: "4px 0 2px", color: color.text, fontSize: 18 }}>{task.subject}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>{task.type} · {task.due_date ? fmtDate(task.due_date) : "بدون تاريخ محدد"}</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <TileIcon name="pencil" size={15} />
                تعديل
              </span>
            </button>
          )}
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36, flexShrink: 0 }}>×</button>
        </div>

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700 }}>النوع</label>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {TYPES.map((v) => (
                  <button key={v} onClick={() => setType(v)} style={{ flex: 1, minWidth: 60, padding: 8, borderRadius: 10, border: `1px solid ${type === v ? "#B7A6E8" : "#E5E7EB"}`, background: type === v ? "#F1EFFA" : "white", color: type === v ? "#5C4B8C" : "#6B7280", fontWeight: 700, fontSize: 12.5 }}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700 }}>المادة</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700 }}>التفاصيل</label>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700 }}>تاريخ الاستحقاق</label>
              <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
            </div>
            {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); setSubject(task.subject || ""); setType(task.type); setDetails(task.details || ""); setDateValue(task.due_date || ""); setError(""); }} style={{ flex: 1, padding: 12, borderRadius: 12, background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
                إلغاء
              </button>
              <button onClick={save} disabled={saving || !changed} style={{ flex: 2, padding: 12, borderRadius: 12, background: color.solid, color: "white", fontWeight: 800, fontSize: 14, minHeight: 44, opacity: (saving || !changed) ? 0.5 : 1 }}>
                {saving ? "جارِ الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {task.details && <div style={{ background: color.bg, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>{task.details}</div>}
            {task.source_text && <div style={{ marginBottom: 14 }}><SourceText text={task.source_text} /></div>}
            {task.source_id && (
              <button onClick={() => setShowSource(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: 12, borderRadius: 12, background: color.bg, color: color.text, fontWeight: 700, fontSize: 13, minHeight: 44, marginBottom: 10 }}>
                <TileIcon name="camera" size={18} />
                عرض المصدر (الصورة الأصلية)
              </button>
            )}

            {task.due_date && !native && (
              <a href={`/api/tasks/${task.id}/ics?motherId=${motherId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: 12, borderRadius: 12, background: color.bg, color: color.text, fontWeight: 700, fontSize: 13, minHeight: 44, marginBottom: 10, textDecoration: "none" }}>
                <TileIcon name="bell" size={20} />
                إضافة تذكير (قبل يوم)
              </a>
            )}
            {task.status === "done" ? (
              <button onClick={() => onMarkDone(task.id, false)} style={{ width: "100%", padding: 14, borderRadius: 12, background: color.bg, color: color.text, fontWeight: 800, fontSize: 15, minHeight: 48, marginBottom: 10 }}>
                إرجاعه لغير مكتمل
              </button>
            ) : (
              <button onClick={() => onMarkDone(task.id, true)} style={{ width: "100%", padding: 14, borderRadius: 12, background: color.solid, color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, marginBottom: 10 }}>
                {meta.done}
              </button>
            )}
            <button onClick={() => onDelete(task.id)} style={{ width: "100%", padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
              حذف الواجب (دخل غلط)
            </button>
          </>
        )}
      </div>
      {showSource && <SourceImageModal sourceId={task.source_id} onClose={() => setShowSource(false)} />}
    </div>
  );
}

function AddChildModal({ schools, nextColorIdx, child, onClose, onSave, onDelete }) {
  const isEdit = !!child;
  const [name, setName] = useState(child?.name || "");
  const [gov, setGov] = useState(child?.governorate || "");
  const [grade, setGrade] = useState(child?.grade || 3);
  const [section, setSection] = useState(child?.section || 1);
  const [gender, setGender] = useState(child?.gender || "بنين");
  const [school, setSchool] = useState(child?.school || "");
  const [photo, setPhoto] = useState(child?.photo_url || null);
  const [colorIdx, setColorIdx] = useState((child?.color_idx ?? nextColorIdx) % PALETTE.length);
  const [peColor, setPeColor] = useState(child?.pe_uniform_color || null);
  const fileRef = useRef();
  const stage = stageForGrade(grade);
  const options = gov ? schools?.[gov]?.[stage]?.[gender] || [] : [];
  // مدارس جديدة ممكن ما تكون انضافت بموقع الوزارة بعد — نسمح للأم تكتب
  // اسم المدرسة يدوياً إذا مو موجودة بالقائمة.
  const [otherSchool, setOtherSchool] = useState(() => !!child?.school && !options.includes(child.school));
  const canSave = name.trim().length > 1 && gov && school;
  const word = gender === "بنات" ? "طالبة" : "طالب";

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: "24px 24px 0 0" }}>
        <div style={{ position: "sticky", top: 0, background: "white", padding: "16px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{isEdit ? `تعديل بيانات ${studentWord(gender)}` : `إضافة ${word}`}</h2>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36 }}>×</button>
        </div>
        <div style={{ padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button onClick={() => fileRef.current?.click()} style={{ position: "relative", background: "none" }}>
              {photo ? <img src={photo} style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", border: `2px solid ${PALETTE[colorIdx].ring}` }} /> :
                <div style={{ width: 92, height: 92, borderRadius: "50%", border: `2px dashed ${PALETTE[colorIdx].ring}`, background: PALETTE[colorIdx].soft, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE[colorIdx].text }}><TileIcon name="camera" size={34} /></div>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await resizeToDataUrl(f, 160, true)); }} />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>اللون المميز</label>
            <div style={{ display: "flex", gap: 10, marginTop: 6, justifyContent: "center" }}>
              {PALETTE.map((pal, i) => (
                <button key={i} onClick={() => setColorIdx(i)} title={`لون ${i + 1}`} style={{ width: 32, height: 32, borderRadius: "50%", background: pal.solid, border: colorIdx === i ? `3px solid ${pal.text}` : "3px solid transparent", boxShadow: colorIdx === i ? `0 0 0 2px ${pal.ring}` : "none", flexShrink: 0 }} />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>اسم {word === "طالبة" ? "الطالبة" : "الطالب"}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>الصف</label>
              <select value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setSchool(""); setOtherSchool(false); }} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>الصف {g} — {stageForGrade(g)}</option>)}
              </select>
            </div>
            <div style={{ width: 90 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>الشعبة</label>
              <select value={section} onChange={(e) => setSection(Number(e.target.value))} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>الجنس / نوع المدرسة</label>
            <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
              {["بنين", "بنات"].map((g) => (
                <button key={g} onClick={() => { setGender(g); setSchool(""); setOtherSchool(false); }} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${gender === g ? "#B7A6E8" : "#E5E7EB"}`, background: gender === g ? "#F1EFFA" : "white", color: gender === g ? "#5C4B8C" : "#6B7280", fontWeight: 700 }}>{g}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>لون ملابس البدنية (اختياري)</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {PE_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setPeColor(peColor === c.value ? null : c.value)}
                  title={c.label}
                  style={{
                    width: 30, height: 30, borderRadius: "50%", background: c.value, flexShrink: 0,
                    border: c.value === "#FFFFFF" ? "1px solid #E5E7EB" : "3px solid transparent",
                    boxShadow: peColor === c.value ? "0 0 0 2px white, 0 0 0 4px #B7A6E8" : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>المحافظة</label>
            <select value={gov} onChange={(e) => { setGov(e.target.value); setSchool(""); setOtherSchool(false); }} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
              <option value="">— اختاري —</option>
              {schools && Object.keys(schools).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {gov && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 700 }}>المدرسة ({stage} - {gender})</label>
              <select
                value={otherSchool ? "__other__" : school}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__other__") { setOtherSchool(true); setSchool(""); }
                  else { setOtherSchool(false); setSchool(v); }
                }}
                style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}
              >
                <option value="">— اختاري —</option>
                {options.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__other__">أخرى (مدرسة جديدة غير مدرجة)</option>
              </select>
              {otherSchool && (
                <input
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="اكتبي اسم المدرسة"
                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 8 }}
                />
              )}
            </div>
          )}

          <button disabled={!canSave} onClick={() => onSave({ name: name.trim(), grade, section, gender, school, governorate: gov, photo, colorIdx, peUniformColor: peColor })} style={{ padding: 14, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSave ? 1 : 0.4 }}>
            {isEdit ? "حفظ التعديلات" : `إضافة ${word === "طالبة" ? "الطالبة" : "الطالب"}`}
          </button>
          {isEdit && (
            <button onClick={onDelete} style={{ padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
              حذف {studentWord(gender)} نهائياً
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// إضافة واجب أو اختبار يدوياً بلا رفع صورة — مادة + تفاصيل + تاريخ، يدخل
// بنفس جدول tasks فيرتّب بالخطة الأسبوعية وياخذ تذكيره العادي (قبل
// الموعد بيوم ويوم الموعد) بلا أي فرق عن الواجب المستخرج من صورة.
function AddTaskModal({ child, onClose, onSave }) {
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("واجب");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const TYPES = ["واجب", "اختبار", "مشروع", "حفظ"];
  const canSave = subject.trim().length > 0 && dueDate && !saving;

  async function save() {
    setSaving(true);
    await onSave({ childId: child.id, subject: subject.trim(), type, dueDate, details: details.trim() || null });
    setSaving(false);
  }

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: "24px 24px 0 0" }}>
        <div style={{ position: "sticky", top: 0, background: "white", padding: "16px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>إضافة واجب/اختبار لـ {child.name}</h2>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36 }}>×</button>
        </div>
        <div style={{ padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>النوع</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {TYPES.map((v) => (
                <button key={v} onClick={() => setType(v)} style={{ flex: 1, minWidth: 70, padding: 9, borderRadius: 12, border: `1px solid ${type === v ? "#B7A6E8" : "#E5E7EB"}`, background: type === v ? "#F1EFFA" : "white", color: type === v ? "#5C4B8C" : "#6B7280", fontWeight: 700, fontSize: 13 }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>المادة</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: رياضيات" style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>التفاصيل (اختياري)</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="محتوى الواجب أو الاختبار" style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>التاريخ</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5 }} />
          </div>
          <button disabled={!canSave} onClick={save} style={{ padding: 14, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, opacity: canSave ? 1 : 0.4 }}>
            {saving ? "جارِ الإضافة..." : "إضافة"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadView({ children, motherId, endpoint = "/api/upload-schedule", title = "رفع الجدول", buttonLabel = "تحليل وتوزيع الواجبات", renderSummary, selectChild = true, hint, onClose, onDone, onReview }) {
  // وضع الرفع (قرار صاحبة التطبيق ٢٦ سبتمبر): إما تحليل الصورة كالمعتاد،
  // أو حفظها كصورة تفتحها وتكبّرها بس — بلا استخراج وبلا تذكير عن بنودها.
  // (تذكير المتابعة اليومي ٣ العصر عام لكل ولي أمر عنده طالب/ة، ما يخص
  // جدولاً بعينه، فيبقى يوصلها — والتحذير يقولها صراحةً.) الثاني
  // ما يمر بأي نموذج ولا يكتب صفاً بجداول المهام، فما فيه شي يتذكّر عنه
  // كرون التذكيرات. ولهذا التحذير إلزامي قبل اختياره.
  const [mode, setMode] = useState("analyze");
  // الخيار للخطة الأسبوعية (الواجبات) وحدها — قرار صاحبة التطبيق
  // ٢٦ سبتمبر. جدول الحصص يبقى تحليلاً دائماً: شبكته هي اللي تبني عرض
  // «الجداول» ومواد ملاحظات المعلم والدرجات، فصورة بلا تحليل تعطّلها.
  const canAttach = endpoint === "/api/upload-schedule";
  const ATTACH_KIND = "plan";
  const [school, setSchool] = useState("");
  const [childId, setChildId] = useState("");
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorTips, setErrorTips] = useState([]);
  const [native, setNative] = useState(false);
  const fileRef = useRef();
  useEffect(() => setNative(isNativeApp()), []);
  const schoolsOfChildren = [...new Set(children.map((c) => c.school))];
  const childrenOfSchool = school ? children.filter((c) => c.school === school) : [];
  const autoChild = childrenOfSchool.length === 1 ? childrenOfSchool[0] : null;
  const effectiveChildId = autoChild ? autoChild.id : childId;
  const needsChildConfirm = selectChild && childrenOfSchool.length > 1;
  const canRun = school && images.length > 0 && (!selectChild || effectiveChildId);
  // الزر المعطّل بلا تفسير طريق مسدود: الأم تضغط وما يصير شي، وتظن إن
  // البرنامج خربان. نقول لها وش الناقص بالضبط.
  const blockedReason = !school
    ? "اختاري المدرسة أولاً"
    : needsChildConfirm && !effectiveChildId
    ? "اختاري الطالب/ة صاحب الجدول"
    : images.length === 0
    ? "أضيفي صورة الجدول أولاً"
    : "";

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    // ٩٠٠ بكسل كانت تمحي أسماء المعلمات بجدول الحصص فيخمّنها النموذج.
    // ١٥٦٨ هو أقصى ضلع تستفيد منه واجهة التحليل.
    const urls = await Promise.all(files.map((f) => resizeToDataUrl(f, 1568, false, 0.9)));
    setImages((prev) => [...prev, ...urls]);
  }

  // داخل تطبيق آبل نفتح الكاميرا/الألبوم الأصلي بدل منتقي الملفات
  const [pickError, setPickError] = useState(null);

  const [scanner, setScanner] = useState(false);
  useEffect(() => setScanner(hasDocumentScanner()), []);

  async function addFromNative(source) {
    setPickError(null);
    const { url, reason } = source === "scan" ? await nativeScanDocument() : await nativePickImage(source);
    if (url) {
      hapticLight();
      setImages((prev) => [...prev, url]);
      return;
    }
    // الإلغاء اختيار المستخدمة، ما يحتاج رسالة. الباقي يحتاج.
    if (reason && reason !== "cancelled") {
      setPickError({ reason, source });
      reportError("image_picker", { reason, detail: source });
    }
  }

  async function post(imgs) {
    // رفعنا دقة الصور عشان النموذج يقرأ أسماء المعلمات، وسقف حجم الطلب
    // ٤٫٥ ميجا يُرفض قبل ما يوصل السيرفر — أي رفض هنا يطلع للأم كعطل
    // بلا سبب. لو الحزمة كبرت نصغّرها خطوة وحدة بدل ما نخسر الطلب كله.
    let payload = imgs;
    if (imgs.reduce((n, s) => n + s.length, 0) > 3_500_000) {
      payload = await Promise.all(imgs.map((img) => resizeDataUrl(img, 1100)));
    }
    const body = selectChild
      ? { motherId, childId: effectiveChildId, images: payload }
      : { motherId, school, images: payload };
    // يصمد لانقطاع الاتصال أثناء التحليل الطويل — راجع lib/uploadRequest.js
    return postUpload(endpoint, body);
  }

  // «إرفاق فقط»: الصورة تنحفظ كما هي وتنعرض بتبويب «الطلبات والجداول».
  // ما تمر بأي تحليل، فما فيه بنود ولا مواعيد ولا تذكير.
  async function runAttach() {
    setStatus("loading");
    setErrorMsg("");
    setErrorTips([]);
    try {
      let payload = images;
      if (images.reduce((n, s) => n + s.length, 0) > 3_500_000) {
        payload = await Promise.all(images.map((img) => resizeDataUrl(img, 1800)));
      }
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: effectiveChildId, kind: ATTACH_KIND, images: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر حفظ الصورة، حاولي مرة ثانية.");
      setImages([]);
      setSummary({ attached: payload.length, replaced: data.attachment?.replaced || 0 });
      setStatus("done");
      onDone();
    } catch (err) {
      setErrorMsg(err.message || "تعذّر حفظ الصورة، حاولي مرة ثانية.");
      setStatus("error");
      reportError("attachments", { reason: "attach_failed", detail: err.message || "" });
    }
  }

  // التحذير إلزامي وبقرار صريح: الأم تفقد التذكيرات كلها بهذا الاختيار،
  // وهذا شي ما تكتشفه إلا بعد ما يفوت الموعد.
  function chooseAttach() {
    const ok = confirm(
      "عند اختيارك «رفع صورة فقط»:\n\n• ما يوصلك تذكير عن أي واجب أو اختبار أو مستلزم بهالجدول.\n• الصورة تنحفظ بس عشان ترجعين لها وتكبّرينها.\n• تذكير المتابعة اليومي (٣ العصر) يبقى يوصلك كالعادة — هو عام ما يخص جدولاً بعينه.\n\nللحصول على تذكيرات هذه الخطة لازم تختارين «تحليل وتذكير».\n\nتكملين؟"
    );
    if (ok) { setMode("attach"); hapticLight(); }
  }

  async function run() {
    if (mode === "attach") return runAttach();
    setStatus("loading");
    setErrorMsg("");
    setErrorTips([]);
    try {
      // كثير من الجداول المدرسية مطبوعة بالعرض، فتنرفع مقلوبة ٩٠ درجة
      // والنص العربي المقلوب ما ينقرأ. السيرفر يكتشفها ويطلب التدوير،
      // وندوّرها هنا بالجهاز ونعيد بلا ما نطلب من الأم شي. نكرر لأن
      // تقدير الزاوية نفسه ممكن يطلع ناقصاً بالمحاولة الأولى.
      let current = images;
      let data = await post(current);
      for (let i = 0; data.needsRotation && i < 3; i++) {
        current = await Promise.all(current.map((img) => rotateDataUrl(img, data.needsRotation)));
        setImages(current);
        data = await post(current);
      }
      if (data.needsRotation) throw new Error("ما قدرنا نضبط اتجاه الصورة. صوّري الجدول وهو معتدل وجربي مرة ثانية.");
      setImages([]);
      // رفعة الخطة ما تحفظ شي بنفسها — ترجّع مسودة تراجعها الأم وتعتمدها.
      // بقية المسارات (جدول الحصص) تحفظ مباشرة كما كانت.
      if (data.draftId && onReview) {
        setStatus("idle");
        onReview(data);
        return;
      }
      setSummary(data);
      setStatus("done");
      onDone();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "");
      setErrorTips(err.tips || []);
      setStatus("error");
      // نبلّغ حتى لو الطلب ما وصل السيرفر أصلاً (شبكة منقطعة، مهلة) —
      // وهي الحالة اللي ما تترك أي أثر بسجلات السيرفر.
      reportError(endpoint.replace("/api/", ""), { reason: "analyze_failed", detail: err.message || "" });
    }
  }

  return (
    <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 50, background: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, background: "white", padding: "calc(env(safe-area-inset-top) + 12px) 16px 14px", borderBottom: "1px solid #F0EEE8", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", fontSize: 20, width: 36, height: 36 }}>←</button>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{title}</p>
      </div>
      <div className="app-scroll" style={{ padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", flexDirection: "column", gap: 14 }}>
        {hint && <HintBanner id={`upload:${endpoint}`} style={{ fontSize: 12.5, lineHeight: 1.6 }}>{hint}</HintBanner>}

        {canAttach && (
        <div>
          <label style={{ fontSize: 13, fontWeight: 700 }}>الخطة الأسبوعية — وش تبين نسوي فيها؟</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {[
              { key: "analyze", title: "تحليل وتذكير", desc: "نستخرج الواجبات والاختبارات والمستلزمات، وتوصلك التذكيرات." },
              { key: "attach", title: "رفع صورة فقط", desc: "نحفظ الصورة عشان ترجعين لها وتكبّرينها — بلا تحليل، وبلا تذكير عن بنودها. الصورة الجديدة تحل محل السابقة." },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => (opt.key === "attach" ? chooseAttach() : setMode("analyze"))}
                style={{
                  textAlign: "start", padding: "11px 13px", borderRadius: 14,
                  border: `1px solid ${mode === opt.key ? "#B7A6E8" : "#E5E7EB"}`,
                  background: mode === opt.key ? "#F1EFFA" : "white",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: `2px solid ${mode === opt.key ? "#7B68C4" : "#D1D5DB"}`, background: mode === opt.key ? "#7B68C4" : "white", boxShadow: mode === opt.key ? "inset 0 0 0 2.5px white" : "none" }} />
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1F2937" }}>{opt.title}</span>
                </span>
                <span style={{ display: "block", fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 1.6 }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
        )}

        {/* رسالة حالة لا شرح — تبقى بلا ✕ لأنها تخفي أثراً قائماً على
            التذكيرات لازم تعرفه الأم كل مرة ترفع بهالوضع. */}
        {mode === "attach" && (
          <p style={{ margin: 0, fontSize: 12.5, color: "#8C6027", background: "#FDF3E7", borderRadius: 12, padding: "10px 12px", lineHeight: 1.7 }}>
            ⚠️ باختيارك «رفع صورة فقط» ما يوصلك تذكير عن واجبات هالخطة ولا اختباراتها. للتذكيرات اختاري «تحليل وتذكير». (تذكير المتابعة اليومي ٣ العصر يبقى كالعادة.)
          </p>
        )}

        <div>
          <label style={{ fontSize: 13, fontWeight: 700 }}>هذي الصور من مدرسة:</label>
          <select value={school} onChange={(e) => { setSchool(e.target.value); setChildId(""); }} style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", marginTop: 5, background: "white" }}>
            <option value="">— اختاري —</option>
            {schoolsOfChildren.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {selectChild && autoChild && (
          <div style={{ background: "#F1EFFA", color: "#5C4B8C", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700 }}>
            هذا الجدول لـ {autoChild.name} — {classLabel(autoChild.grade, autoChild.section)}
          </div>
        )}
        {needsChildConfirm && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>هذا الجدول لأي طالب/ة؟</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {childrenOfSchool.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1px solid ${childId === c.id ? "#B7A6E8" : "#E5E7EB"}`, background: childId === c.id ? "#F1EFFA" : "white", cursor: "pointer" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="radio" name="uploadChild" checked={childId === c.id} onChange={() => setChildId(c.id)} style={{ accentColor: "#B7A6E8" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{c.name}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{classLabel(c.grade, c.section)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {native ? (
          <div style={{ display: "flex", gap: 10 }}>
            {scanner && (
              <button onClick={() => addFromNative("scan")} style={{ flex: 1, border: "2px solid #B7A6E8", borderRadius: 16, padding: "22px 12px", textAlign: "center", background: "#F1EFFA", color: "#5C4B8C" }}>
                <Icon name="camera" size={28} style={{ display: "block", margin: "0 auto 6px" }} />
                <span style={{ fontWeight: 700, fontSize: 13.5, color: "#1F2937" }}>مسح المستند</span>
                <span style={{ display: "block", fontSize: 10.5, color: "#7B68C4", marginTop: 2 }}>الأوضح — يقص ويعدّل تلقائياً</span>
              </button>
            )}
            <button onClick={() => addFromNative("camera")} style={{ flex: 1, border: "2px dashed #D1D5DB", borderRadius: 16, padding: "22px 12px", textAlign: "center", background: "#FAFAFA", color: "#7B68C4" }}>
              <Icon name="camera" size={28} style={{ display: "block", margin: "0 auto 6px" }} />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: "#1F2937" }}>{scanner ? "الكاميرا" : "تصوير الجدول"}</span>
            </button>
            <button onClick={() => addFromNative("photos")} style={{ flex: 1, border: "2px dashed #D1D5DB", borderRadius: 16, padding: "22px 12px", textAlign: "center", background: "#FAFAFA", color: "#7B68C4" }}>
              <Icon name="photo" size={28} style={{ display: "block", margin: "0 auto 6px" }} />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: "#1F2937" }}>من الصور</span>
            </button>
          </div>
        ) : (
          <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed #D1D5DB", borderRadius: 16, padding: 30, textAlign: "center", background: "#FAFAFA", cursor: "pointer" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>اضغطي لاختيار الصور</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>يمكنك اختيار أكثر من صورة دفعة وحدة</p>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
          </div>
        )}
        {pickError && <PickErrorNotice error={pickError} />}
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden" }}>
                <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,.6)", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <button disabled={!canRun || status === "loading"} onClick={run} style={{ padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, opacity: canRun ? 1 : 0.4 }}>
          {status === "loading"
            ? (mode === "attach" ? "...جاري الحفظ" : onReview ? "🤖 جاري فهم الخطة..." : "جاري التحليل...")
            : mode === "attach" ? "احفظي الصورة للرجوع إليها" : buttonLabel}
        </button>
        {blockedReason && status !== "loading" && (
          <p style={{ margin: "-4px 0 0", fontSize: 12.5, color: "#8C6027", background: "#FDF3E7", borderRadius: 10, padding: "9px 12px", textAlign: "center" }}>
            {blockedReason}
          </p>
        )}
        {status === "done" && summary?.attached ? (
          <div style={{ background: "#F0FDF4", color: "#166534", borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.7 }}>
            انحفظت {summary.attached} صورة ✓ — تلقينها بتبويب «الطلبات والجداول» تحت «الصور المرفقة»، وتقدرين تفتحينها وتكبّرينها.
            {summary.replaced > 0 && <div style={{ marginTop: 6 }}>وحلّت محل الصورة السابقة لنفس الطالب/ة.</div>}
            <div style={{ marginTop: 6, opacity: 0.85 }}>ما فيه تذكير عن بنود هالصورة — لو تبينها ترفعيها مرة ثانية باختيار «تحليل وتذكير». وتذكير المتابعة اليومي ٣ العصر ما يتأثر.</div>
          </div>
        ) : null}
        {status === "done" && summary && !summary.attached && (renderSummary ? renderSummary(summary) : (
          <div style={{ background: "#F0FDF4", color: "#166534", borderRadius: 12, padding: 12, fontSize: 13 }}>
            تم تحليل {summary.imagesProcessed} صورة ✓ — أُضيف {summary.matchedTasks} واجب/اختبار و {summary.matchedReqs} طلب مستلزمات.
            {(summary.updatedTasks > 0 || summary.updatedReqs > 0) && (
              <div style={{ marginTop: 6, opacity: 0.85 }}>تم تحديث {summary.updatedTasks} واجب/اختبار و {summary.updatedReqs} طلب كانوا موجودين مسبقاً (المدرسة غيّرت تفاصيلهم).</div>
            )}
            {summary.skippedOld > 0 && (
              <div style={{ marginTop: 6, opacity: 0.85 }}>تم تجاهل {summary.skippedOld} عنصر لأن تاريخه فات (صورة قديمة).</div>
            )}
          </div>
        ))}
        {status === "error" && (
          // السبب الحقيقي كان يُعرض بخط ١١ باهت تحت عنوان «صار خلل» — فالأم
          // تقرأ العنوان وتعيد نفس الصورة بالضبط. صار السبب هو العنوان.
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: 14, fontSize: 13.5, fontWeight: 700, lineHeight: 1.8 }}>
            {errorMsg || "صار خلل أثناء التحليل، حاولي مرة ثانية."}
            {errorTips.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingInlineStart: 18, fontWeight: 400, fontSize: 12.5 }}>
                {errorTips.map((tip, i) => <li key={i} style={{ marginBottom: 3 }}>{tip}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// النص كما جاء بالصورة حرفياً — يبقى محفوظاً جنب البيانات المنظّمة عشان
// تقدر الأم تقارن بما فهمه البرنامج وتتأكد بنفسها.
function SourceText({ text, compact }) {
  if (!text) return null;
  return (
    <div style={{ background: "#F7F7F5", border: "1px dashed #D9D6CE", borderRadius: 10, padding: "8px 10px" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#9CA3AF" }}>النص كما جاء بالصورة</p>
      <p style={{ margin: "3px 0 0", fontSize: compact ? 12 : 12.5, color: "#4B5563", lineHeight: 1.7, whiteSpace: "pre-line" }}>{text}</p>
    </div>
  );
}

// «عرض المصدر»: الصورة اللي جاء منها البند. الصور تُحفظ أسبوعاً ثم تُحذف،
// فبعدها يطلع سبب واضح بدل شاشة فاضية.
function SourceImageModal({ sourceId, onClose }) {
  const [urls, setUrls] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/sources/${sourceId}`)
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (ok) setUrls(data.urls || []);
        else setError(data.error || "تعذّر فتح الصورة.");
      })
      .catch(() => alive && setError("تعذّر فتح الصورة."));
    return () => { alive = false; };
  }, [sourceId]);

  return (
    // stopPropagation إجباري: هذي الشاشة تُعرض داخل شاشة الواجب، وبدونه
    // الضغط على × أو الخلفية يوصل لغطاء شاشة الواجب فيقفلها هي كمان.
    <div dir="rtl" onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.85)", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px" }}>
        <p style={{ margin: 0, color: "white", fontWeight: 800, fontSize: 15 }}>الصورة الأصلية</p>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%" }}>×</button>
      </div>
      <div className="app-scroll" onClick={(e) => e.stopPropagation()} style={{ flex: 1, padding: "0 12px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", flexDirection: "column", gap: 10 }}>
        {!urls && !error && <p style={{ color: "white", textAlign: "center", fontSize: 13, opacity: 0.8, paddingTop: 30 }}>...جاري الفتح</p>}
        {error && <p style={{ color: "white", textAlign: "center", fontSize: 13.5, lineHeight: 1.9, background: "rgba(255,255,255,.12)", borderRadius: 12, padding: 14, marginTop: 20 }}>{error}</p>}
        {urls?.map((u, i) => (
          <img key={i} src={u} alt={`الصورة ${i + 1}`} style={{ width: "100%", borderRadius: 12, background: "#222" }} />
        ))}
      </div>
    </div>
  );
}

// «عنصر / عنصران / ٥ عناصر» — عربية سليمة بدل «5 عنصر».
// الشريط الأصفر اللي يشرح فكرة الشاشة: مفيد أول مرة، ويصير حشواً بعد ما
// تحفظه الأم عن ظهر قلب (طلب صاحبة التطبيق ١٨ سبتمبر). ✕ تقفله ويبقى
// مقفولاً — القرار محفوظ بالجهاز لكل شريط على حدة بمفتاحه.
// ملاحظة: هذا للشرح فقط. رسائل الحالة (خلص الرصيد، الباقة ما تغطي عدد
// الأبناء) تبقى بلا ✕ لأن إخفاءها يخفي مشكلة قائمة لازم تعرفها.
function HintBanner({ id, children, style }) {
  const key = `daftary_hint_${id}`;
  const [closed, setClosed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });
  if (closed) return null;
  function close() {
    setClosed(true);
    try { localStorage.setItem(key, "1"); } catch {}
  }
  return (
    <div style={{ position: "relative", background: "#FDF3E7", color: "#8C6027", borderRadius: 12, padding: 12, paddingInlineEnd: 36, fontSize: 12, fontWeight: 700, lineHeight: 1.7, ...style }}>
      {children}
      <button onClick={close} aria-label="إغلاق الشرح"
        style={{ position: "absolute", top: 2, insetInlineEnd: 2, background: "none", color: "#B08A4F", fontSize: 18, lineHeight: 1, width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        ×
      </button>
    </div>
  );
}

function countLabel(n, one, two, plural) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${plural}`;
  return `${n} ${one}`;
}

// شاشة مراجعة نتيجة التحليل قبل الحفظ. قبلها كانت الرفعة تحفظ مباشرة
// بجداول الطالب/ة، فأي قراءة غلط تدخل بلا ما تشوفها الأم. الحين تشوف كل
// عنصر، تعدّله أو تحذفه، وما ينحفظ إلا باعتمادها (قرار ١٨ سبتمبر).
function ReviewDraftScreen({ draft, child, onClose, onApplied }) {
  const [items, setItems] = useState(draft.items || { tasks: [], requirements: [], memorization: [] });
  const [openRow, setOpenRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSource, setShowSource] = useState(false);
  const TYPES = ["واجب", "اختبار", "مشروع", "حفظ", "درس"];

  const tasks = items.tasks || [];
  const reqs = items.requirements || [];
  const memo = items.memorization || [];
  const total = tasks.length + reqs.length + memo.length;
  const byType = (t) => tasks.filter((e) => e.type === t).length;
  const lines = [
    [byType("واجب"), "واجب", "واجبان", "واجبات"],
    [byType("اختبار"), "اختبار", "اختباران", "اختبارات"],
    [byType("مشروع"), "مشروع", "مشروعان", "مشاريع"],
    [byType("حفظ"), "مطلوب حفظ", "مطلوبا حفظ", "مطلوبات حفظ"],
    [byType("درس"), "درس", "درسان", "دروس"],
    [reqs.length, "مستلزم", "مستلزمان", "مستلزمات"],
    [memo.length, "تسميع", "تسميعان", "تسميعات"],
  ].filter(([n]) => n > 0);

  // أي تعديل تسويه الأم يعلّم الصف — فإعادة رفع نفس الخطة ما تكتب فوقه
  // (lib/planApply.js). وتعديل حقل غير واضح يرفع عنه علامة التنبيه.
  const setRow = (group, i, patch) =>
    setItems((prev) => ({
      ...prev,
      [group]: prev[group].map((r, idx) => (idx === i ? { ...r, ...patch, editedByUser: true } : r)),
    }));
  const removeRow = (group, i) => {
    setItems((prev) => ({ ...prev, [group]: prev[group].filter((_, idx) => idx !== i) }));
    setOpenRow(null);
  };

  async function apply() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/upload-drafts/${draft.draftId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(data?.error || "تعذّر الحفظ، حاولي مرة ثانية.");
      setSaving(false);
      return;
    }
    hapticSuccess();
    onApplied();
  }

  async function discard() {
    if (!confirm("إلغاء هذي القراءة بلا حفظ؟")) return;
    await fetch(`/api/upload-drafts/${draft.draftId}`, { method: "DELETE" }).catch(() => {});
    onClose();
  }

  const rowBox = { borderTop: "1px solid #F3F2EE", padding: "10px 0" };
  const field = { width: "100%", border: "1px solid #E5E7EB", borderRadius: 10, padding: "8px 10px", marginTop: 5, fontSize: 14 };
  const label = { fontSize: 12, fontWeight: 700, color: "#6B7280" };

  // المعلومة اللي ما قدر النموذج يحددها بثقة تطلع بعلامة تنبيه بدل ما
  // يخمّنها — والأم تحددها بنفسها. تختفي العلامة أول ما تعدّل الصف.
  const unclearFields = (t) => {
    if (t.editedByUser || !t.confidence) return [];
    const names = { subject: "المادة", type: "النوع", due: "الموعد" };
    return Object.entries(t.confidence).filter(([, v]) => v === "unclear").map(([k]) => names[k]).filter(Boolean);
  };
  const needsReviewCount = tasks.filter((t) => unclearFields(t).length > 0).length;

  return (
    <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#FAF7F2", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, background: "white", padding: "calc(env(safe-area-inset-top) + 12px) 16px 14px", borderBottom: "1px solid #F0EEE8", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", fontSize: 20, width: 36, height: 36 }}>←</button>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0 }}>راجعي المعلومات قبل إضافتها</p>
        {draft.sourceId && (
          <button onClick={() => setShowSource(true)} style={{ background: "#F1EFFA", color: "#5C4B8C", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, flexShrink: 0 }}>
            عرض الصورة
          </button>
        )}
      </div>

      <div className="app-scroll" style={{ flex: 1, padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
        {draft.mismatch && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 16, padding: 14 }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 14.5, color: "#B91C1C", lineHeight: 1.8 }}>
              ⚠️ الخطة مكتوب عليها الصف {draft.mismatch.planGrade}، و{draft.mismatch.childName} بالصف {draft.mismatch.childGrade}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#7F1D1D", lineHeight: 1.8 }}>
              تأكدي إنك اخترتِ الطالب/ة الصحيح قبل الاعتماد. لو الخطة فعلاً له، كملي عادي.
            </p>
          </div>
        )}
        <div style={{ background: "white", borderRadius: 16, padding: 14, border: "1px solid #EEEDE8" }}>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 15, color: "#1F2937" }}>
            تم العثور على {countLabel(total, "عنصر", "عنصران", "عناصر")} لـ {child?.name || "الطالب/ة"}
          </p>
          {lines.length > 0 && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280", lineHeight: 1.9 }}>
              {lines.map(([n, one, two, plural]) => countLabel(n, one, two, plural)).join(" · ")}
            </p>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#8C6027", background: "#FDF3E7", borderRadius: 10, padding: "8px 10px", lineHeight: 1.7 }}>
            ما ينحفظ شي إلا بعد ما تعتمدينه. عدّلي أي معلومة أو احذفيها قبل الاعتماد.
          </p>
          {needsReviewCount > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#B45309", background: "#FEF3C7", borderRadius: 10, padding: "8px 10px", lineHeight: 1.7, fontWeight: 700 }}>
              ⚠️ {countLabel(needsReviewCount, "بند", "بندان", "بنود")} فيها معلومة ما كانت واضحة بالصورة — حدّديها بنفسك.
            </p>
          )}
        </div>

        {total === 0 && (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "24px 0" }}>ما بقى أي عنصر — ارجعي وارفعي الخطة مرة ثانية.</p>
        )}

        {tasks.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, padding: "4px 14px 12px", border: "1px solid #EEEDE8" }}>
            <p style={{ margin: "12px 0 0", fontWeight: 900, fontSize: 14, color: "#5C4B8C" }}>الواجبات والاختبارات</p>
            {tasks.map((t, i) => (
              <div key={`t${i}`} style={rowBox}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <button onClick={() => setOpenRow(openRow === `t${i}` ? null : `t${i}`)} style={{ flex: 1, minWidth: 0, background: "none", textAlign: "right", padding: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#1F2937" }}>
                      {t.subject} <span style={{ fontSize: 11, fontWeight: 800, background: "#F1EFFA", color: "#5C4B8C", borderRadius: 999, padding: "2px 8px" }}>{t.type}</span>
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6B7280", lineHeight: 1.6 }}>
                      {t.dueDate ? fmtDate(t.dueDate) : t.dueText || "بدون موعد"}{t.details ? ` — ${t.details}` : ""}
                    </p>
                    {unclearFields(t).length > 0 && (
                      <p style={{ margin: "4px 0 0", fontSize: 11.5, fontWeight: 800, color: "#B45309", background: "#FEF3C7", borderRadius: 8, padding: "3px 8px", display: "inline-block" }}>
                        ⚠️ {unclearFields(t).join(" و")} غير واضح بالصورة
                      </p>
                    )}
                  </button>
                  <button onClick={() => removeRow("tasks", i)} title="حذف" style={{ background: "none", color: "#B91C1C", opacity: 0.6, fontSize: 17, width: 26, height: 26, flexShrink: 0, padding: 0 }}>×</button>
                </div>
                {openRow === `t${i}` && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <SourceText text={t.sourceText} />
                    <div>
                      <span style={label}>المادة</span>
                      <input value={t.subject || ""} onChange={(e) => setRow("tasks", i, { subject: e.target.value })} style={field} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <span style={label}>النوع</span>
                        <select value={t.type} onChange={(e) => setRow("tasks", i, { type: e.target.value })} style={{ ...field, background: "white" }}>
                          {TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={label}>الموعد</span>
                        <input type="date" value={t.dueDate || ""} onChange={(e) => setRow("tasks", i, { dueDate: e.target.value || null })} style={field} />
                      </div>
                    </div>
                    <div>
                      <span style={label}>التفاصيل</span>
                      <textarea value={t.details || ""} onChange={(e) => setRow("tasks", i, { details: e.target.value })} rows={2} style={{ ...field, resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {reqs.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, padding: "4px 14px 12px", border: "1px solid #EEEDE8" }}>
            <p style={{ margin: "12px 0 0", fontWeight: 900, fontSize: 14, color: "#8C6027" }}>المستلزمات</p>
            {reqs.map((r, i) => (
              <div key={`r${i}`} style={rowBox}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <button onClick={() => setOpenRow(openRow === `r${i}` ? null : `r${i}`)} style={{ flex: 1, minWidth: 0, background: "none", textAlign: "right", padding: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#1F2937" }}>{r.item}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6B7280" }}>
                      {r.dueDate ? fmtDate(r.dueDate) : r.dueText || "بدون موعد"}
                      {r.relatedSubject && <span style={{ color: "#8C6027", fontWeight: 700 }}> · لـ {r.relatedSubject}</span>}
                    </p>
                  </button>
                  <button onClick={() => removeRow("requirements", i)} title="حذف" style={{ background: "none", color: "#B91C1C", opacity: 0.6, fontSize: 17, width: 26, height: 26, flexShrink: 0, padding: 0 }}>×</button>
                </div>
                {openRow === `r${i}` && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <SourceText text={r.sourceText} />
                    <div>
                      <span style={label}>الغرض</span>
                      <input value={r.item || ""} onChange={(e) => setRow("requirements", i, { item: e.target.value })} style={field} />
                    </div>
                    <div>
                      <span style={label}>الموعد</span>
                      <input type="date" value={r.dueDate || ""} onChange={(e) => setRow("requirements", i, { dueDate: e.target.value || null })} style={field} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {memo.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, padding: "4px 14px 12px", border: "1px solid #EEEDE8" }}>
            <p style={{ margin: "12px 0 0", fontWeight: 900, fontSize: 14, color: "#5B21B6" }}>الحفظ والتسميع</p>
            {memo.map((m, i) => (
              <div key={`m${i}`} style={rowBox}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <button onClick={() => setOpenRow(openRow === `m${i}` ? null : `m${i}`)} style={{ flex: 1, minWidth: 0, background: "none", textAlign: "right", padding: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#1F2937" }}>{m.kind === "حديث" ? "حديث" : "قرآن"} · {m.reference}</p>
                    {(m.surah || m.fromAyah || m.reciteOn) && (
                      <p style={{ margin: "3px 0 0", fontSize: 12, color: "#5B21B6", fontWeight: 700 }}>
                        {[m.surah && `سورة ${m.surah}`, m.fromAyah && `آية ${m.fromAyah}${m.toAyah && m.toAyah !== m.fromAyah ? ` إلى ${m.toAyah}` : ""}`, m.reciteOn && `تسميع ${fmtDate(m.reciteOn)}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {m.details && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6B7280" }}>{m.details}</p>}
                  </button>
                  <button onClick={() => removeRow("memorization", i)} title="حذف" style={{ background: "none", color: "#B91C1C", opacity: 0.6, fontSize: 17, width: 26, height: 26, flexShrink: 0, padding: 0 }}>×</button>
                </div>
                {openRow === `m${i}` && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <SourceText text={m.sourceText} />
                    <div style={{ display: "flex", gap: 8 }}>
                      {["آية", "حديث"].map((v) => (
                        <button key={v} onClick={() => setRow("memorization", i, { kind: v })} style={{ flex: 1, padding: 9, borderRadius: 10, border: `1px solid ${m.kind === v ? "#B7A6E8" : "#E5E7EB"}`, background: m.kind === v ? "#F1EFFA" : "white", color: m.kind === v ? "#5C4B8C" : "#6B7280", fontWeight: 700, fontSize: 13 }}>{v === "آية" ? "قرآن" : "حديث"}</button>
                      ))}
                    </div>
                    <div>
                      <span style={label}>المرجع</span>
                      <input value={m.reference || ""} onChange={(e) => setRow("memorization", i, { reference: e.target.value })} style={field} />
                    </div>
                    {m.kind !== "حديث" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 2 }}>
                          <span style={label}>السورة</span>
                          <input value={m.surah || ""} onChange={(e) => setRow("memorization", i, { surah: e.target.value || null })} style={field} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={label}>من آية</span>
                          <input type="number" inputMode="numeric" value={m.fromAyah ?? ""} onChange={(e) => setRow("memorization", i, { fromAyah: e.target.value ? Number(e.target.value) : null })} style={field} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={label}>إلى آية</span>
                          <input type="number" inputMode="numeric" value={m.toAyah ?? ""} onChange={(e) => setRow("memorization", i, { toAyah: e.target.value ? Number(e.target.value) : null })} style={field} />
                        </div>
                      </div>
                    )}
                    <div>
                      <span style={label}>موعد التسميع (اختياري)</span>
                      <input type="date" value={m.reciteOn || ""} onChange={(e) => setRow("memorization", i, { reciteOn: e.target.value || null })} style={field} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p style={{ color: "#B91C1C", fontSize: 13, fontWeight: 700, margin: 0 }}>{error}</p>}
      </div>

      <div style={{ flexShrink: 0, background: "white", borderTop: "1px solid #F0EEE8", padding: "12px 16px calc(env(safe-area-inset-bottom) + 12px)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button disabled={saving || total === 0} onClick={apply} style={{ padding: 14, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 50, opacity: saving || total === 0 ? 0.5 : 1 }}>
          {saving ? "جارِ الإضافة..." : `اعتماد وإضافة ${countLabel(total, "عنصر", "عنصران", "عناصر")}`}
        </button>
        <button onClick={discard} disabled={saving} style={{ padding: 10, borderRadius: 12, background: "none", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 40 }}>
          إلغاء بلا حفظ
        </button>
      </div>
      {showSource && <SourceImageModal sourceId={draft.sourceId} onClose={() => setShowSource(false)} />}
    </div>
  );
}

// شاشة الاشتراك — مدخل تاب المعلم الذكي لمن ما عنده رصيد.
// نعرض زر التجربة المجانية بجانب الاشتراك: بدونه يشوف ولي الأمر طلب دفع
// قبل ما يجرب أي شي، وهذا يطلّعه — وآبل نفسها تعترض على جدار دفع بلا قيمة
// ظاهرة قبله (بند 3.1.2).
function SubscriptionScreen({ quota, onTrial, onBuy, onRestore, onClose, buying, error }) {
  const canTrial = (quota?.remainingTrial || 0) > 0;
  const subscribed = quota?.plan === "annual";
  const [prices, setPrices] = useState({});
  // ثلاث حالات لا اثنتان: null = ما نعرف بعد. لو بدأنا بـfalse، أول رسم
  // داخل تطبيق آبل يعرض زر الدفع بالبطاقة للحظة — وهذا وحده سبب كافٍ لشطب
  // التطبيق. فما نعرض أي وسيلة دفع قبل ما نتأكد من المنصة.
  const [platform, setPlatform] = useState(null);
  const webPayments = process.env.NEXT_PUBLIC_ENABLE_WEB_PAYMENTS === "true";

  useEffect(() => {
    const isNative = isNativeApp();
    setPlatform(isNative ? "store" : "web");
    if (!isNative) return;
    // آبل تشترط عرض السعر اللي بينخصم فعلاً، وهو يختلف بحسب متجر البلد
    // والضريبة — فنجيبه من المتجر، وأرقامنا المكتوبة احتياط لو فشل الجلب.
    import("@/lib/native")
      .then(({ nativeProductPrices }) =>
        nativeProductPrices([...SUBSCRIPTION_TIERS.map((t) => t.productId), CREDIT_PRODUCT_ID])
      )
      .then(setPrices)
      .catch(() => {});
  }, []);

  const priceOf = (productId, fallbackKwd) => prices[productId] || `${fallbackKwd} د.ك`;
  // بالتطبيق نشتري دايماً عبر المتجر. على الويب الشراء متاح فقط لو الدفع
  // بالبطاقة مفعّل — وإلا نوجّه ولي الأمر للتطبيق.
  const canBuy = platform === "store" || (platform === "web" && webPayments);

  return (
    <div className="app-scroll" style={{ height: "100%", padding: "18px 16px calc(env(safe-area-inset-bottom) + 20px)" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <TileIcon name="teacher" size={54} style={{ borderRadius: 18 }} />
          {onClose && (
            <button onClick={onClose} aria-label="إغلاق" style={{ background: "#F3F4F6", color: "#6B7280", borderRadius: "50%", width: 30, height: 30, fontSize: 17, lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#1F2937", lineHeight: 1.4 }}>
            معلّم خاص لأبنائك
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.75, color: "#6B7280" }}>
            يشرح الدروس ويجاوب على أسئلتك — من منهج وزارة التربية.
          </p>
        </div>

        {platform === "web" && canBuy && <TapPayerNotice />}

        {platform === null ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "24px 0" }}>...جاري التحميل</p>
        ) : !canBuy ? (
          <div style={{ background: "#F1EFFA", color: "#5C4B8C", borderRadius: 14, padding: "14px 16px", fontSize: 13, fontWeight: 700, lineHeight: 1.8 }}>
            الاشتراك يتم من تطبيق دفتري على موبايلك. نزّله وسجّل دخولك بنفس رقمك،
            وبيوصلك رصيدك على نفس الحساب.
          </div>
        ) : subscribed ? (
          <div style={{ background: "#FDF3E7", color: "#8C6027", borderRadius: 14, padding: "12px 14px", fontSize: 12.5, fontWeight: 700, lineHeight: 1.7 }}>
            خلص رصيد هذا الطالب/ة. أضف رصيد إضافي، أو انتظر تجديد الاشتراك.
          </div>
        ) : (
          SUBSCRIPTION_TIERS.map((t) => (
            <button
              key={t.productId}
              onClick={() => onBuy(t.productId)}
              disabled={buying}
              style={{
                background: "white", border: "1.5px solid #EDE9F4", borderRadius: 18, padding: "15px 16px",
                display: "flex", flexDirection: "column", gap: 3, textAlign: "start", opacity: buying ? 0.6 : 1,
              }}
            >
              <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#1F2937" }}>{t.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#5C4B8C", whiteSpace: "nowrap" }}>
                  {priceOf(t.productId, t.priceKwd)} / سنة
                </span>
              </span>
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>١٠ فلوس للسؤال</span>
            </button>
          ))
        )}

        {canBuy && (
          <button
            onClick={() => onBuy(CREDIT_PRODUCT_ID)}
            disabled={buying}
            style={{
              background: "white", border: "1.5px solid #EDE9F4", borderRadius: 18, padding: "15px 16px",
              display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10,
              opacity: buying ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800, color: "#1F2937" }}>
              رصيد إضافي {PLAN.CREDIT_PACK_QUESTIONS} سؤال
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#5C4B8C", whiteSpace: "nowrap" }}>
              {priceOf(CREDIT_PRODUCT_ID, PLAN.CREDIT_PACK_PRICE_KWD)}
            </span>
          </button>
        )}

        <div style={{ background: "#EBF7F1", borderRadius: 14, padding: "12px 14px", fontSize: 12.5, color: "#2F6E56", lineHeight: 1.7, fontWeight: 500 }}>
          الرصيد مقسّم بين الأبناء <strong>بالتساوي</strong>، وكل واحد له رصيده.
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: 10, fontSize: 12.5 }}>{error}</div>
        )}

        {canTrial && (
          <button onClick={onTrial} style={{ background: "transparent", color: "#5C4B8C", borderRadius: 15, padding: 11, fontSize: 14.5, fontWeight: 800 }}>
            جرّب {quota.remainingTrial} أسئلة مجاناً
          </button>
        )}

        <p style={{ margin: 0, fontSize: 10.5, color: "#9CA3AF", textAlign: "center", lineHeight: 1.9 }}>
          {platform === "store"
            ? "يتجدد سنوياً · تلغيه بأي وقت من إعدادات جهازك"
            : "شراء لسنة دراسية واحدة · بدون تجديد تلقائي"}
          <br />
          <a href="/terms" style={termsLink}>شروط الاستخدام</a>
          {" · "}
          <a href="/privacy" style={termsLink}>سياسة الخصوصية</a>
          {platform === "store" && (
            <>
              {" · "}
              <button onClick={onRestore} style={{ ...termsLink, background: "transparent", padding: 0, fontSize: 10.5, fontWeight: 400 }}>
                استعادة المشتريات
              </button>
            </>
          )}
        </p>

        <p style={{ margin: 0, paddingTop: 11, borderTop: "1px solid #F0EEE8", fontSize: 11.5, color: "#6B7280", textAlign: "center", lineHeight: 1.7 }}>
          هذا اشتراك مستقل خاص بالمعلم الذكي، منفصل عن اشتراك دفتري الأساسي.
        </p>
      </div>
    </div>
  );
}

const termsLink = { color: "#9CA3AF", textDecoration: "underline" };

// الدفع بالبطاقة يمر ببوابة Tap المسجّلة باسم الشركة المالكة، فيظهر
// «Prime Printing» بصفحة الدفع وبكشف الحساب. بلا تنبيه مسبق، الأم تشوف
// اسم مطبعة وهي تدفع لتطبيق مدرسي — فإما تلغي الدفع، أو تعترض على
// العملية ببنكها لاحقاً. التوقّع المسبق أرخص من الاثنين.
function TapPayerNotice() {
  return (
    <div style={{ background: "#F1EFFA", color: "#5C4B8C", borderRadius: 14, padding: "11px 14px", fontSize: 12, lineHeight: 1.85 }}>
      دفتري من إنتاج <strong>شركة برايم للطباعة</strong>، وسيتم تحويلك لبوابة الدفع التابعة لها.
    </div>
  );
}

// شريط الأذونات الناقصة. ١٣ جهازاً فقط من ٥٤ حساباً مفعّلة الإشعارات،
// والإشعار العام ما يوصل إلا لمن فعّلها أصلاً — فاللي يحتاجون التذكير ما
// يوصلهم. الشريط هو الطريق الوحيد للباقي.
function PermissionsBanner() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [needsSettings, setNeedsSettings] = useState(false);
  // ✕ تقفل الشريط — بس نحفظ معها «وش كان ناقصاً» وقت الإقفال: لو تغيّر
  // الناقص بعدين (مثلاً الصور انمنعت وهي مسموحة قبل) يرجع يظهر، فما
  // نخفي عنها سبباً جديداً لتعطّل الرفع أو التذكيرات.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("daftary_hint_perm") || ""; } catch { return ""; }
  });

  const check = useCallbackRef(async () => {
    setState(await permissionStatus());
  });

  useEffect(() => {
    check();
    // الأم تروح للإعدادات وترجع — نعيد الفحص عند الرجوع عشان الشريط
    // يختفي بنفسه بدل ما تعيد فتح التطبيق.
    const onBack = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onBack);
    return () => document.removeEventListener("visibilitychange", onBack);
  }, []);

  if (!state) return null;
  const missing = [];
  if (state.notifications !== "granted") missing.push("notifications");
  if (state.photos !== "granted") missing.push("photos");
  if (!missing.length) return null;
  const signature = missing.join(",");
  if (dismissed === signature) return null;

  const label =
    missing.length === 2 ? "الإشعارات والصور"
    : missing[0] === "notifications" ? "الإشعارات"
    : "الصور";

  // «denied» يعني آبل ما راح تفتح النافذة مهما طلبنا — الإعدادات المخرج الوحيد.
  const blocked = missing.some((k) => state[k] === "denied");

  async function enable() {
    setBusy(true);
    const results = {};
    for (const kind of missing) results[kind] = await requestPermission(kind);

    // نثق بنتيجة الطلب المباشرة فوق إعادة الفحص: بعض المنصات تتأخر بتحديث
    // checkPermissions بعد الموافقة مباشرة، فيبقى الشريط ظاهراً بعد ما
    // وافقت فعلاً — وهذا يخليها تظن إن الضغطة ما نفعت.
    const next = { ...(await permissionStatus()) };
    for (const [kind, value] of Object.entries(results)) {
      if (value === "granted") next[kind] = "granted";
    }
    setState(next);

    const still = ["notifications", "photos"].filter((k) => next[k] !== "granted");
    if (still.length) setNeedsSettings(true);
    setBusy(false);
  }

  return (
    <div style={{ background: "#FDF3E7", borderRadius: 14, padding: "12px 14px", margin: "0 16px 12px", display: "flex", alignItems: "center", gap: 11 }}>
      <TileIcon name="bell" size={30} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#8C6027" }}>فعّلي {label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#A07C43", lineHeight: 1.6 }}>
          {blocked || needsSettings
            ? `من إعدادات موبايلك ← دفتري ← فعّلي ${label}`
            : "عشان يوصلك تذكير الواجبات، ويشتغل رفع صور الجداول"}
        </p>
      </div>
      {!(blocked || needsSettings) && (
        <button
          onClick={enable}
          disabled={busy}
          style={{ background: "#E8B863", color: "white", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 800, flexShrink: 0, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "..." : "تفعيل"}
        </button>
      )}
      <button
        onClick={() => { setDismissed(signature); try { localStorage.setItem("daftary_hint_perm", signature); } catch {} }}
        aria-label="إغلاق"
        style={{ background: "none", color: "#B08A4F", fontSize: 18, lineHeight: 1, width: 28, height: 28, padding: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        ×
      </button>
    </div>
  );
}

// سبب عدم فتح الصور + مخرج للأم. الزر الميت بلا تفسير أسوأ من الخطأ
// نفسه: ما تعرف هل الخلل من البرنامج ولا من جوالها ولا وش تسوي.
function PickErrorNotice({ error }) {
  const isCamera = error.source === "camera";
  const text =
    error.reason === "denied"
      ? `دفتري ما عنده إذن يوصل ${isCamera ? "للكاميرا" : "لصورك"}. افتحي إعدادات موبايلك ← دفتري ← ${isCamera ? "الكاميرا" : "الصور"} وفعّلي الإذن، ثم ارجعي وجربي.`
      : error.reason === "unavailable"
      ? "هذي الميزة تحتاج آخر إصدار من التطبيق. حدّثيه من آب ستور وجربي مرة ثانية."
      : "صار خلل فني وما انفتحت الصور. جربي تقفلين التطبيق وتفتحينه من جديد.";

  return (
    <div style={{ background: "#FEF2F2", borderRadius: 12, padding: "12px 14px" }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "#B91C1C", fontWeight: 700, lineHeight: 1.8 }}>{text}</p>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 10, background: "white", color: "#374151", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}
      >
        <TileIcon name="whatsapp" size={20} />
        ما زالت ما تشتغل؟ راسلينا
      </a>
    </div>
  );
}

// طلب التقييم. ما فيه زر «مو الحين»: يبقى ظاهراً لين تقيّم، وبعدها يختفي
// نهائياً — القيد بجدول app_feedback (صف واحد لكل ولية أمر) هو اللي يضمنه.
function FeedbackBanner({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "start",
        background: "#F1EFFA", borderRadius: 14, padding: "13px 14px", margin: "0 16px 12px",
        width: "calc(100% - 32px)", fontFamily: "inherit" }}
    >
      <TileIcon name="star" size={30} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#5C4B8C" }}>شرايكم بدفتري؟</span>
        <span style={{ display: "block", fontSize: 11.5, color: "#7A6E96", lineHeight: 1.6 }}>
          تقييمك بنص دقيقة يساعدنا نطوّره
        </span>
      </span>
      <span style={{ marginInlineStart: "auto", color: "#B7A6E8", fontSize: 18, flexShrink: 0 }}>‹</span>
    </button>
  );
}

// يحفظ آخر نسخة من الدالة بلا ما يعيد ربط المستمعين بكل رسم
function useCallbackRef(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useRef((...args) => ref.current(...args)).current;
}

const RATING_LABELS = ["", "غير راضية", "مو زينة", "عادية", "راضية", "راضية جداً"];

function FeedbackModal({ onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!rating) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الإرسال");
      hapticSuccess();
      onDone();
    } catch (e) {
      setError(e.message || "تعذّر الإرسال، حاولي مرة ثانية.");
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(30,25,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "22px 18px", width: "100%", maxWidth: 380, boxShadow: "0 8px 30px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -6 }}>
          <button onClick={onClose} aria-label="إغلاق" style={{ background: "#F3F4F6", color: "#6B7280", borderRadius: "50%", width: 28, height: 28, fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        <p style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#374151", textAlign: "center" }}>شرايكم بدفتري؟</p>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#9CA3AF", textAlign: "center", lineHeight: 1.7 }}>
          رأيك يوصل لنا مباشرة ويساعدنا نطوّر البرنامج
        </p>

        {/* الترتيب بصرياً من اليمين لليسار: أول نجمة يمين = ١ */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} من ٥`}
              style={{ background: "none", padding: 2, lineHeight: 0 }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill={n <= rating ? "#EFC148" : "#E8E4DC"}>
                <path d="M12 2.5l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-1z" />
              </svg>
            </button>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: "#5C4B8C", minHeight: 20, margin: "0 0 12px" }}>
          {RATING_LABELS[rating] || ""}
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="شنو عندكم ملاحظات أو اقتراحات؟"
          style={{ width: "100%", border: "1px solid #E8E4DC", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", background: "#FCFBF9", color: "#374151" }}
        />

        {error && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#B91C1C", textAlign: "center" }}>{error}</p>}

        <button
          onClick={submit}
          disabled={!rating || busy}
          style={{ width: "100%", marginTop: 10, background: !rating || busy ? "#D8D2E8" : "#B7A6E8", color: "white", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 800, minHeight: 48 }}
        >
          {busy ? "جاري الإرسال..." : "إرسال التقييم"}
        </button>
        <p style={{ textAlign: "center", fontSize: 11.5, color: "#B0AAB8", margin: "10px 0 0" }}>شكراً لوقتكم 🤍</p>
      </div>
    </div>
  );
}

// شاشة القفل الكاملة — تظهر بدل التطبيق كله لمن ما عنده اشتراك سارٍ.
// المعلم الذكي مستثنى (له اشتراكه المستقل)، فهذي الشاشة ما تظهر أبداً
// طالما appPaywallState() يرجّع غير "enforced".
// منطق الشراء والباقات مشترك بين شاشة القفل الكاملة (AppAccessPaywall)
// وبطاقة إدارة الاشتراك بصفحة الحساب (SubscriptionManageCard) — نفس
// الأزرار بالضبط، يفرق بس الإطار حولها.
function SubscriptionTiersPicker({ studentsCount, subscription, motherId, onUnlocked }) {
  const [platform, setPlatform] = useState(null);
  const [prices, setPrices] = useState({});
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  // الدفع بالبطاقة للويب فقط. داخل التطبيق الشراء عبر المتجر إلزامياً
  // (بند آبل 3.1.1)، وعرض بديل بالبطاقة هناك يعرّض التطبيق للشطب — لذلك
  // نعتمد على platform === "web" مو على العلم وحده.
  const webPayments = process.env.NEXT_PUBLIC_ENABLE_WEB_PAYMENTS === "true";
  const canPayByCard = platform === "web" && webPayments;

  useEffect(() => {
    const isNative = isNativeApp();
    setPlatform(isNative ? "store" : "web");
    if (!isNative) return;
    import("@/lib/native")
      .then(({ nativeProductPrices }) => nativeProductPrices(APP_TIERS.map((t) => t.productId)))
      .then(setPrices)
      .catch(() => {});
  }, []);

  const priceOf = (productId, fallbackKwd) =>
    prices[productId] || `${String(fallbackKwd).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])} د.ك / سنة`;
  const recommended = APP_TIERS.find((t) => studentsCount <= t.maxStudents) || APP_TIERS.at(-1);

  async function buy(productId) {
    setError("");
    setBuying(true);

    // على الويب: فاتورة Tap ثم تحويل لصفحة الدفع. المنح يصير بالسيرفر بعد
    // ما يستعلم عن الشحنة من Tap نفسها، مو من رجوع المتصفح.
    if (canPayByCard) {
      try {
        const res = await fetch("/api/payments/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "تعذّر بدء عملية الدفع.");
        window.location.href = data.url;
      } catch (err) {
        setError(err.message || "تعذّر بدء عملية الدفع.");
        setBuying(false);
      }
      return;
    }

    try {
      const { nativePurchase } = await import("@/lib/native");
      const ref = await nativePurchase(productId, { subscription: true, accountToken: motherId });
      if (!ref) throw new Error("تم إلغاء الشراء.");
      const isGoogle = ref.platform === "android";
      const res = await fetch(isGoogle ? "/api/subscription/app-access/google" : "/api/subscription/app-access/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isGoogle ? { purchaseToken: ref.token, productId: ref.productId || productId } : { transactionId: ref.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر تفعيل الاشتراك.");
      onUnlocked();
    } catch (err) {
      setError(err.message || "تعذّر إتمام الشراء، حاول مرة ثانية.");
    }
    setBuying(false);
  }

  async function restore() {
    setError("");
    setBuying(true);
    try {
      const { nativeRestorePurchases } = await import("@/lib/native");
      const refs = await nativeRestorePurchases(motherId);
      if (!refs.length) throw new Error("ما لقينا مشتريات سابقة على حسابك بالمتجر.");
      for (const ref of refs) {
        const isGoogle = ref.platform === "android";
        await fetch(isGoogle ? "/api/subscription/app-access/google" : "/api/subscription/app-access/apple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isGoogle ? { purchaseToken: ref.token, productId: ref.productId } : { transactionId: ref.token }),
        });
      }
      onUnlocked();
    } catch (err) {
      setError(err.message || "تعذّرت استعادة المشتريات.");
    }
    setBuying(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {subscription?.max_students && subscription.max_students < studentsCount && (
        <div style={{ background: "#FDF3E7", color: "#8C6027", borderRadius: 14, padding: "12px 14px", fontSize: 12.5, fontWeight: 700, lineHeight: 1.8 }}>
          عندك اشتراك فعلي يغطي {subscription.max_students} {subscription.max_students === 1 ? "طالب/ة" : "طلاب"} بس، وعندك {studentsCount} مسجَّلين الحين.
          {platform === "store"
            ? " اختاري باقة أكبر تغطي الجميع — تُحتسب ترقية وآبل تحسب الفرق تلقائياً، مو شراءً جديداً."
            : " اختاري باقة أكبر تغطي الجميع."}
        </div>
      )}

      {canPayByCard && <TapPayerNotice />}

      {platform === null ? (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "24px 0" }}>...جاري التحميل</p>
      ) : platform !== "store" && !canPayByCard ? (
        <div style={{ background: "#F1EFFA", color: "#5C4B8C", borderRadius: 14, padding: "14px 16px", fontSize: 13, fontWeight: 700, lineHeight: 1.8 }}>
          الاشتراك يتم من تطبيق دفتري على موبايلك. نزّلي التطبيق وسجّلي دخولك بنفس رقمك.
        </div>
      ) : (
        APP_TIERS.map((t) => (
          <button
            key={t.productId}
            onClick={() => buy(t.productId)}
            disabled={buying}
            style={{
              background: "white", border: t.productId === recommended.productId ? "1.5px solid #5C4B8C" : "1.5px solid #EDE9F4",
              borderRadius: 18, padding: "15px 16px", display: "flex", flexDirection: "column", gap: 3, textAlign: "start",
              opacity: buying ? 0.6 : 1, position: "relative",
            }}
          >
            {t.productId === recommended.productId && (
              <span style={{ position: "absolute", top: -10, insetInlineStart: 15, background: "#5C4B8C", color: "white", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 999 }}>
                الأنسب لعائلتك
              </span>
            )}
            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1F2937" }}>{t.label}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#5C4B8C", whiteSpace: "nowrap" }}>{priceOf(t.productId, t.priceKwd)}</span>
            </span>
          </button>
        ))
      )}

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: 10, fontSize: 12.5 }}>{error}</div>
      )}

      {platform === "store" && (
        <button onClick={restore} disabled={buying} style={{ background: "transparent", color: "#5C4B8C", borderRadius: 15, padding: 11, fontSize: 14, fontWeight: 800 }}>
          استعادة المشتريات
        </button>
      )}

      <p style={{ margin: 0, fontSize: 10.5, color: "#9CA3AF", textAlign: "center", lineHeight: 1.9 }}>
        {/* الدفع بالبطاقة شراء لسنة واحدة بلا تجديد تلقائي — كتابة «يتجدد
            سنوياً» هناك وعد بشي ما يصير. */}
        {platform === "store"
          ? "يتجدد سنوياً · تلغيه بأي وقت من إعدادات جهازك"
          : "اشتراك لسنة دراسية واحدة · بدون تجديد تلقائي"}
        <br />
        <a href="/terms" style={termsLink}>شروط الاستخدام</a>
        {" · "}
        <a href="/privacy" style={termsLink}>سياسة الخصوصية</a>
      </p>
    </div>
  );
}

// لو ولي الأمر تجاوز حد باقته (أضافت طالباً زايداً)، هذي الشاشة هي المكان
// الوحيد اللي تشوفه — فلازم يكون فيها طريقة ترجع تحت الحد بنفسها (حذف
// طالب/ة) بدون ما تحتاج تدفع أو تتواصل معنا. GET/DELETE على /api/children
// مستثنيان من الحجب بالضبط لهذا السبب (middleware.js).
function ManageChildrenInline({ motherId, onChanged }) {
  const [children, setChildren] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetch(`/api/children?motherId=${motherId}`)
      .then((r) => r.json())
      .then((d) => setChildren(d.children || []))
      .catch(() => setChildren([]));
  }, [motherId]);

  async function remove(id) {
    if (!confirm("حذف هذا الطالب/ـة نهائياً؟ راح تنحذف كل واجباته ومتطلباته معه.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/children/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
      if (!res.ok) throw new Error();
      setChildren((prev) => prev.filter((c) => c.id !== id));
      onChanged?.();
    } catch {
      alert("تعذّر الحذف، حاولي مرة ثانية.");
    }
    setBusyId(null);
  }

  if (!children?.length) return null;

  return (
    <div style={{ background: "white", border: "1.5px solid #EDE9F4", borderRadius: 18, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1F2937" }}>أو احذفي طالباً/ة لترجعي تحت حد باقتك الحالية:</p>
      {children.map((c) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13.5, color: "#374151" }}>{c.name}</span>
          <button onClick={() => remove(c.id)} disabled={busyId === c.id} style={{ background: "transparent", color: "#B91C1C", fontSize: 12.5, fontWeight: 700, padding: "6px 10px" }}>
            {busyId === c.id ? "..." : "حذف"}
          </button>
        </div>
      ))}
    </div>
  );
}

function AppAccessPaywall({ studentsCount, subscription, motherId, onUnlocked, onLogout }) {
  const overLimit = subscription?.max_students != null && subscription.max_students < studentsCount;
  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", background: "#FAF7F2", padding: "18px 16px calc(env(safe-area-inset-bottom) + 20px)" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 13 }}>
        <img src="/logo.png" alt="دفتري" style={{ width: 54, height: 54, borderRadius: 18 }} />
        <div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#1F2937", lineHeight: 1.4 }}>
            اشتراك دفتري السنوي
          </h2>
        </div>

        <SubscriptionTiersPicker studentsCount={studentsCount} subscription={subscription} motherId={motherId} onUnlocked={onUnlocked} />

        {overLimit && <ManageChildrenInline motherId={motherId} onChanged={onUnlocked} />}

        <button onClick={onLogout} style={{ background: "transparent", color: "#9CA3AF", fontSize: 12.5, fontWeight: 700, padding: 8 }}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

// بطاقة إدارة الاشتراك بصفحة "حسابي" — نفس منتقي الباقات، لكن قابلة
// للوصول دائماً (مو بس وقت القفل الكامل) عشان ولي الأمر يرقّي باقته
// بنفسه قبل ما يضيف طالباً يتجاوز حدها، بدل ما يفاجأ بقفل كامل التطبيق.
function SubscriptionManageView({ motherId, studentsCount, onClose, onChanged }) {
  const [access, setAccess] = useState(null);

  useEffect(() => {
    fetch("/api/subscription/app-access/status")
      .then((r) => r.json())
      .then(setAccess)
      .catch(() => setAccess({ subscription: null }));
  }, []);

  return (
    <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 60, background: "#FAF7F2", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, background: "white", padding: "calc(env(safe-area-inset-top) + 12px) 16px 14px", borderBottom: "1px solid #F0EEE8", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", fontSize: 20, width: 36, height: 36 }}>←</button>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>اشتراك دفتري</p>
      </div>
      <div className="app-scroll" style={{ flex: 1, padding: "18px 16px calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 13 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: "#6B7280" }}>
            {access?.subscription?.max_students
              ? `اشتراكك الحالي يغطي ${access.subscription.max_students} ${access.subscription.max_students === 1 ? "طالب/ة" : "طلاب"}. رقّي باقتك هنا وقت ما تحتاجين.`
              : "اختاري الباقة المناسبة لعدد أبنائك."}
          </p>
          {access === null ? (
            <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "24px 0" }}>...جاري التحميل</p>
          ) : (
            <SubscriptionTiersPicker
              studentsCount={studentsCount}
              subscription={access?.subscription}
              motherId={motherId}
              onUnlocked={() => { onChanged?.(); onClose(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherView({ children, motherId }) {
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [native, setNative] = useState(false);
  const [quota, setQuota] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [trialAccepted, setTrialAccepted] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const fileRef = useRef();
  const bottomRef = useRef();
  useEffect(() => setNative(isNativeApp()), []);
  const child = children.find((c) => c.id === childId);

  useEffect(() => {
    if (!childId) return;
    setHistoryLoading(true);
    fetch(`/api/ai-teacher/history?childId=${childId}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setHistoryLoading(false));
  }, [childId, motherId]);

  // رصيد الطالب/ة المختار. لو فشل الجلب نخلي quota = null ونسمح بالمحادثة —
  // السيرفر يخصم ويمنع على أي حال، فما نقفل الميزة بسبب خلل عندنا بالعرض.
  useEffect(() => {
    if (!childId) return;
    setPaywallOpen(false); setTrialAccepted(false);
    setQuota(null);
    fetch(`/api/subscription/status?childId=${childId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setQuota(data))
      .catch(() => setQuota(null));
  }, [childId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, image]);

  // بعد التصوير أو الاختيار تمر الصورة بشاشة قص: الأم تحدد السؤال فقط
  // بدل الصفحة كلها. الماسح يقص الصفحة أصلاً فما يحتاجها.
  const [cropSrc, setCropSrc] = useState(null);
  // الصورة المعروضة بالحجم الكامل — تنفتح بالضغط على المصغّرة، بالمرفق
  // قبل الإرسال وبالرسالة بعده، عشان تشوف الأم بالضبط وش راح للمعلم.
  const [viewImage, setViewImage] = useState(null);

  async function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    // نمرّر الصورة بدقتها الأصلية لشاشة القص، والتصغير لـ١٥٦٨ يصير على
    // **المقصوص** لا على الصفحة كاملة. عكسه كان يرمي الدقة قبل القص:
    // صفحة ٤٠٣٢ تصغّر لـ١٥٦٨، ويقص منها السؤال (٣٠٪) فيطلع ٤٧٠ بكسل —
    // وخط عربي بهالمقاس ما ينقرأ، فتضطر الأم تكتب السؤال بيدها.
    // السقف ٤٠٩٦ يمرّر صور الجوالات كما هي ويحمي من صورة ضخمة شاذة.
    const url = await resizeToDataUrl(file, 4096, false, 0.92);
    setCropSrc(url);
  }

  // بتطبيق آبل نصوّر الواجب مباشرة بالكاميرا الأصلية بدل منتقي الملفات،
  // وبالنسخة الجديدة فيه ماسح مستندات يقص ويعدّل تلقائياً.
  const [scanner, setScanner] = useState(false);
  useEffect(() => setScanner(hasDocumentScanner()), []);

  const [pickMenu, setPickMenu] = useState(false);

  async function pickImageNative(mode = "camera") {
    setPickMenu(false);
    // القص يحتاج الدقة الأصلية (راجع handlePickImage) — وهذا يشمل الماسح
    // كذلك: هو يعدّل ميلان **الصفحة** ويقصها من الخلفية، لكن السؤال يبقى
    // جزءاً صغيراً منها، فتحديده بالإطار هو اللي يعطيه الدقة الكاملة.
    const { url } = mode === "scan" ? await nativeScanDocument(4096) : await nativePickImage(mode, 4096);
    if (!url) return;
    hapticLight();
    setCropSrc(url);
  }

  async function send() {
    if (!input.trim() && !image) return;
    const questionText = input.trim();
    const attachedImage = image;
    setSending(true);
    setErrorMsg("");
    // نحتفظ بالصورة نفسها بالرسالة (مو بس had_image) عشان تبقى معروضة
    // بالمحادثة — الخادم ما يخزّن الصورة، فهي تبقى لين ما تقفل الشاشة.
    setMessages((prev) => [...prev, { role: "user", content: questionText || "📷 صورة مرفقة", had_image: !!attachedImage, image: attachedImage || null, id: `local-${Date.now()}` }]);
    setInput("");
    setImage(null);
    try {
      // الصورة المقلوبة يكتشفها الخادم قبل ما يخصم السؤال، ونحن ندوّرها
      // هنا ونعيد الإرسال — نفس آلية رفع الجداول.
      let img = attachedImage;
      let res, data;
      for (let i = 0; ; i++) {
        res = await fetch("/api/ai-teacher/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motherId, childId, question: questionText, image: img || undefined }),
        });
        data = await res.json();
        if (!data.needsRotation || !img || i >= 3) break;
        img = await rotateDataUrl(img, data.needsRotation);
      }
      // ٤٠٢ = خلص الرصيد. نرجّع شاشة الاشتراك بدل رسالة خطأ مبهمة.
      if (res.status === 402) {
        setQuota((q) => ({ ...(q || {}), remainingTotal: 0, remainingTrial: 0 }));
        setPaywallOpen(true);
        setMessages((prev) => prev.slice(0, -1));
        setSending(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, had_image: false, id: `local-a-${Date.now()}` }]);
      if (data.quota?.remaining !== undefined) {
        setQuota((q) => ({ ...(q || {}), remainingTotal: data.quota.remaining }));
      }
    } catch (err) {
      setErrorMsg(err.message || "تعذّر إرسال السؤال، حاولي مرة ثانية.");
    }
    setSending(false);
  }

  async function refreshQuota() {
    const fresh = await fetch(`/api/subscription/status?childId=${childId}`).then((r) => r.json());
    setQuota(fresh);
    return fresh;
  }

  // مساران منفصلان تماماً: داخل تطبيق آبل الشراء بـStoreKit إلزامياً
  // (بند 3.1.1)، وعلى الويب بالبطاقة عبر Tap. الاثنان ينتهيان بتحقق من
  // السيرفر قبل منح الرصيد.
  async function buy(productId) {
    setBuyError("");

    if (!native) {
      setBuying(true);
      try {
        const res = await fetch("/api/payments/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, childId }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "تعذّر بدء عملية الدفع.");
        window.location.href = data.url;
      } catch (err) {
        setBuyError(err.message || "تعذّر بدء عملية الدفع.");
        setBuying(false);
      }
      return;
    }

    setBuying(true);
    try {
      const { nativePurchase } = await import("@/lib/native");
      const ref = await nativePurchase(productId, {
        subscription: productId !== CREDIT_PRODUCT_ID,
        accountToken: motherId,
      });
      if (!ref) throw new Error("تم إلغاء الشراء.");
      const data = await verifyPurchase(ref, productId);
      if (!data.ok) throw new Error(data.error || "تعذّر تفعيل الاشتراك.");
      await refreshQuota();
      setPaywallOpen(false);
      setTrialAccepted(true);
      hapticSuccess();
    } catch (err) {
      setBuyError(err.message || "تعذّر إتمام الشراء، حاول مرة ثانية.");
    }
    setBuying(false);
  }

  // لكل متجر مسار تحقق مختلف: آبل تعرّف الشراء بـtransactionId وجوجل
  // بـpurchaseToken، والتحقق نفسه يمر على واجهة برمجية مختلفة تماماً.
  async function verifyPurchase(ref, productId) {
    const isGoogle = ref.platform === "android";
    const res = await fetch(isGoogle ? "/api/subscription/google" : "/api/subscription/apple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isGoogle
          ? { purchaseToken: ref.token, productId: ref.productId || productId, childId }
          : { transactionId: ref.token, childId }
      ),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...data } : { ok: false, error: data.error };
  }

  async function restore() {
    setBuyError("");
    if (!native) {
      setBuyError("استعادة المشتريات متاحة من تطبيق دفتري على آيفون.");
      return;
    }
    setBuying(true);
    try {
      const { nativeRestorePurchases } = await import("@/lib/native");
      const refs = await nativeRestorePurchases(motherId);
      if (!refs.length) throw new Error("ما لقينا مشتريات سابقة على حسابك بالمتجر.");
      for (const ref of refs) {
        await verifyPurchase(ref, ref.productId);
      }
      const fresh = await refreshQuota();
      if ((fresh?.remainingTotal || 0) <= 0) throw new Error("ما فيه اشتراك ساري على حسابك بالمتجر.");
      setPaywallOpen(false);
      setTrialAccepted(true);
    } catch (err) {
      setBuyError(err.message || "تعذّرت استعادة المشتريات.");
    }
    setBuying(false);
  }

  // شاشة الاشتراك تظهر بثلاث حالات: خلص الرصيد (إجبارية، ما فيها إغلاق)،
  // أو أول مرة قبل ما يبدأ التجربة، أو لما يفتحها بنفسه من شريط الرصيد.
  const outOfQuota = quota !== null && (quota.remainingTotal || 0) <= 0;
  const firstTime = quota !== null && quota.plan !== "annual"
    && (quota.remainingCredits || 0) === 0
    && (quota.remainingTrial || 0) === PLAN.TRIAL_QUESTIONS;

  if (children.length && (outOfQuota || paywallOpen || (firstTime && !trialAccepted))) {
    return (
      <SubscriptionScreen
        quota={quota}
        buying={buying}
        error={buyError}
        onTrial={() => { setTrialAccepted(true); setPaywallOpen(false); }}
        onBuy={buy}
        onRestore={restore}
        onClose={outOfQuota ? null : () => { setPaywallOpen(false); setTrialAccepted(true); }}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {children.length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {children.map((c) => (
              <button key={c.id} onClick={() => setChildId(c.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 6px", borderRadius: 20, background: childId === c.id ? "#F1EFFA" : "#F9F9F7", border: `1px solid ${childId === c.id ? "#B7A6E8" : "#EEEDE8"}`, flexShrink: 0 }}>
                <Avatar child={c} size={26} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: childId === c.id ? "#5C4B8C" : "#6B7280" }}>{c.name}</span>
              </button>
            ))}
          </div>
        )}

        <HintBanner id="teacher" style={{ lineHeight: 1.6 }}>
          اسألي عن أي واجب أو درس بمنهج {child ? `الصف ${child.grade}` : "ابنك/ابنتك"} — تقدرين ترفقين صورة الواجب مباشرة، والمعلم الذكي يستعين بمواد وزارة التربية الرسمية لما تكون متوفرة.
        </HintBanner>

        {quota && (quota.remainingTotal || 0) > 0 && (
          <button
            onClick={() => setPaywallOpen(true)}
            style={{ background: "transparent", padding: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
          >
            <span style={{ fontSize: 11.5, color: "#9CA3AF", fontWeight: 700 }}>
              متبقي {quota.remainingTotal} سؤال
              {quota.plan !== "annual" && (quota.remainingTrial || 0) > 0 ? " (تجربة مجانية)" : ""}
            </span>
            <span style={{ fontSize: 11.5, color: "#5C4B8C", fontWeight: 800 }}>
              {quota.plan === "annual" ? "شراء رصيد" : "الاشتراك"}
            </span>
          </button>
        )}
      </div>

      {/* minHeight: 0 إلزامي: بدونه الحد الأدنى لعنصر flex يساوي محتواه، فلما
          تطول المحادثة تتمدد القائمة على طول الرسائل وتدفع صف الإرسال تحت
          الشاشة بدل ما تتمرر داخلياً — وهذا «زر الإرسال ما يظهر». */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {historyLoading ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>...جاري التحميل</p>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>ابدئي بسؤال 👋</p>
        ) : (
          messages.map((m, i) => (
            <div key={m.id || i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
              <div style={{
                maxWidth: "84%",
                padding: "11px 14px",
                borderRadius: 14,
                fontSize: 15,
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
                background: m.role === "user" ? "#B7A6E8" : "#F3F2FA",
                color: m.role === "user" ? "white" : "#374151",
              }}>
                {/* الصورة فوق النص: أول شي تشوفه الأم هو وش أرسلت.
                    `image` للّي انرسلت توّها بهالجلسة، و`image_url` رابط
                    موقّع يجي مع المحادثة من الخادم (تُحفظ ٢٤ ساعة). */}
                {(m.image || m.image_url) ? (
                  <img
                    src={m.image || m.image_url}
                    alt="الصورة المرسلة"
                    onClick={() => setViewImage(m.image || m.image_url)}
                    style={{ display: "block", width: "100%", maxHeight: 190, objectFit: "cover", borderRadius: 10, marginBottom: m.content ? 8 : 0, cursor: "zoom-in" }}
                  />
                ) : null}
                {renderWithNumbers(m.content)}
                {m.had_image && !m.image && !m.image_url && (
                  // أقدم من ٢٤ ساعة: الصورة انحذفت فنكتفي بالإشارة
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <TileIcon name="camera" size={14} />
                    مع صورة (انحذفت بعد ٢٤ ساعة)
                  </div>
                )}
                {native && m.role === "assistant" && (
                  <button
                    onClick={() => nativeShare({ title: "شرح من المعلم الذكي — دفتري", text: m.content })}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, background: "rgba(123,104,196,.1)", color: "#7B68C4", fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 999 }}
                  >
                    <Icon name="share" size={14} />
                    مشاركة
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ padding: "10px 13px", borderRadius: 14, fontSize: 13, background: "#F3F2FA", color: "#9CA3AF" }}>...المعلم الذكي يفكر</div>
          </div>
        )}
        {errorMsg && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: 10, fontSize: 12.5 }}>{errorMsg}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {cropSrc && <CropModal src={cropSrc} onDone={(u) => { setImage(u); setCropSrc(null); }} onCancel={() => setCropSrc(null)} />}

      {viewImage && (
        <div
          onClick={() => setViewImage(null)}
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(env(safe-area-inset-top) + 44px) 12px calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <img src={viewImage} alt="الصورة بالحجم الكامل" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          <button
            aria-label="إغلاق الصورة"
            onClick={() => setViewImage(null)}
            style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 10px)", left: 14, background: "rgba(255,255,255,.18)", color: "white", borderRadius: 999, width: 34, height: 34, fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ flexShrink: 0, borderTop: "1px solid #F0EEE8", background: "white", padding: "8px 16px calc(env(safe-area-inset-bottom) + 10px)", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* أكثر سبب لرد «أرسلي صورة أوضح»: ظل اليد على الصفحة. نقولها قبل التصوير. */}
        <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.6 }}>
          📸 صوّري الصفحة بلا ظل — وبعدها حدّدي السؤال بالإطار عشان يطلع بأوضح صورة، أو أرسلي الصفحة كاملة.
        </p>
        {/* الصورة من ألبوم الجوال أعلى جودة من كاميرا داخل التطبيق، فنعرض
            الخيارين (والماسح لو متوفر) بقائمة صغيرة بدل الكاميرا مباشرة. */}
        {native && pickMenu && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => pickImageNative("photos")} style={{ flex: 1, background: "#F1EFFA", color: "#5C4B8C", borderRadius: 12, padding: "10px 8px", fontSize: 13, fontWeight: 800 }}>🖼️ ألبوم الصور</button>
            <button onClick={() => pickImageNative("camera")} style={{ flex: 1, background: "#F3F4F6", color: "#374151", borderRadius: 12, padding: "10px 8px", fontSize: 13, fontWeight: 800 }}>📷 الكاميرا</button>
            {/* منتقي الملفات داخل تطبيق آبل يفتح «الملفات» و«الصور» بجودتها الأصلية */}
            <button onClick={() => { setPickMenu(false); fileRef.current?.click(); }} style={{ flex: 1, background: "#F3F4F6", color: "#374151", borderRadius: 12, padding: "10px 8px", fontSize: 13, fontWeight: 800 }}>📁 ملف</button>
            {scanner && (
              <button onClick={() => pickImageNative("scan")} style={{ flex: 1, background: "#F3F4F6", color: "#374151", borderRadius: 12, padding: "10px 8px", fontSize: 13, fontWeight: 800 }}>📄 مسح مستند</button>
            )}
          </div>
        )}
        {image && (
          // المرفق قبل الإرسال: مصغّرة أكبر + «اضغطي للتكبير» — الأم لازم
          // تتأكد إن السؤال بيّن بالصورة قبل ما ينخصم سؤال من رصيدها.
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", width: 88, height: 88, borderRadius: 12, overflow: "hidden", flexShrink: 0, border: "1px solid #E5E7EB" }}>
              <img
                src={image}
                alt="الصورة المرفقة"
                onClick={() => setViewImage(image)}
                style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }}
              />
              <button aria-label="حذف الصورة" onClick={() => setImage(null)} style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,.6)", color: "white", borderRadius: "50%", width: 20, height: 20, fontSize: 13, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: "#374151", fontWeight: 700 }}>الصورة اللي بتنرسل</p>
              <button onClick={() => setViewImage(image)} style={{ marginTop: 4, background: "#F1EFFA", color: "#5C4B8C", borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 700 }}>
                اضغطي للتكبير
              </button>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button onClick={() => (native ? setPickMenu((v) => !v) : fileRef.current?.click())} aria-label="إرفاق صورة" style={{ background: pickMenu ? "#F1EFFA" : "#F3F4F6", borderRadius: 12, width: 44, height: 44, fontSize: 18, flexShrink: 0, color: "#7B68C4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {native ? <Icon name="camera" size={22} /> : <TileIcon name="camera" size={24} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePickImage} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتبي سؤالك..."
            rows={1}
            style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "11px 12px", fontSize: 16, resize: "none", fontFamily: "inherit", minHeight: 44, maxHeight: 100 }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button disabled={sending || (!input.trim() && !image)} onClick={send} style={{ background: "#B7A6E8", color: "white", borderRadius: 12, width: 44, height: 44, fontSize: 16, flexShrink: 0, opacity: sending || (!input.trim() && !image) ? 0.4 : 1 }}>➤</button>
        </div>
      </div>
    </div>
  );
}

function ProgressView({ children, motherId, classSchedule = [] }) {
  const [section, setSection] = useState("notes");
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [native, setNative] = useState(false);
  const child = children.find((c) => c.id === childId) || children[0];

  useEffect(() => setNative(isNativeApp()), []);

  // مواد الطالب/ة من جدول حصصه هي الأصدق لقائمة اختيار المادة — بلا قائمة
  // ثابتة من عندنا تجبر الأم تلقى مادتها بين مواد مدرسة ثانية.
  const subjects = [...new Set(
    classSchedule.filter((s) => s.child_id === child?.id).map((s) => s.subject?.trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "ar"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {children.map((c) => (
            <button key={c.id} onClick={() => setChildId(c.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 6px", borderRadius: 20, background: (childId || children[0].id) === c.id ? "#F1EFFA" : "#F9F9F7", border: `1px solid ${(childId || children[0].id) === c.id ? "#B7A6E8" : "#EEEDE8"}`, flexShrink: 0 }}>
              <Avatar child={c} size={26} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: (childId || children[0].id) === c.id ? "#5C4B8C" : "#6B7280" }}>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {native ? (
        <div className="ios-segmented">
          <button onClick={() => setSection("notes")} data-active={section === "notes"}>ملاحظات المعلم</button>
          <button onClick={() => setSection("grades")} data-active={section === "grades"}>الدرجات</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setSection("notes")} style={{ flex: 1, padding: 10, borderRadius: 12, background: section === "notes" ? "#B7A6E8" : "#F3F4F6", color: section === "notes" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <TileIcon name="teacher" size={17} />
              ملاحظات المعلم
            </span>
          </button>
          <button onClick={() => setSection("grades")} style={{ flex: 1, padding: 10, borderRadius: 12, background: section === "grades" ? "#B7A6E8" : "#F3F4F6", color: section === "grades" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <TileIcon name="chart" size={17} />
              الدرجات
            </span>
          </button>
        </div>
      )}

      {child && (section === "notes" ? (
        <TeacherNotesSection child={child} motherId={motherId} subjects={subjects} />
      ) : (
        <GradesSection child={child} motherId={motherId} subjects={subjects} />
      ))}
    </div>
  );
}

// قسم الحفظ المستقل انشال من تبويب «المتابعة والدرجات» (قرار صاحبة التطبيق
// ١٨ سبتمبر) وحلّت محله «ملاحظات المعلم». الحفظ نفسه ما تأثر: يبقى ظاهراً
// بالخطة الأسبوعية بالرئيسية مع علامة الإنجاز وزر التعديل، ويُستخرج من
// الصور كما هو، وتذكيراته شغالة — التبويب كان يكرّر ما هو موجود أصلاً.

// الفترات الدراسية الجاهزة — والأم تقدر تكتب تسمية مدرستها بدلها.
const TERMS = ["الفترة الأولى", "الفترة الثانية", "الفترة الثالثة", "الفترة الرابعة"];

// ملاحظات المعلم من اجتماع أولياء الأمور: الأم تسمع الملاحظة بالاجتماع
// وتكتبها هنا بمادتها وفترتها، فتتجمّع بالفترات وتبيّن تطوّر الطالب على
// مدار السنة بدل ما تضيع بالذاكرة. كلها كتابة يدوية — ما فيه استخراج
// من صورة، فقاعدة «المرفوع يبقى كما هو» ما تخصّها.
function TeacherNotesSection({ child, motherId, subjects }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [term, setTerm] = useState(TERMS[0]);
  const [customTerm, setCustomTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    fetch(`/api/teacher-notes?childId=${child.id}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }
  useEffect(load, [child.id, motherId]);

  const finalSubject = subject === "__other" ? customSubject.trim() : subject;
  const finalTerm = term === "__other" ? customTerm.trim() : term;
  const canSave = !!note.trim() && !!finalSubject && !busy;

  async function save() {
    setBusy(true); setError("");
    const res = await fetch("/api/teacher-notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: child.id, motherId, subject: finalSubject, note: note.trim(), term: finalTerm }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "تعذّر الحفظ");
    else {
      setItems((prev) => [data.item, ...prev]);
      setNote(""); setCustomSubject("");
    }
    setBusy(false);
  }

  async function remove(id) {
    if (!confirm("حذف هذه الملاحظة نهائياً؟")) return;
    const res = await fetch(`/api/teacher-notes/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("تعذّر الحذف، حاولي مرة ثانية."); return; }
    setItems((prev) => prev.filter((it) => it.id !== id));
    setEditing(null);
  }

  async function saveEdit(id, updates) {
    const res = await fetch(`/api/teacher-notes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "تعذّر حفظ التعديلات");
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
    setEditing(null);
  }

  // التجميع بالفترة عشان تقارن الأم فترة بفترة — وهو الهدف من الميزة.
  // الترتيب بتسلسل الفترات (الأولى ← الرابعة) لا بالأحدث، لأن القراءة
  // من فوق لتحت هي نفسها متابعة التطوّر على مدار السنة. الفترات اللي
  // كتبتها الأم بنفسها تجي بعدها بترتيب ظهورها، و«بلا فترة» بالآخر.
  const groups = [];
  for (const it of items) {
    const key = it.term || "بلا فترة";
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, notes: [] }; groups.push(g); }
    g.notes.push(it);
  }
  const rank = (key) => {
    const i = TERMS.indexOf(key);
    if (i !== -1) return i;                 // الفترات الجاهزة بتسلسلها
    if (key === "بلا فترة") return 999;
    return 100;                             // فترة كتبتها الأم
  };
  groups.sort((a, b) => rank(a.key) - rank(b.key));

  const field = { width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", fontSize: 15, background: "white" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <HintBanner id="teacher-notes">
        ملاحظات المعلم للطالب من اجتماع أولياء الأمور — اكتبي كل ملاحظة بمادتها
        وفترتها، وبنهاية السنة تشوفين تطوّر {child.name} فترة بفترة بمكان واحد.
      </HintBanner>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #EEEDE8", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="الملاحظة… مثال: الطالب كثير الكلام"
          style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
        />
        <select value={subject} onChange={(e) => setSubject(e.target.value)} style={field}>
          <option value="">اختاري المادة…</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__other">مادة ثانية (اكتبيها)</option>
        </select>
        {subject === "__other" && (
          <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="اسم المادة" style={field} />
        )}
        <select value={term} onChange={(e) => setTerm(e.target.value)} style={field}>
          {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="__other">فترة ثانية (اكتبيها)</option>
        </select>
        {term === "__other" && (
          <input value={customTerm} onChange={(e) => setCustomTerm(e.target.value)} placeholder="اسم الفترة" style={field} />
        )}
        {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: 0, lineHeight: 1.7 }}>{error}</p>}
        <button onClick={save} disabled={!canSave} style={{ width: "100%", padding: 11, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 14, minHeight: 44, opacity: canSave ? 1 : 0.45 }}>
          {busy ? "..." : "حفظ الملاحظة"}
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>...جاري التحميل</p>
      ) : items.length === 0 ? (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0", lineHeight: 1.8 }}>
          ما فيه ملاحظات مسجّلة لـ{child.name} بعد — أول ملاحظة من اجتماع أولياء الأمور تنكتب من فوق.
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 800, color: "#5C4B8C" }}>
              {g.key} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({countLabel(g.notes.length, "ملاحظة", "ملاحظتان", "ملاحظات")})</span>
            </p>
            {g.notes.map((it) => (
              <button key={it.id} onClick={() => setEditing(it)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, background: "white", border: "1px solid #EEEDE8", textAlign: "right", width: "100%" }}>
                <SubjectIcon subject={it.subject} size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#374151", lineHeight: 1.7 }}>{it.note}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#9CA3AF" }}>
                    {it.subject} · {new Date(it.created_at).toLocaleDateString("ar-KW", { day: "numeric", month: "long" })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ))
      )}

      {editing && (
        <EditTeacherNoteModal
          item={editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function EditTeacherNoteModal({ item, subjects, onClose, onSave, onDelete }) {
  const known = subjects.includes(item.subject);
  const [note, setNote] = useState(item.note);
  const [subject, setSubject] = useState(known ? item.subject : "__other");
  const [customSubject, setCustomSubject] = useState(known ? "" : item.subject);
  const knownTerm = !item.term || TERMS.includes(item.term);
  const [term, setTerm] = useState(knownTerm ? item.term || TERMS[0] : "__other");
  const [customTerm, setCustomTerm] = useState(knownTerm ? "" : item.term);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finalSubject = subject === "__other" ? customSubject.trim() : subject;
  const finalTerm = term === "__other" ? customTerm.trim() : term;
  const field = { width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", fontSize: 15, background: "white" };

  async function submit() {
    setBusy(true); setError("");
    try {
      await onSave(item.id, { note: note.trim(), subject: finalSubject, term: finalTerm });
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", background: "#FAF7F2", borderRadius: "20px 20px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", flexDirection: "column", gap: 9, maxHeight: "88%", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>تعديل الملاحظة</p>
          <button onClick={onClose} style={{ background: "none", fontSize: 20, color: "#9CA3AF", padding: "0 4px" }}>×</button>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...field, resize: "vertical", lineHeight: 1.7 }} />
        <select value={subject} onChange={(e) => setSubject(e.target.value)} style={field}>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__other">مادة ثانية (اكتبيها)</option>
        </select>
        {subject === "__other" && <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="اسم المادة" style={field} />}
        <select value={term} onChange={(e) => setTerm(e.target.value)} style={field}>
          {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="__other">فترة ثانية (اكتبيها)</option>
        </select>
        {term === "__other" && <input value={customTerm} onChange={(e) => setCustomTerm(e.target.value)} placeholder="اسم الفترة" style={field} />}
        {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: 0, lineHeight: 1.7 }}>{error}</p>}
        <button onClick={submit} disabled={busy || !note.trim() || !finalSubject} style={{ width: "100%", padding: 12, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 14.5, minHeight: 46, opacity: busy || !note.trim() || !finalSubject ? 0.5 : 1 }}>
          {busy ? "..." : "حفظ التعديلات"}
        </button>
        <button onClick={() => onDelete(item.id)} style={{ width: "100%", padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
          حذف الملاحظة
        </button>
      </div>
    </div>
  );
}

function GradesSection({ child, motherId, subjects = [] }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  // المادة قائمة من جدول حصص الطالب/ة + خيار كتابة مادة ثانية، والفترة
  // بنفس تفاصيل ملاحظات المعلم (قرار صاحبة التطبيق ١٨ سبتمبر).
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [period, setPeriod] = useState(TERMS[0]);
  const [customPeriod, setCustomPeriod] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [examName, setExamName] = useState("");
  const [saving, setSaving] = useState(false);

  const finalSubject = subject === "__other" ? customSubject.trim() : subject;
  const finalPeriod = period === "__other" ? customPeriod.trim() : period;
  const canAdd = !!finalSubject && !!score && !!maxScore && !saving;

  function load() {
    setLoading(true);
    fetch(`/api/grades?childId=${child.id}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setGrades(data.grades || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [child.id, motherId]);

  async function handleAdd() {
    if (!canAdd) return;
    setSaving(true);
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motherId, childId: child.id, subject: finalSubject, score, maxScore, examName, period: finalPeriod }),
    });
    if (res.ok) {
      setSubject(""); setCustomSubject(""); setScore(""); setMaxScore(""); setExamName("");
      setShowAdd(false);
      load();
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("حذف هذه الدرجة؟")) return;
    setGrades((prev) => prev.filter((g) => g.id !== id));
    await fetch(`/api/grades/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
  }

  const bySubject = {};
  for (const g of grades) {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(g);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button onClick={() => setShowAdd((s) => !s)} style={{ padding: 10, borderRadius: 12, background: "#F1EFFA", color: "#5C4B8C", fontWeight: 700, fontSize: 13 }}>
        {showAdd ? "إلغاء" : "+ إضافة درجة"}
      </button>

      {showAdd && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, background: "#FAFAF8", border: "1px solid #EEEDE8" }}>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16, background: "white" }}>
            <option value="">اختاري المادة…</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__other">مادة ثانية (اكتبيها)</option>
          </select>
          {subject === "__other" && (
            <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="اسم المادة" style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
          )}
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16, background: "white" }}>
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="__other">فترة ثانية (اكتبيها)</option>
          </select>
          {period === "__other" && (
            <input value={customPeriod} onChange={(e) => setCustomPeriod(e.target.value)} placeholder="اسم الفترة" style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="الدرجة" type="number" style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
            <span style={{ alignSelf: "center", color: "#9CA3AF" }}>من</span>
            <input value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="الدرجة الكلية" type="number" style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
          </div>
          <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="اسم الاختبار (اختياري)" style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
          <button disabled={!canAdd} onClick={handleAdd} style={{ padding: 10, borderRadius: 10, background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 13, opacity: canAdd ? 1 : 0.5 }}>
            {saving ? "جاري الحفظ..." : "حفظ الدرجة"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>...جاري التحميل</p>
      ) : Object.keys(bySubject).length === 0 ? (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>ما فيه درجات مسجّلة بعد لـ{child.name}</p>
      ) : (
        Object.entries(bySubject).map(([subj, entries]) => {
          const totalScore = entries.reduce((s, e) => s + Number(e.score), 0);
          const totalMax = entries.reduce((s, e) => s + Number(e.max_score), 0);
          const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
          return (
            <div key={subj} style={{ border: "1px solid #EEEDE8", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{subj}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#5C4B8C" }}>{pct}% ({totalScore}/{totalMax})</span>
              </div>
              {entries.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12.5, color: "#6B7280" }}>
                  <span>
                    {e.exam_name || "اختبار"} — {e.score}/{e.max_score}
                    {e.period && <span style={{ color: "#9CA3AF" }}> · {e.period}</span>}
                  </span>
                  <button onClick={() => handleDelete(e.id)} style={{ background: "none", color: "#D1785A", fontSize: 12 }}>حذف</button>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function ResetYearButton({ motherId, onDone, ios }) {
  const [busy, setBusy] = useState(false);

  async function handleReset() {
    if (!confirm("مسح كل بيانات هذا العام الدراسي (الواجبات، المتطلبات، جدول الحصص، الحفظ، الدرجات، ملاحظات المعلم، ومحادثات المعلم الذكي) لكل الأطفال؟ هذا الإجراء نهائي ولا يمكن التراجع عنه. ملفات الأطفال نفسها تبقى، بس لازم تحدّثين الصف يدوياً بعدها.")) return;
    if (!confirm("تأكيد أخير: راح تنمسح البيانات نهائياً. متأكدة؟")) return;
    setBusy(true);
    const res = await fetch("/api/reset-year", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
    setBusy(false);
    if (res.ok) {
      alert("تم مسح بيانات العام الدراسي ✅");
      onDone();
    } else {
      alert("تعذّر المسح، حاولي مرة ثانية.");
    }
  }

  if (ios) {
    return (
      <button onClick={handleReset} disabled={busy} className="ios-row ios-btn-destructive" style={{ opacity: busy ? 0.5 : 1 }}>
        مسح بيانات العام الدراسي
      </button>
    );
  }

  return (
    <button onClick={handleReset} disabled={busy} style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "none", color: "#B91C1C", fontWeight: 700, fontSize: 12.5, border: "1px solid #FECACA", opacity: busy ? 0.6 : 1 }}>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <TileIcon name="trash" size={22} />
        مسح بيانات العام الدراسي (نهاية السنة)
      </span>
    </button>
  );
}

// اختبار إشعارات الجهاز من داخل التطبيق. نعرض سبب الفشل كما جاء من آبل بدل
// «تعذّر الإرسال» — لأن كل سبب له علاج مختلف تماماً، وبدونه التشخيص تخمين.
function PushTestRow() {
  const [state, setState] = useState("idle");
  const [detail, setDetail] = useState("");

  async function run() {
    setState("sending");
    setDetail("");
    try {
      if (!isNativeApp()) {
        setState("failed");
        setDetail("إشعارات الجهاز تشتغل داخل تطبيق دفتري على الآيفون فقط، مو من المتصفح.");
        return;
      }

      // نسجّل الجهاز أولاً ونعرض سبب فشل التسجيل بالتحديد. الرسالة العامة
      // «ما فيه جهاز مسجّل» تضلّل: أسبابها مختلفة تماماً وكل واحد له علاج،
      // وأشيعها إن التطبيق المثبّت ما فيه إضافة الإشعارات أصلاً — لأن كود
      // الويب يتحدّث فوراً من السيرفر بينما الإضافات الأصلية تحتاج إعادة بناء.
      const { registerPushDevice } = await import("@/lib/native");
      const reg = await registerPushDevice({ force: true });
      if (!reg.ok) {
        // حتى لو التسجيل فشل، ننادي السيرفر عشان نعرف إذا مفاتيح APNs
        // مضبوطة عنده — يفرّق بين «ينقص بناء» و«ينقص إعداد بالسيرفر»،
        // وبدون هالتفريق ما نعرف أي الطرفين نصلح.
        let probe = {};
        let httpStatus = 0;
        try {
          const pr = await fetch("/api/push/test", { method: "POST" });
          httpStatus = pr.status;
          probe = await pr.json().catch(() => ({}));
        } catch {
          httpStatus = -1;
        }
        // نعرض نتيجة الفحص دائماً — حتى لما يفشل الفحص نفسه. الصمت هنا
        // يخلينا نخمّن: هل السيرفر سليم؟ ولا الطلب ما وصل أصلاً؟
        const serverPart = {
          config: " والمفاتيح ناقصة بالسيرفر كمان.",
          registration: " (مفاتيح السيرفر سليمة ✅)",
          send: " (السيرفر جاهز ✅)",
        }[probe.stage] || ` (تعذّر فحص السيرفر — HTTP ${httpStatus})`;

        const why = {
          // ولي أمر عادي ما يفهم أوامر البناء — نقول له اللي يقدر يسويه فعلاً.
          unavailable: "نسخة التطبيق المثبّتة ما فيها دعم الإشعارات. حدّثه من آب ستور.",
          denied: "إذن الإشعارات مرفوض. فعّله من إعدادات الجهاز ← دفتري ← الإشعارات.",
          no_token: "آبل ما أعطت الجهاز رمزاً. تأكد إن خاصية Push Notifications مفعّلة على معرّف التطبيق بحساب المطوّر.",
          server: "الجهاز استلم رمزاً بس السيرفر رفض حفظه.",
        }[reg.reason];
        setState("failed");
        setDetail((why || `فشل التسجيل: ${reg.reason}`) + serverPart);
        return;
      }

      // إشعار يوصل والتطبيق مفتوح قدامك ما يظهر كبانر على iOS — فنطلب من
      // السيرفر مهلة قبل الإرسال الفعلي بدل التأخير هنا بالمتصفح: لو قفلتِ
      // الشاشة، iOS يوقف تنفيذ الجافاسكربت غالباً، فأي تأخير هنا يعني الطلب
      // نفسه ما يُرسل بعد القفل. الطلب يبدأ الحين، والانتظار يصير بالسيرفر
      // بغض النظر عن حالة الشاشة.
      const DELAY = 5;
      setState("waiting");
      const countdown = setInterval(() => {
        setDetail((d) => {
          const left = Math.max(parseInt(d) || DELAY, 1) - 1;
          return left > 0 ? `اقفلي شاشتك الحين — الإشعار بيوصل خلال ${left}...` : "";
        });
      }, 1000);
      setDetail(`اقفلي شاشتك الحين — الإشعار بيوصل خلال ${DELAY}...`);

      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delaySeconds: DELAY }),
      });
      clearInterval(countdown);
      setState("sending");
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setState("sent");
        setDetail(`أُرسل لـ${data.delivered} من ${data.devices} جهاز. لو ما وصل والشاشة مقفلة، السيرفر نجح لكن آبل ما سلّمته — راسليني.`);
      } else {
        setState("failed");
        setDetail(data.error || data.results?.map((r) => r.reason).filter(Boolean).join("، ") || "فشل غير معروف");
      }
    } catch (e) {
      setState("failed");
      setDetail(e?.message || "تعذّر تشغيل الاختبار");
    }
  }

  return (
    <>
      <button onClick={run} disabled={state === "sending" || state === "waiting"} className="ios-row" style={{ color: "#7B68C4" }}>
        <span>اختبار الإشعارات</span>
        <span className="ios-row-value">
          {state === "sending" || state === "waiting" ? "..." : state === "sent" ? "✅" : state === "failed" ? "⚠️" : "›"}
        </span>
      </button>
      {detail && (
        <div className="ios-row" style={{ fontSize: 12, color: state === "sent" ? "#2F6E56" : state === "waiting" ? "#8C6027" : "#B91C1C", lineHeight: 1.6 }}>
          {detail}
        </div>
      )}
    </>
  );
}

// حذف الحساب نهائياً — مطلوب من آبل لأي تطبيق فيه إنشاء حساب.
// ملخّص حالة الاشتراك بصفحة الحساب. قبله كان فيه صف «اشتراك دفتري» وحده بلا
// أي معلومة — ولي الأمر ما يعرف هل هو مشترك أصلاً، ولا كم طالباً تغطي باقته،
// ولا متى تنتهي، إلا لو دخل شاشة الباقات وخمّن. نعرضها هنا مباشرة.
function appAccessSummary(access) {
  if (!access) return null; // لسا نحمّل
  const dateAr = (d) => new Date(d).toLocaleDateString("ar-KW", { day: "numeric", month: "long", year: "numeric" });
  const sub = access.subscription;
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // بتوقيت الكويت
  const active = sub?.plan === "active" && sub?.period_end && sub.period_end >= today;

  if (active) {
    const n = sub.max_students;
    return {
      status: "فعّال ✓",
      color: "#166534",
      bg: "#F0FDF4",
      detail: `يغطي ${arabicDigits(n)} ${n === 1 ? "طالب/ة" : "طلاب"} · حتى ${dateAr(sub.period_end)}`,
      action: "تغيير الباقة",
    };
  }
  if (sub?.period_end) {
    return { status: "منتهي", color: "#B91C1C", bg: "#FEF2F2", detail: `انتهى بتاريخ ${dateAr(sub.period_end)}`, action: "جدّدي اشتراكك" };
  }
  if (access.phase === "enforced") {
    return { status: "غير مفعّل", color: "#B91C1C", bg: "#FEF2F2", detail: "اختاري باقة حسب عدد أبنائك", action: "اشتركي الآن" };
  }
  // الميزة معطّلة أصلاً — ما فيه حالة اشتراك نعرضها، بس نخلي الباقات متاحة.
  return { status: "", color: "#5C4B8C", bg: "#F1EFFA", detail: "", action: "عرض الباقات" };
}

// تحديد أو تغيير الرقم السري من صفحة الحساب — لمن تخطّاها بالتسجيل، أو
// حابة تغيّره. fetch العادي (مو fetch(...) اليدوي) لأن installAuthFetch
// يرفق التوكن تلقائياً هنا (بخلاف شاشة التسجيل قبل تسجيل الدخول).
function PasswordSetting({ ios }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    if (password.trim().length < 4) { setError("الرقم السري لازم يكون ٤ أحرف/أرقام على الأقل"); return; }
    if (password !== password2) { setError("الرقمان غير متطابقين"); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "تعذّر الحفظ");
      setSaved(true);
      setPassword("");
      setPassword2("");
      setTimeout(() => { setOpen(false); setSaved(false); }, 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const rowStyle = ios
    ? { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", background: "none", color: "#000" }
    : { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", width: "100%", background: "none", color: "#374151" };
  const inputStyle = { width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", fontSize: 15, marginBottom: 8, direction: "ltr", textAlign: "center" };

  return (
    <div style={ios ? undefined : { borderBottom: "1px solid #F5F3EF" }}>
      <button onClick={() => setOpen((v) => !v)} className={ios ? "ios-row" : undefined} style={rowStyle}>
        <span style={{ fontSize: ios ? 17 : 14.5, fontWeight: ios ? 400 : 700, display: "flex", alignItems: "center", gap: 9 }}>
          {!ios && <TileIcon name="lock" size={25} />}
          الرقم السري للدخول
        </span>
        <span style={{ color: ios ? "#C7C2D4" : "#C7C2D4", fontSize: 16 }}>{open ? "︿" : "‹"}</span>
      </button>
      {open && (
        <div style={{ padding: ios ? "0 16px 14px" : "0 18px 16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9CA3AF", lineHeight: 1.7 }}>
            دخول قادم بموبايلك ورقمك السري بلا كود، حتى من جهاز جديد.
          </p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رقم سري جديد" autoComplete="new-password" style={inputStyle} />
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="أعيدي كتابته" autoComplete="new-password" style={inputStyle} />
          <button onClick={save} disabled={busy} style={{ width: "100%", padding: 11, borderRadius: 12, background: saved ? "#22C55E" : "#B7A6E8", color: "white", fontWeight: 700, fontSize: 13.5, minHeight: 42, opacity: busy ? 0.6 : 1 }}>
            {saved ? "تم الحفظ ✓" : busy ? "جاري الحفظ..." : "حفظ"}
          </button>
          {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: "8px 0 0", lineHeight: 1.7 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

// إدارة العائلة: اشتراك واحد يغطي ولي أمر أساسي + ولي أمر ثانٍ. الأساسي
// يدعو برقم جوال، والثاني يقبل من حسابه هو — بلا اشتراك جديد ولا دخول
// بحساب غيره. الحد وليّان فقط، مفروض بقاعدة البيانات كذلك.
function FamilySetting({ ios }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => fetch("/api/family").then((r) => r.json()).then(setData).catch(() => setData({ parents: [] }));
  useEffect(() => { if (open && !data) load(); }, [open]);

  async function invite() {
    setBusy(true); setError("");
    const res = await fetch("/api/family", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setError(d.error || "تعذّر إرسال الدعوة");
    else { setPhone(""); await load(); }
    setBusy(false);
  }

  async function remove(parentId) {
    const msg = parentId ? "إخراج ولي الأمر الثاني؟ راح ينقطع وصوله لبيانات العائلة فوراً." : "إلغاء الدعوة؟";
    if (!confirm(msg)) return;
    setBusy(true); setError("");
    const res = await fetch("/api/family", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || "تعذّرت العملية");
    else await load();
    setBusy(false);
  }

  const rowStyle = ios
    ? { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", background: "none", color: "#000" }
    : { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", width: "100%", background: "none", color: "#374151" };

  return (
    <div style={ios ? undefined : { borderBottom: "1px solid #F5F3EF" }}>
      <button onClick={() => setOpen((v) => !v)} className={ios ? "ios-row" : undefined} style={rowStyle}>
        <span style={{ fontSize: ios ? 17 : 14.5, fontWeight: ios ? 400 : 700, display: "flex", alignItems: "center", gap: 9 }}>
          {!ios && <TileIcon name="gift" size={25} />}
          العائلة (مشاركة الاشتراك)
        </span>
        <span style={{ color: "#C7C2D4", fontSize: 16 }}>{open ? "︿" : "‹"}</span>
      </button>
      {open && (
        <div style={{ padding: ios ? "0 16px 14px" : "0 18px 16px" }}>
          {!data && <p style={{ fontSize: 12.5, color: "#9CA3AF" }}>...جاري التحميل</p>}
          {data && (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9CA3AF", lineHeight: 1.8 }}>
                اشتراكك يغطي ولي أمر ثاني (الأب) — يدخل بحسابه ورقمه هو، ويشوف نفس الأبناء والواجبات ويوصله نفس التذكيرات.
              </p>

              {(data.parents || []).map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: "1px solid #F3F2EE" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{p.name} {p.isMe && <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(أنت)</span>}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>{p.role === "primary" ? "صاحب الاشتراك" : "ولي أمر ثاني"}</p>
                  </div>
                  {data.role === "primary" && p.role === "secondary" && (
                    <button onClick={() => remove(p.id)} disabled={busy} style={{ background: "#FEF2F2", color: "#B91C1C", fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 9 }}>إخراج</button>
                  )}
                </div>
              ))}

              {data.invite && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: "1px solid #F3F2EE" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#8C6027" }}>دعوة معلّقة — {data.invite.phone}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>تظهر له بحسابه أول ما يدخل برقمه</p>
                  </div>
                  <button onClick={() => remove(null)} disabled={busy} style={{ background: "#F3F4F6", color: "#6B7280", fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 9 }}>إلغاء</button>
                </div>
              )}

              {data.canInvite && (
                <div style={{ marginTop: 10 }}>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم موبايل ولي الأمر الثاني" inputMode="numeric"
                    style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", fontSize: 15, marginBottom: 8, direction: "ltr", textAlign: "center" }} />
                  <button onClick={invite} disabled={busy || phone.trim().length < 8} style={{ width: "100%", padding: 11, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 13.5, minHeight: 42, opacity: busy || phone.trim().length < 8 ? 0.5 : 1 }}>
                    {busy ? "..." : "إرسال الدعوة"}
                  </button>
                </div>
              )}

              {data.role === "secondary" && (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>أنت ولي أمر ثاني بهذي العائلة — الاشتراك وإدارة العائلة عند صاحب الاشتراك.</p>
              )}

              {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: "8px 0 0", lineHeight: 1.7 }}>{error}</p>}

              {(data.activity || []).length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: "#6B7280" }}>آخر النشاط</p>
                  {data.activity.slice(0, 8).map((a, i) => (
                    <p key={i} style={{ margin: "0 0 4px", fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.8 }}>
                      {a.actor_name || "ولي أمر"} {a.action}{a.entity ? `: ${a.entity}` : ""}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// دعوة وصلت لرقمك: تظهر أول ما تدخل، وما تنضم إلا بقبولك أنت.
function FamilyInviteBanner({ onJoined }) {
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/family/invite").then((r) => r.json()).then((d) => setInvite(d.invite || null)).catch(() => {});
  }, []);

  async function answer(accept) {
    setBusy(true); setError("");
    const res = await fetch("/api/family/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "تعذّرت العملية"); setBusy(false); return; }
    setInvite(null);
    if (d.joined) onJoined();
  }

  if (!invite) return null;
  return (
    <div style={{ margin: "12px 16px 0", background: "#F1EFFA", border: "1px solid #D9D2F2", borderRadius: 16, padding: 14 }}>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#5C4B8C", lineHeight: 1.8 }}>
        {invite.fromName} يدعوك تنضم لعائلته بدفتري
      </p>
      <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "#6B7280", lineHeight: 1.8 }}>
        راح تشوف نفس الأبناء والواجبات والاختبارات، ويوصلك نفس التذكيرات — بحسابك هذا وبلا اشتراك جديد.
      </p>
      {error && <p style={{ color: "#B91C1C", fontSize: 12, margin: "0 0 8px", lineHeight: 1.7 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => answer(true)} disabled={busy} style={{ flex: 2, padding: 11, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 14, minHeight: 44, opacity: busy ? 0.6 : 1 }}>
          {busy ? "..." : "انضمام"}
        </button>
        <button onClick={() => answer(false)} disabled={busy} style={{ flex: 1, padding: 11, borderRadius: 12, background: "white", color: "#6B7280", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
          رفض
        </button>
      </div>
    </div>
  );
}

function ProfileView({ mother, childrenCount, onClose, onLogout, onAccountDeleted, onDataCleared, onManageSubscription }) {
  const phone = (mother.phone || "").replace(/^\+965/, "");
  const [native, setNative] = useState(false);
  const [access, setAccess] = useState(null);
  useEffect(() => setNative(isNativeApp()), []);

  useEffect(() => {
    fetch("/api/subscription/app-access/status")
      .then((r) => r.json())
      .then(setAccess)
      .catch(() => setAccess({ phase: "off" }));
  }, []);

  const plan = appAccessSummary(access);

  const childrenLabel =
    childrenCount === 0 ? "ما فيه طلاب مسجّلين" : childrenCount === 1 ? "طالب/ة واحد مسجّل" : `${childrenCount} طلاب مسجّلين`;

  if (native) {
    return (
      <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#F2F2F7", display: "flex", flexDirection: "column" }}>
        <div className="ios-navbar">
          <div className="ios-navbar-row" style={{ justifyContent: "flex-start" }}>
            <button onClick={onClose} className="ios-navbar-back">
              <span style={{ fontSize: 22, lineHeight: 1 }}>›</span>
              <span>رجوع</span>
            </button>
          </div>
          <div className="ios-navbar-titles">
            <h1 className="ios-large-title">حسابي</h1>
          </div>
        </div>

        <div className="app-scroll" style={{ flex: 1, padding: "18px 16px calc(env(safe-area-inset-bottom) + 24px)", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#E5E1F5", color: "#7B68C4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 500, margin: "0 auto 10px" }}>
              {mother.name?.[0] || "؟"}
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{mother.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 15, color: "#8E8E93", direction: "ltr" }}>+965 {phone}</p>
            <p style={{ margin: "2px 0 0", fontSize: 15, color: "#8E8E93" }}>{childrenLabel}</p>
          </div>

          <div>
            <p className="ios-group-header">الاشتراك</p>
            <div className="ios-group">
              <button onClick={onManageSubscription} className="ios-row">
                <span>اشتراك دفتري</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span className="ios-row-value" style={{ color: plan?.color }}>{plan ? plan.status : "..."}</span>
                  <span className="ios-chevron">›</span>
                </span>
              </button>
              {plan?.detail && (
                <div className="ios-row" style={{ color: "#8E8E93", fontSize: 14 }}>
                  <span>{plan.detail}</span>
                </div>
              )}
              {plan && (
                <button onClick={onManageSubscription} className="ios-row" style={{ color: "#7B68C4" }}>
                  <span>{plan.action}</span>
                  <span className="ios-chevron">›</span>
                </button>
              )}
            </div>
          </div>

          <div className="ios-group">
            {/* داخل التطبيق نفتحها بنفس النافذة — target="_blank" ما يشتغل بـ WebView
                وصفحة الخصوصية فيها رابط رجوع للتطبيق. */}
            <a href="/privacy" target={native ? undefined : "_blank"} rel="noreferrer" className="ios-row">
              <span>سياسة الخصوصية</span>
              <span className="ios-chevron">›</span>
            </a>
            {/* شعار القناة بدل اسمها بين قوسين — الأيقونة تعرّف بنفسها */}
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="ios-row">
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <TileIcon name="instagram" size={25} />
                تواصل معانا
              </span>
              <span className="ios-chevron">›</span>
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="ios-row">
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <TileIcon name="whatsapp" size={25} />
                تواصل معانا
              </span>
              <span className="ios-chevron">›</span>
            </a>
            <PushTestRow />
            <div className="ios-row">
              <span>الإصدار</span>
              <span className="ios-row-value" style={{ direction: "ltr", fontVariantNumeric: "tabular-nums" }}>{APP_VERSION}</span>
            </div>
          </div>

          <div className="ios-group">
            <PasswordSetting ios />
            <FamilySetting ios />
          </div>

          <div className="ios-group">
            <button onClick={onLogout} className="ios-row" style={{ color: "#7B68C4" }}>تسجيل الخروج</button>
          </div>

          <div>
            <p className="ios-group-header">منطقة الحذف</p>
            <div className="ios-group">
              <ResetYearButton motherId={mother.id} onDone={onDataCleared} ios />
            </div>
            <div style={{ height: 22 }} />
            <DeleteAccountButton mother={mother} onDeleted={onAccountDeleted} ios />
          </div>

          <p style={{ textAlign: "center", color: "#8E8E93", fontSize: 13, margin: 0 }}>Copyright © Reemora.app 2026</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#FAF7F2", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, background: "white", padding: "calc(env(safe-area-inset-top) + 12px) 16px 14px", borderBottom: "1px solid #F0EEE8", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", fontSize: 20, width: 36, height: 36 }}>←</button>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>حسابي</p>
      </div>

      <div className="app-scroll" style={{ flex: 1, padding: "16px 16px calc(env(safe-area-inset-bottom) + 20px)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "white", borderRadius: 18, padding: "22px 18px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#F1EFFA", border: "3px solid #DFD8F5", color: "#5C4B8C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, margin: "0 auto 12px" }}>
            {mother.name?.[0] || "؟"}
          </div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#374151" }}>{mother.name}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#9CA3AF", direction: "ltr" }}>+965 {phone}</p>
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#B7A6E8", fontWeight: 700 }}>{childrenLabel}</p>
        </div>

        <div style={{ background: "white", borderRadius: 18, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,.05)", display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: "#374151", display: "flex", alignItems: "center", gap: 9 }}>
              <TileIcon name="card" size={25} />
              اشتراك دفتري
            </span>
            {plan?.status && (
              <span style={{ background: plan.bg, color: plan.color, fontSize: 12, fontWeight: 800, padding: "5px 11px", borderRadius: 999, flexShrink: 0 }}>{plan.status}</span>
            )}
          </div>
          {plan?.detail && <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.7 }}>{plan.detail}</p>}
          <button
            onClick={onManageSubscription}
            style={{ background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 14, padding: "11px 16px", borderRadius: 12, width: "100%", minHeight: 44 }}
          >
            {plan ? plan.action : "..."}
          </button>
        </div>

        <div style={{ background: "white", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <a href="/privacy" target={native ? undefined : "_blank"} rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", textDecoration: "none", color: "#374151", borderBottom: "1px solid #F5F3EF" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 9 }}>
              <TileIcon name="lock" size={25} />
              سياسة الخصوصية
            </span>
            <span style={{ color: "#C7C2D4", fontSize: 16 }}>‹</span>
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", textDecoration: "none", color: "#374151", borderBottom: "1px solid #F5F3EF" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 9 }}>
              <TileIcon name="instagram" size={25} />
              تواصل معانا
            </span>
            <span style={{ color: "#C7C2D4", fontSize: 16 }}>‹</span>
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", textDecoration: "none", color: "#374151", borderBottom: "1px solid #F5F3EF" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 9 }}>
              <TileIcon name="whatsapp" size={25} />
              تواصل معانا
            </span>
            <span style={{ color: "#C7C2D4", fontSize: 16 }}>‹</span>
          </a>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "#374151" }}>الإصدار</span>
            <span style={{ fontSize: 13.5, color: "#9CA3AF", direction: "ltr", fontVariantNumeric: "tabular-nums" }}>{APP_VERSION}</span>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <PasswordSetting />
          <FamilySetting />
        </div>

        <button onClick={onLogout} style={{ background: "white", borderRadius: 18, padding: "15px 18px", textAlign: "right", fontSize: 14.5, fontWeight: 700, color: "#374151", boxShadow: "0 1px 3px rgba(0,0,0,.05)", width: "100%" }}>
          ↩︎ تسجيل الخروج
        </button>

        <div style={{ marginTop: 6 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#B91C1C", paddingInlineStart: 4 }}>منطقة الحذف</p>
          <ResetYearButton motherId={mother.id} onDone={onDataCleared} />
          <div style={{ height: 10 }} />
          <DeleteAccountButton mother={mother} onDeleted={onAccountDeleted} />
        </div>

        <p style={{ textAlign: "center", color: "#B7B2C4", fontSize: 11.5, margin: "14px 0 0" }}>Copyright © Reemora.app 2026</p>
      </div>
    </div>
  );
}

function DeleteAccountButton({ mother, onDeleted, ios }) {
  const [step, setStep] = useState("idle");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const lastEight = (mother.phone || "").replace(/[^0-9]/g, "").slice(-8);
  const canDelete = confirmPhone.replace(/[^0-9]/g, "") === lastEight;

  async function handleDelete() {
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motherId: mother.id, phone: confirmPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر حذف الحساب");
      onDeleted();
    } catch (err) {
      setErrorMsg(err.message);
      setBusy(false);
    }
  }

  if (step === "idle") {
    if (ios) {
      return (
        <div className="ios-group">
          <button onClick={() => setStep("confirm")} className="ios-row ios-btn-destructive">حذف الحساب نهائياً</button>
        </div>
      );
    }
    return (
      <button onClick={() => setStep("confirm")} style={{ marginTop: 4, padding: 10, borderRadius: 12, background: "none", color: "#9CA3AF", fontWeight: 700, fontSize: 12.5 }}>
        حذف الحساب نهائياً
      </button>
    );
  }

  return (
    <div style={{ marginTop: 4, padding: 14, borderRadius: 12, border: "1px solid #FECACA", background: "#FEF2F2" }}>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#B91C1C" }}>حذف الحساب نهائياً</p>
      <p style={{ margin: "6px 0 10px", fontSize: 12.5, lineHeight: 1.75, color: "#7F1D1D" }}>
        سيُحذف حسابك وكل بيانات أبنائك (الواجبات، المتطلبات، الجدول، الحفظ، الدرجات، ملاحظات المعلم، ومحادثات المعلم الذكي) نهائياً
        وبدون إمكانية استرجاع. لتأكيد الحذف، اكتبي رقم موبايلك ({lastEight}):
      </p>
      <input
        value={confirmPhone}
        onChange={(e) => setConfirmPhone(e.target.value)}
        placeholder="XXXXXXXX"
        inputMode="numeric"
        maxLength={8}
        style={{ width: "100%", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 12px", fontSize: 16, marginBottom: 10, background: "white" }}
      />
      {errorMsg && <p style={{ margin: "0 0 8px", fontSize: 12, color: "#B91C1C" }}>{errorMsg}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={!canDelete || busy}
          onClick={handleDelete}
          style={{ flex: 1, padding: 11, borderRadius: 10, background: "#B91C1C", color: "white", fontWeight: 800, fontSize: 13, opacity: !canDelete || busy ? 0.45 : 1 }}
        >
          {busy ? "جاري الحذف..." : "تأكيد الحذف النهائي"}
        </button>
        <button onClick={() => { setStep("idle"); setConfirmPhone(""); setErrorMsg(""); }} style={{ flex: 1, padding: 11, borderRadius: 10, background: "white", color: "#6B7280", fontWeight: 700, fontSize: 13, border: "1px solid #E5E7EB" }}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
