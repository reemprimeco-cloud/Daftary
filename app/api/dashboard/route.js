import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function weekRange() {
  const now = new Date();
  const day = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - day);
  sunday.setUTCHours(0, 0, 0, 0);
  const thursday = new Date(sunday);
  thursday.setUTCDate(sunday.getUTCDate() + 4);
  return {
    sunday: sunday.toISOString().slice(0, 10),
    thursday: thursday.toISOString().slice(0, 10),
  };
}

export async function GET(req) {
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!motherId) return NextResponse.json({ error: "motherId مطلوب" }, { status: 400 });
  const sb = supabaseAdmin();

  const { data: children, error: cErr } = await sb
    .from("children")
    .select("*")
    .eq("mother_id", motherId)
    .order("created_at");
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

  const childIds = (children || []).map((c) => c.id);
  const { sunday, thursday } = weekRange();

  let tasks = [];
  let undatedTasks = [];
  let requirements = [];
  let classSchedule = [];
  if (childIds.length) {
    const { data: t } = await sb
      .from("tasks")
      .select("*")
      .in("child_id", childIds)
      .eq("status", "active")
      .gte("due_date", sunday)
      .lte("due_date", thursday)
      .order("due_date");
    tasks = t || [];

    const { data: u } = await sb
      .from("tasks")
      .select("*")
      .in("child_id", childIds)
      .eq("status", "active")
      .is("due_date", null)
      .order("created_at");
    undatedTasks = u || [];

    const { data: r } = await sb.from("requirements").select("*").in("child_id", childIds).order("created_at");
    requirements = r || [];

    const { data: cs } = await sb.from("class_schedule").select("*").in("child_id", childIds).order("period_number");
    classSchedule = cs || [];
  }

  return NextResponse.json({ children, tasks, undatedTasks, requirements, classSchedule, weekRange: { sunday, thursday } });
}
