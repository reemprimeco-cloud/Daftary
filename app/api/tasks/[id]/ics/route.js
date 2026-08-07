import { supabaseAdmin } from "@/lib/supabase";

function escapeICS(str) {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatDateStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(req, { params }) {
  const sb = supabaseAdmin();
  const { data: task, error } = await sb.from("tasks").select("*").eq("id", params.id).single();
  if (error || !task) {
    return new Response("الواجب غير موجود", { status: 404 });
  }
  if (!task.due_date) {
    return new Response("لازم تحددي تاريخ الاستحقاق أولاً قبل إضافة التذكير", { status: 400 });
  }

  const dueDateCompact = task.due_date.replace(/-/g, "");
  const summary = `${task.type ? task.type + ": " : ""}${task.subject}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daftary//Tasks//AR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTODO",
    `UID:${task.id}@daftary.app`,
    `DTSTAMP:${formatDateStamp(new Date())}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DUE;VALUE=DATE:${dueDateCompact}`,
    task.details ? `DESCRIPTION:${escapeICS(task.details)}` : null,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICS("تذكير: " + summary)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VTODO",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new Response(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="reminder-${task.id}.ics"`,
    },
  });
}
