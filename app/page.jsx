"use client";

import { useState, useEffect, useRef } from "react";
import {
  isNativeApp,
  initNative,
  nativePickImage,
  hapticSuccess,
  hapticLight,
  nativeShare,
  nativeSharePdf,
  syncTaskReminders,
  attachPullToRefresh,
} from "@/lib/native";
import { installAuthFetch } from "@/lib/authFetch";

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
const APP_VERSION = "1.0.0";
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const FULL_DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const TYPE_META = {
  "واجب": { icon: "📝", done: "تم" },
  "حفظ": { icon: "📖", done: "تم الحفظ" },
  "اختبار": { icon: "📚", done: "تم المذاكرة" },
  "مشروع": { icon: "🎨", done: "تم" },
};
const TABS = [
  { key: "dashboard", label: "الرئيسية", icon: "🏠" },
  { key: "requirements", label: "المتطلبات", icon: "🎒" },
  { key: "schedule", label: "جدول الحصص", icon: "🗓️" },
  { key: "progress", label: "الحفظ والدرجات", icon: "📖" },
  { key: "teacher", label: "المعلم الذكي", icon: "🎓" },
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
  if (!native) return <>{TYPE_META[type]?.icon || "📝"}</>;
  return <Icon name={map[type] || "homework"} size={size} />;
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

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" });
}


