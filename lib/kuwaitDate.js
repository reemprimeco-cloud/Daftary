const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// Kuwait has no DST, so a fixed +3h shift read back with UTC getters reliably
// gives Kuwait's local calendar date/weekday regardless of the server's own timezone.
export function kuwaitNow() {
  return new Date(Date.now() + KUWAIT_OFFSET_MS);
}

export function kuwaitTodayStr() {
  return kuwaitNow().toISOString().slice(0, 10);
}

export function kuwaitYear() {
  return kuwaitNow().getUTCFullYear();
}

export function kuwaitTodayLabel() {
  return new Date().toLocaleDateString("ar-KW", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Kuwait",
  });
}

// Sunday..Thursday date map for the current Kuwait week (school week).
export function kuwaitWeekMap() {
  const now = kuwaitNow();
  const day = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - day);
  sunday.setUTCHours(0, 0, 0, 0);
  const days = DAY_NAMES.slice(0, 5);
  const map = {};
  days.forEach((d, i) => {
    const dt = new Date(sunday);
    dt.setUTCDate(sunday.getUTCDate() + i);
    map[d] = dt.toISOString().slice(0, 10);
  });
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  return { map, sunday: map["الأحد"], thursday: map["الخميس"], saturday: saturday.toISOString().slice(0, 10) };
}