async function resizeToDataUrl(file, maxSize = 900, square = false) {
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
        resolve(canvas.toDataURL("image/jpeg", 0.82));
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

function SubjectIcon({ subject, size = 28 }) {
  const file = getSubjectIconFile(subject);
  if (file) {
    return <img src={`/icons/${file}.png`} alt={subject} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#E5E7EB", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 800, flexShrink: 0 }}>
      {subject?.trim()?.[0] || "؟"}
    </div>
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
  const [requirements, setRequirements] = useState([]);
  const [classSchedule, setClassSchedule] = useState([]);
  const [view, setView] = useState("dashboard");
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showUploadSchedule, setShowUploadSchedule] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [openTask, setOpenTask] = useState(null);
  const [native, setNative] = useState(false);
  const [pull, setPull] = useState(0);
  const scrollRef = useRef(null);

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
    const res = await fetch(`/api/dashboard?motherId=${motherId}`);
    const data = await res.json();
    setChildren(data.children || []);
    setTasks(data.tasks || []);
    setUndatedTasks(data.undatedTasks || []);
    setUpcomingTasks(data.upcomingTasks || []);
    setRequirements(data.requirements || []);
    setClassSchedule(data.classSchedule || []);
    // تذكيرات على الجهاز نفسه — تشتغل تلقائياً وحتى بدون إنترنت داخل تطبيق آبل
    syncTaskReminders([...(data.tasks || []), ...(data.upcomingTasks || [])]);
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

  async function handleMarkDone(taskId) {
    const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر تحديث الواجب، حاولي مرة ثانية."); return; }
    hapticSuccess();
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUndatedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUpcomingTasks((prev) => prev.filter((t) => t.id !== taskId));
    setOpenTask(null);
  }

  async function handleDeleteTask(taskId) {
    if (!confirm("حذف هذا الواجب نهائياً؟")) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId: mother.id }) });
    if (!res.ok) { alert("تعذّر حذف الواجب، حاولي مرة ثانية."); return; }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUndatedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setUpcomingTasks((prev) => prev.filter((t) => t.id !== taskId));
    setOpenTask(null);
  }

  async function handleUpdateTaskDate(taskId, dueDate) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDate, motherId: mother.id }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "تعذّر حفظ التاريخ");
    }
    setOpenTask(null);
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

  if (loading || (mother && !schools)) {
    return (
      <>
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#9CA3AF" }}>...جاري التحميل</div>
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

  const weekTasksFor = (childId) => tasks.filter((t) => t.child_id === childId);
  const undatedTasksFor = (childId) => undatedTasks.filter((t) => t.child_id === childId);
  const upcomingTasksFor = (childId) => upcomingTasks.filter((t) => t.child_id === childId);
  const todayDayName = DAYS[new Date().getDay()];
  const hasPEToday = (childId) => classSchedule.some((s) => s.child_id === childId && s.day === todayDayName && getSubjectIconFile(s.subject) === "pe");

  return (
    <div dir="rtl" className="app-root" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {native ? (
        <div className="ios-navbar" style={{ padding: "calc(env(safe-area-inset-top) + 4px) 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <button onClick={() => setShowProfile(true)} aria-label="حسابي" style={{ background: "none", padding: 0, minHeight: 44, display: "flex", alignItems: "center", flexShrink: 0 }}>
                <img src="/logo.png" alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>مرحباً، {mother.name}</span>
            </div>
            {view === "dashboard" && (
              <button onClick={() => setShowUpload(true)} className="ios-btn-plain" style={{ fontWeight: 600, flexShrink: 0 }}>
                رفع جدول
              </button>
            )}
          </div>
          <h1 className="ios-large-title">{TABS.find((t) => t.key === view)?.label}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 15, color: "#8E8E93", letterSpacing: "-0.01em" }}>
            {new Date().toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      ) : (
        <div style={{ flexShrink: 0, zIndex: 10, background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", padding: "calc(env(safe-area-inset-top) + 10px) 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EEE8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <img src="/logo.png" alt="دفتري" style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
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
            <button onClick={() => setShowProfile(true)} title="حسابي" aria-label="حسابي" style={{ background: "#F3F4F6", color: "#6B7280", fontSize: 18, padding: "10px 12px", borderRadius: 12, minHeight: 40, lineHeight: 1 }}>
              ⚙️
            </button>
          </div>
        </div>
      )}

      <div className="app-scroll" style={{ flex: 1 }} ref={scrollRef}>
        {native && (
          <div className="ios-refresh" style={{ height: pull }}>
            {pull > 8 && <div className="ios-spinner" />}
          </div>
        )}
        {view === "dashboard" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>واجبات هذا الأسبوع</span>
                  <button onClick={() => setShowAddChild(true)} style={{ background: "none", color: "#B7A6E8", fontWeight: 700, fontSize: 13, padding: "8px 4px", minHeight: 36 }}>+ إضافة طالب/ة</button>
                </div>
                {children.map((c) => (
                  <ChildCard key={c.id} child={c} tasks={weekTasksFor(c.id)} undatedTasks={undatedTasksFor(c.id)} upcomingTasks={upcomingTasksFor(c.id)} hasPEToday={hasPEToday(c.id)} onOpenTask={setOpenTask} onEdit={() => setEditingChild(c)} />
                ))}
              </>
            )}
          </div>
        ) : view === "requirements" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              children.map((c) => (
                <RequirementsCard key={c.id} child={c} items={requirements.filter((r) => r.child_id === c.id)} onToggle={handleToggleReq} onDeleteReq={handleDeleteReq} />
              ))
            )}
          </div>
        ) : view === "schedule" ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>جدول الحصص الأسبوعي</span>
                  <button onClick={() => setShowUploadSchedule(true)} style={{ background: "none", color: "#B7A6E8", fontWeight: 700, fontSize: 13, padding: "8px 4px", minHeight: 36 }}>+ رفع/تحديث الجدول</button>
                </div>
                {children.map((c) => (
                  <ScheduleCard key={c.id} child={c} schedule={classSchedule.filter((s) => s.child_id === c.id)} onUpload={() => setShowUploadSchedule(true)} />
                ))}
              </>
            )}
          </div>
        ) : view === "progress" ? (
          <div style={{ padding: 16 }}>
            {children.length === 0 ? (
              <EmptyState onAdd={() => setShowAddChild(true)} />
            ) : (
              <ProgressView children={children} motherId={mother.id} />
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
              <span style={{ fontSize: 21, lineHeight: 1 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {showAddChild && <AddChildModal schools={schools} nextColorIdx={children.length} onClose={() => setShowAddChild(false)} onSave={handleAddChild} />}
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
          onDone={() => loadAll(mother.id)}
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
          onDone={() => loadAll(mother.id)}
        />
      )}
      {openTask && <TaskModal task={openTask} motherId={mother.id} color={PALETTE[(children.find((c) => c.id === openTask.child_id)?.color_idx || 0) % PALETTE.length]} onClose={() => setOpenTask(null)} onMarkDone={handleMarkDone} onDelete={handleDeleteTask} onUpdateDate={handleUpdateTaskDate} />}
      {showProfile && (
        <ProfileView
          mother={mother}
          childrenCount={children.length}
          onClose={() => setShowProfile(false)}
          onLogout={handleLogout}
          onAccountDeleted={handleAccountDeleted}
          onDataCleared={() => loadAll(mother.id)}
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
        <p style={{ margin: 0, fontWeight: 800, fontSize: 13 }}>أضيفي دفتري للشاشة الرئيسية</p>
        <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>
          {platform === "ios" ? 'اضغطي زر المشاركة ⬆️ ثم "إضافة إلى الشاشة الرئيسية"' : "وصول أسرع من شاشة جوالك مباشرة"}
        </p>
      </div>
      {platform === "android" && (
        <button onClick={install} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, flexShrink: 0 }}>تثبيت</button>
      )}
      <button onClick={dismiss} style={{ background: "none", color: "#9CA3AF", fontSize: 18, width: 28, height: 28, flexShrink: 0 }}>×</button>
    </div>
  );
}

function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // step: "phone" = إدخال الاسم والرقم، "code" = إدخال كود التحقق
  const [step, setStep] = useState("phone");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const canSubmit = name.trim().length > 1 && /^[0-9]{8}$/.test(phone.trim());

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

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/request-otp", { phone: phone.trim() });
      setStep("code");
      setCode("");
      setResendIn(30);
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
      onDone(data.mother, data.token);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
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
        onResend={sendCode}
        onBack={() => { setStep("phone"); setError(""); }}
      />
    );
  }

  return (
    <div dir="rtl" className="app-scroll" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 24px calc(env(safe-area-inset-bottom) + 14px)", background: "linear-gradient(180deg,#F7F5FC,#F1EFFA)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", maxWidth: 380, margin: "0 auto", paddingBottom: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 132, height: 132, borderRadius: 30, margin: "0 auto 14px", display: "block", boxShadow: "0 6px 18px rgba(183,166,232,.4)" }} />
          <h1 style={{ color: "#5C4B8C", margin: 0, fontSize: 24, fontWeight: 800 }}>دفتري</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>متابعة واجبات واختبارات العيال، بلا تعقيد</p>
        </div>
        <div style={{ background: "white", borderRadius: 20, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>ولي الأمر</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: ريم الفرج" style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 16, marginBottom: 12 }} />
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>رقم الجوال</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <span style={{ background: "#F3F4F6", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "#6B7280" }}>+965</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="XXXXXXXX" maxLength={8} style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px", fontSize: 16 }} />
          </div>
          <button disabled={!canSubmit || busy} onClick={sendCode} style={{ width: "100%", padding: 13, borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 800, fontSize: 15, minHeight: 46, opacity: canSubmit && !busy ? 1 : 0.4 }}>
            {busy ? "جاري الإرسال..." : "متابعة"}
          </button>
          {error && <p style={{ color: "#B91C1C", fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.7 }}>{error}</p>}
          <p style={{ color: "#9CA3AF", fontSize: 11.5, margin: "10px 0 0", lineHeight: 1.7, textAlign: "center" }}>
            بنرسل لك كود تحقق على واتساب للتأكد أن الرقم رقمك
          </p>
        </div>
      </div>
      <div style={{ textAlign: "center", flexShrink: 0, width: "100%", maxWidth: 380, margin: "0 auto" }}>
        <a href="mailto:reemprimeco@gmail.com" style={{ display: "inline-block", padding: "8px 18px", borderRadius: 12, background: "white", color: "#5C4B8C", fontWeight: 700, fontSize: 13, textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
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

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <p style={{ fontWeight: 800, marginBottom: 4 }}>ابدئي بإضافة أول طالب/ة</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 18 }}>سجّلي مدرسته وصفه، وبعدها ارفعي صور الجدول</p>
      <button onClick={onAdd} style={{ background: "#B7A6E8", color: "white", fontWeight: 700, padding: "10px 20px", borderRadius: 12 }}>+ إضافة طالب/ة</button>
    </div>
  );
}

function ChildCard({ child, tasks, undatedTasks, upcomingTasks, hasPEToday, onOpenTask, onEdit }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  // معظم المهام تقع الأحد-الخميس (أيام الدراسة)، لكن تاريخ صريح مستخرج من صورة
  // (ميزة التواريخ البعيدة) ممكن نادراً يصادف جمعة/سبت — نعرضها بدل ما تختفي.
  const byDay = FULL_DAY_NAMES.map((day) => ({
    day,
    items: tasks.filter((t) => FULL_DAY_NAMES[new Date(t.due_date + "T00:00:00").getDay()] === day),
  }));
  return (
    <div>
      {hasPEToday && (
        <div style={{ marginBottom: 6, marginInlineStart: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FDF3E7", color: "#8C6027", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>
            🏃 بدنية اليوم
            {child.pe_uniform_color && (
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: child.pe_uniform_color, border: child.pe_uniform_color === "#FFFFFF" ? "1px solid #E5E7EB" : "1px solid rgba(0,0,0,.15)" }} />
            )}
          </span>
        </div>
      )}
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: color.bg }}>
        <Avatar child={child} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>الصف {child.grade}/{child.section} · {child.school}</p>
        </div>
        <button onClick={onEdit} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>✏️ تعديل</button>
      </div>
      <div style={{ background: "white", padding: 12 }}>
        {tasks.length === 0 && undatedTasks.length === 0 && upcomingTasks.length === 0 && <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا واجبات هذا الأسبوع 🎉</p>}
        {byDay.filter((d) => d.items.length).map(({ day, items }) => (
          <div key={day} style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", margin: "0 0 4px" }}>{day}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {items.map((t) => (
                <button key={t.id} onClick={() => onOpenTask(t)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 10, fontWeight: 700, background: color.soft, color: color.text, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <TypeGlyph type={t.type} native={native} /> {t.subject}
                </button>
              ))}
            </div>
          </div>
        ))}
        {undatedTasks.length > 0 && (
          <div style={{ marginBottom: upcomingTasks.length > 0 ? 8 : 0 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#B45309", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
              {native ? <Icon name="warning" size={13} /> : "⚠️"} مهام بدون تاريخ محدد
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {undatedTasks.map((t) => (
                <button key={t.id} onClick={() => onOpenTask(t)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 10, fontWeight: 700, background: "#FEF3C7", color: "#92400E", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <TypeGlyph type={t.type} native={native} /> {t.subject}
                </button>
              ))}
            </div>
          </div>
        )}
        {upcomingTasks.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#31607C", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
              {native ? <Icon name="calendar" size={13} /> : "📅"} مهام قادمة (بعد هذا الأسبوع)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {upcomingTasks.map((t) => (
                <button key={t.id} onClick={() => onOpenTask(t)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "8px 10px", borderRadius: 10, fontWeight: 700, background: "#EBF4FA", color: "#31607C", textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><TypeGlyph type={t.type} native={native} /> {t.subject}</span>
                  <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>{fmtDate(t.due_date)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function RequirementsCard({ child, items, onToggle, onDeleteReq }) {
  const color = PALETTE[child.color_idx % PALETTE.length];
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${color.soft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: color.bg }}>
        <Avatar child={child} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, color: color.text }}>{child.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>{items.length} طلب</p>
        </div>
      </div>
      <div style={{ background: "white", padding: 12 }}>
        {items.length === 0 && <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا توجد طلبات حالياً</p>}
        {items.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F3F4F6", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: r.bought ? "#9CA3AF" : "#374151", textDecoration: r.bought ? "line-through" : "none" }}>{r.item}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{fmtDate(r.due_date)}</p>
            </div>
            <button onClick={() => onToggle(r.id)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 10, fontWeight: 700, background: r.bought ? "#F0FDF4" : color.soft, color: r.bought ? "#166534" : color.text, flexShrink: 0 }}>
              {r.bought ? "تم الشراء" : "تحديد كمُشترى"}
            </button>
            <button onClick={() => onDeleteReq(r.id)} title="حذف" style={{ background: "none", color: "#B91C1C", opacity: 0.6, fontSize: 16, width: 24, height: 24, flexShrink: 0, padding: 0 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleCard({ child, schedule, onUpload }) {
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
        const shared = await nativeSharePdf(base64, fileName, fileName);
        if (!shared) throw new Error("native share failed");
      } else {
        pdf.save(fileName);
      }
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("تعذّر تصدير PDF، حاولي مرة ثانية.");
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
          <p style={{ margin: 0, fontSize: 12, color: color.text, opacity: 0.75 }}>الصف {child.grade}/{child.section}</p>
        </div>
        <button onClick={onUpload} style={{ background: "none", color: color.text, opacity: 0.7, fontSize: 12, fontWeight: 700, padding: "6px 8px", flexShrink: 0 }}>{schedule.length ? "🔄 تحديث" : "+ رفع"}</button>
      </div>
      <div style={{ background: "white", padding: 12, overflowX: "auto" }}>
        {schedule.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>لا يوجد جدول حصص مضاف بعد</p>
        ) : (
          <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={exportPdf} disabled={exporting} style={{ background: color.soft, color: color.text, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 10, opacity: exporting ? 0.6 : 1 }}>
              {exporting ? "جاري التصدير..." : native ? "📄 تصدير / طباعة" : "📄 تصدير PDF"}
            </button>
          </div>
          <table style={{ borderCollapse: "separate", borderSpacing: 5, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: 4, width: 58 }}></th>
                {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((p) => (
                  <th key={p} style={{ padding: 4, color: "#9CA3AF", fontWeight: 800, minWidth: 86 }}>الحصة {p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => {
                const dayPal = PALETTE[di % PALETTE.length];
                return (
                  <tr key={d}>
                    <td style={{ padding: "8px 6px", textAlign: "center", background: dayPal.soft, color: dayPal.text, borderRadius: 8, fontWeight: 800, whiteSpace: "nowrap" }}>{d}</td>
                    {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((p) => {
                      const entry = grid[`${d}-${p}`];
                      return (
                        <td key={p} style={{ padding: "6px 4px", textAlign: "center", background: dayPal.bg, borderRadius: 8, verticalAlign: entry ? "top" : "middle" }}>
                          {entry ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ position: "relative" }}>
                                <SubjectIcon subject={entry.subject} size={26} />
                                {getSubjectIconFile(entry.subject) === "pe" && child.pe_uniform_color && (
                                  <span style={{ position: "absolute", bottom: -2, left: -2, width: 10, height: 10, borderRadius: "50%", background: child.pe_uniform_color, border: child.pe_uniform_color === "#FFFFFF" ? "1px solid #E5E7EB" : "1px solid rgba(0,0,0,.15)" }} />
                                )}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 800, color: dayPal.text }}>{entry.subject}</span>
                              {entry.teacher && <span style={{ fontSize: 9, color: dayPal.text, opacity: 0.75 }}>{entry.teacher}</span>}
                              {/* dir="ltr" إجباري — بدونه يعكس RTL ترتيب الوقتين فتبان
                                  الحصة كأنها تنتهي قبل ما تبدأ (08:15 - 07:30). */}
                              {(entry.start_time || entry.end_time) && (
                                <span dir="ltr" style={{ fontSize: 8, color: dayPal.text, opacity: 0.55, direction: "ltr" }}>{[entry.start_time, entry.end_time].filter(Boolean).join(" - ")}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: dayPal.text, opacity: 0.4 }}>—</span>
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
          <div ref={printRef} style={{ background: "white", padding: 24, direction: "rtl" }}>
            <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #111", paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: "#111" }}>جدول حصص {child.name}</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#333" }}>{child.school} — الصف {child.grade}/{child.section}</p>
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

function TaskModal({ task, motherId, color, onClose, onMarkDone, onDelete, onUpdateDate }) {
  const meta = TYPE_META[task.type] || TYPE_META["واجب"];
  const [dateValue, setDateValue] = useState(task.due_date || "");
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState("");
  const dateChanged = dateValue !== (task.due_date || "");
  // داخل التطبيق التذكيرات تُجدول تلقائياً على الجهاز (syncTaskReminders)، وملف
  // الـ .ics ما ينفتح أصلاً داخل WebView — فنخفي الزر ونخليه بنسخة الويب بس.
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);

  async function saveDate() {
    setSaving(true);
    setDateError("");
    try {
      await onUpdateDate(task.id, dateValue || null);
    } catch (e) {
      setDateError(e.message || "تعذّر حفظ التاريخ، حاولي مرة ثانية.");
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 420, borderRadius: "24px 24px 0 0", padding: "22px 22px calc(env(safe-area-inset-bottom) + 22px)", maxHeight: "85vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 22, color: color.text }}><TypeGlyph type={task.type} native={typeof window !== "undefined" && isNativeApp()} size={22} /></span>
            <h3 style={{ margin: "4px 0 2px", color: color.text, fontSize: 18 }}>{task.subject}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>{task.type} · {task.due_date ? fmtDate(task.due_date) : "بدون تاريخ محدد"}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", fontSize: 22, color: "#9CA3AF", width: 36, height: 36, flexShrink: 0 }}>×</button>
        </div>
        {task.details && <div style={{ background: color.bg, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>{task.details}</div>}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5 }}>تاريخ الاستحقاق</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 12px", fontSize: 16 }} />
            <button onClick={saveDate} disabled={saving || !dateChanged} style={{ padding: "9px 16px", borderRadius: 12, background: color.solid, color: "white", fontWeight: 700, fontSize: 13, opacity: (saving || !dateChanged) ? 0.5 : 1, flexShrink: 0 }}>
              {saving ? "..." : "حفظ التاريخ"}
            </button>
          </div>
          {dateError && <p style={{ color: "#B91C1C", fontSize: 12, margin: "6px 0 0" }}>{dateError}</p>}
        </div>

        {task.due_date && !dateChanged && !native && (
          <a href={`/api/tasks/${task.id}/ics?motherId=${motherId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: 12, borderRadius: 12, background: color.bg, color: color.text, fontWeight: 700, fontSize: 13, minHeight: 44, marginBottom: 10, textDecoration: "none" }}>
            🔔 إضافة تذكير (قبل يوم)
          </a>
        )}
        <button onClick={() => onMarkDone(task.id)} style={{ width: "100%", padding: 14, borderRadius: 12, background: color.solid, color: "white", fontWeight: 800, fontSize: 15, minHeight: 48, marginBottom: 10 }}>
          {meta.done}
        </button>
        <button onClick={() => onDelete(task.id)} style={{ width: "100%", padding: 12, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, minHeight: 44 }}>
          حذف الواجب (دخل غلط)
        </button>
      </div>
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
                <div style={{ width: 92, height: 92, borderRadius: "50%", border: `2px dashed ${PALETTE[colorIdx].ring}`, background: PALETTE[colorIdx].soft, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE[colorIdx].text }}>📷</div>}
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

function UploadView({ children, motherId, endpoint = "/api/upload-schedule", title = "رفع الجدول", buttonLabel = "تحليل وتوزيع الواجبات", renderSummary, selectChild = true, hint, onClose, onDone }) {
  const [school, setSchool] = useState("");
  const [childId, setChildId] = useState("");
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [native, setNative] = useState(false);
  const fileRef = useRef();
  useEffect(() => setNative(isNativeApp()), []);
  const schoolsOfChildren = [...new Set(children.map((c) => c.school))];
  const childrenOfSchool = school ? children.filter((c) => c.school === school) : [];
  const autoChild = childrenOfSchool.length === 1 ? childrenOfSchool[0] : null;
  const effectiveChildId = autoChild ? autoChild.id : childId;
  const needsChildConfirm = selectChild && childrenOfSchool.length > 1;
  const canRun = school && images.length > 0 && (!selectChild || effectiveChildId);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const urls = await Promise.all(files.map((f) => resizeToDataUrl(f)));
    setImages((prev) => [...prev, ...urls]);
  }

  // داخل تطبيق آبل نفتح الكاميرا/الألبوم الأصلي بدل منتقي الملفات
  async function addFromNative(source) {
    const url = await nativePickImage(source);
    if (url) {
      hapticLight();
      setImages((prev) => [...prev, url]);
    }
  }

  async function run() {
    setStatus("loading");
    try {
      const body = selectChild ? { motherId, childId: effectiveChildId, images } : { motherId, school, images };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data);
      setStatus("done");
      setImages([]);
      onDone();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "");
      setStatus("error");
    }
  }

  return (
    <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 50, background: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, background: "white", padding: "calc(env(safe-area-inset-top) + 12px) 16px 14px", borderBottom: "1px solid #F0EEE8", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", fontSize: 20, width: 36, height: 36 }}>←</button>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{title}</p>
      </div>
      <div className="app-scroll" style={{ padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", flexDirection: "column", gap: 14 }}>
        {hint && (
          <div style={{ background: "#FDF3E7", color: "#8C6027", borderRadius: 12, padding: 12, fontSize: 12.5, fontWeight: 700, lineHeight: 1.6 }}>
            {hint}
          </div>
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
            هذا الجدول لـ {autoChild.name} — الصف {autoChild.grade}/{autoChild.section}
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
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>الصف {c.grade}/{c.section}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {native ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => addFromNative("camera")} style={{ flex: 1, border: "2px dashed #D1D5DB", borderRadius: 16, padding: "22px 12px", textAlign: "center", background: "#FAFAFA", color: "#7B68C4" }}>
              <Icon name="camera" size={28} style={{ display: "block", margin: "0 auto 6px" }} />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: "#1F2937" }}>تصوير الجدول</span>
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
          {status === "loading" ? "جاري التحليل..." : buttonLabel}
        </button>
        {status === "done" && summary && (renderSummary ? renderSummary(summary) : (
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
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: 12, fontSize: 13 }}>
            صار خلل أثناء التحليل، حاولي مرة ثانية.
            {errorMsg && <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8, wordBreak: "break-word" }}>{errorMsg}</div>}
          </div>
        )}
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await resizeToDataUrl(file, 1400, false);
    setImage(url);
  }

  // بتطبيق آبل نصوّر الواجب مباشرة بالكاميرا الأصلية بدل منتقي الملفات
  async function pickImageNative() {
    const url = await nativePickImage("camera");
    if (url) {
      hapticLight();
      setImage(url);
    }
  }

  async function send() {
    if (!input.trim() && !image) return;
    const questionText = input.trim();
    const attachedImage = image;
    setSending(true);
    setErrorMsg("");
    setMessages((prev) => [...prev, { role: "user", content: questionText || "📷 صورة مرفقة", had_image: !!attachedImage, id: `local-${Date.now()}` }]);
    setInput("");
    setImage(null);
    try {
      const res = await fetch("/api/ai-teacher/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motherId, childId, question: questionText, image: attachedImage || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, had_image: false, id: `local-a-${Date.now()}` }]);
    } catch (err) {
      setErrorMsg(err.message || "تعذّر إرسال السؤال، حاولي مرة ثانية.");
    }
    setSending(false);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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

        <div style={{ background: "#FDF3E7", color: "#8C6027", borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 700, lineHeight: 1.6 }}>
          اسألي عن أي واجب أو درس بمنهج {child ? `الصف ${child.grade}` : "ابنك/ابنتك"} — تقدرين ترفقين صورة الواجب مباشرة، والمعلم الذكي يستعين بمواد وزارة التربية الرسمية لما تكون متوفرة.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {historyLoading ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>...جاري التحميل</p>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>ابدئي بسؤال 👋</p>
        ) : (
          messages.map((m, i) => (
            <div key={m.id || i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
              <div style={{
                maxWidth: "82%",
                padding: "10px 13px",
                borderRadius: 14,
                fontSize: 13.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                background: m.role === "user" ? "#B7A6E8" : "#F3F2FA",
                color: m.role === "user" ? "white" : "#374151",
              }}>
                {m.content}
                {m.had_image && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>📷 مع صورة</div>}
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

      <div style={{ flexShrink: 0, borderTop: "1px solid #F0EEE8", background: "white", padding: "10px 16px calc(env(safe-area-inset-bottom) + 10px)", display: "flex", flexDirection: "column", gap: 8 }}>
        {image && (
          <div style={{ position: "relative", width: 64, height: 64, borderRadius: 10, overflow: "hidden" }}>
            <img src={image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => setImage(null)} style={{ position: "absolute", top: 2, left: 2, background: "rgba(0,0,0,.6)", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12 }}>×</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button onClick={() => (native ? pickImageNative() : fileRef.current?.click())} aria-label="إرفاق صورة" style={{ background: "#F3F4F6", borderRadius: 12, width: 44, height: 44, fontSize: 18, flexShrink: 0, color: "#7B68C4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {native ? <Icon name="camera" size={22} /> : "📷"}
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

function ProgressView({ children, motherId }) {
  const [section, setSection] = useState("memorization");
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [native, setNative] = useState(false);
  const child = children.find((c) => c.id === childId) || children[0];

  useEffect(() => setNative(isNativeApp()), []);

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
          <button onClick={() => setSection("memorization")} data-active={section === "memorization"}>الحفظ</button>
          <button onClick={() => setSection("grades")} data-active={section === "grades"}>الدرجات</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setSection("memorization")} style={{ flex: 1, padding: 10, borderRadius: 12, background: section === "memorization" ? "#B7A6E8" : "#F3F4F6", color: section === "memorization" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>🕌 الحفظ</button>
          <button onClick={() => setSection("grades")} style={{ flex: 1, padding: 10, borderRadius: 12, background: section === "grades" ? "#B7A6E8" : "#F3F4F6", color: section === "grades" ? "white" : "#6B7280", fontWeight: 700, fontSize: 13 }}>📊 الدرجات</button>
        </div>
      )}

      {child && (section === "memorization" ? (
        <MemorizationSection child={child} motherId={motherId} />
      ) : (
        <GradesSection child={child} motherId={motherId} />
      ))}
    </div>
  );
}

function MemorizationSection({ child, motherId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/memorization?childId=${child.id}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [child.id, motherId]);

  async function handleToggle(id) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
    const res = await fetch(`/api/memorization/${id}/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motherId }) });
    if (!res.ok) load();
  }

  if (loading) return <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>...جاري التحميل</p>;
  if (items.length === 0) return <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>ما فيه مطلوبات حفظ حالياً لـ{child.name} — تُستخرج تلقائياً من صور الخطة الأسبوعية.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it) => (
        <label key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, background: it.done ? "#F7F7F5" : "white", border: "1px solid #EEEDE8", cursor: "pointer" }}>
          <input type="checkbox" checked={it.done} onChange={() => handleToggle(it.id)} style={{ marginTop: 3, width: 18, height: 18, accentColor: "#B7A6E8", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: it.done ? "#9CA3AF" : "#374151", textDecoration: it.done ? "line-through" : "none", display: "flex", alignItems: "center", gap: 5 }}>
              {typeof window !== "undefined" && isNativeApp() ? <Icon name="memorize" size={14} style={{ color: "#7B68C4" }} /> : it.kind === "حديث" ? "📗" : "📖"} {it.reference}
            </p>
            {it.details && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF" }}>{it.details}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}

function GradesSection({ child, motherId }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [subject, setSubject] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [examName, setExamName] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/grades?childId=${child.id}&motherId=${motherId}`)
      .then((r) => r.json())
      .then((data) => setGrades(data.grades || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [child.id, motherId]);

  async function handleAdd() {
    if (!subject.trim() || !score || !maxScore) return;
    setSaving(true);
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motherId, childId: child.id, subject, score, maxScore, examName }),
    });
    if (res.ok) {
      setSubject(""); setScore(""); setMaxScore(""); setExamName("");
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
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="المادة (مثال: الرياضيات)" style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="الدرجة" type="number" style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
            <span style={{ alignSelf: "center", color: "#9CA3AF" }}>من</span>
            <input value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="الدرجة الكلية" type="number" style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
          </div>
          <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="اسم الاختبار (اختياري)" style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 16 }} />
          <button disabled={saving || !subject.trim() || !score || !maxScore} onClick={handleAdd} style={{ padding: 10, borderRadius: 10, background: "#B7A6E8", color: "white", fontWeight: 700, fontSize: 13, opacity: saving || !subject.trim() || !score || !maxScore ? 0.5 : 1 }}>
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
                  <span>{e.exam_name || "اختبار"} — {e.score}/{e.max_score}</span>
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
    if (!confirm("مسح كل بيانات هذا العام الدراسي (الواجبات، المتطلبات، جدول الحصص، الحفظ، الدرجات، ومحادثات المعلم الذكي) لكل الأطفال؟ هذا الإجراء نهائي ولا يمكن التراجع عنه. ملفات الأطفال نفسها تبقى، بس لازم تحدّثين الصف يدوياً بعدها.")) return;
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
      🗑️ مسح بيانات العام الدراسي (نهاية السنة)
    </button>
  );
}

// حذف الحساب نهائياً — مطلوب من آبل لأي تطبيق فيه إنشاء حساب.
function ProfileView({ mother, childrenCount, onClose, onLogout, onAccountDeleted, onDataCleared }) {
  const phone = (mother.phone || "").replace(/^\+965/, "");
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);

  const childrenLabel =
    childrenCount === 0 ? "ما فيه طلاب مسجّلين" : childrenCount === 1 ? "طالب/ة واحد مسجّل" : `${childrenCount} طلاب مسجّلين`;

  if (native) {
    return (
      <div dir="rtl" className="app-root" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#F2F2F7", display: "flex", flexDirection: "column" }}>
        <div className="ios-navbar" style={{ padding: "calc(env(safe-area-inset-top) + 4px) 16px 8px" }}>
          <button onClick={onClose} className="ios-navbar-back">
            <span style={{ fontSize: 22, lineHeight: 1 }}>›</span>
            <span>رجوع</span>
          </button>
          <h1 className="ios-large-title">حسابي</h1>
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

          <div className="ios-group">
            {/* داخل التطبيق نفتحها بنفس النافذة — target="_blank" ما يشتغل بـ WebView
                وصفحة الخصوصية فيها رابط رجوع للتطبيق. */}
            <a href="/privacy" target={native ? undefined : "_blank"} rel="noreferrer" className="ios-row">
              <span>سياسة الخصوصية</span>
              <span className="ios-chevron">›</span>
            </a>
            <a href="mailto:reemprimeco@gmail.com" className="ios-row">
              <span>تواصلي معنا</span>
              <span className="ios-chevron">›</span>
            </a>
            <div className="ios-row">
              <span>الإصدار</span>
              <span className="ios-row-value" style={{ direction: "ltr", fontVariantNumeric: "tabular-nums" }}>{APP_VERSION}</span>
            </div>
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

        <div style={{ background: "white", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <a href="/privacy" target={native ? undefined : "_blank"} rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", textDecoration: "none", color: "#374151", borderBottom: "1px solid #F5F3EF" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>🔒 سياسة الخصوصية</span>
            <span style={{ color: "#C7C2D4", fontSize: 16 }}>‹</span>
          </a>
          <a href="mailto:reemprimeco@gmail.com" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", textDecoration: "none", color: "#374151", borderBottom: "1px solid #F5F3EF" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>✉️ تواصلي معنا</span>
            <span style={{ color: "#C7C2D4", fontSize: 16 }}>‹</span>
          </a>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "#374151" }}>الإصدار</span>
            <span style={{ fontSize: 13.5, color: "#9CA3AF", direction: "ltr", fontVariantNumeric: "tabular-nums" }}>{APP_VERSION}</span>
          </div>
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
        سيُحذف حسابك وكل بيانات أبنائك (الواجبات، المتطلبات، الجدول، الحفظ، الدرجات، ومحادثات المعلم الذكي) نهائياً
        وبدون إمكانية استرجاع. لتأكيد الحذف، اكتبي رقم جوالك ({lastEight}):
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
