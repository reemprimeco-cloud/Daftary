import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { applyPlanItems, cleanupCompletedBeforeThisWeek, summarize } from "@/lib/planApply";
import { markTrialUploadUsed } from "@/lib/appEntitlements";

async function loadDraft(sb, id, motherId) {
  const { data } = await sb
    .from("upload_drafts")
    .select("id, mother_id, child_id, kind, items, status, images_count, source_id")
    .eq("id", id)
    .maybeSingle();
  return data && data.mother_id === motherId ? data : null;
}

export async function GET(req, { params }) {
  const sb = supabaseAdmin();
  const draft = await loadDraft(sb, params.id, req.headers.get("x-mother-id"));
  if (!draft) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  return NextResponse.json({ draft: { ...draft, summary: summarize(draft.items || {}) } });
}

// اعتماد المسودة — هنا فقط تدخل البيانات جداول الطالب/ة. العناصر تجي من
// الواجهة بعد تعديل الأم، فما نثق بها: نتحقق من ملكية الطالب/ة، وطبقة
// applyPlanItems تنظّف الأنواع والتواريخ قبل الإدخال.
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const motherId = req.headers.get("x-mother-id");
  const sb = supabaseAdmin();

  const draft = await loadDraft(sb, params.id, motherId);
  if (!draft) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  // ضغطة مكررة أو إعادة إرسال بعد انقطاع ما تعيد الحفظ مرتين.
  if (draft.status === "applied") return NextResponse.json({ ok: true, alreadyApplied: true });
  if (draft.status !== "pending") return NextResponse.json({ error: "هذي المراجعة انتهت، ارفعي الخطة مرة ثانية." }, { status: 409 });

  const { data: child } = await sb
    .from("children").select("id").eq("id", draft.child_id).eq("mother_id", motherId).maybeSingle();
  if (!child) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  // الأم تقدر تحذف عنصراً أو تعدّله بشاشة المراجعة، فاللي ينحفظ هو اللي
  // ترسله الواجهة — وبلا إرسال نرجع لمحتوى المسودة كما استُخرج.
  const items = body.items && typeof body.items === "object" ? body.items : draft.items;

  const counts = await applyPlanItems(sb, child.id, items, draft.source_id || null);

  // التجربة المجانية تُستهلك هنا فقط — بعد ما تنحفظ البيانات فعلاً، لا عند
  // التحليل. فمحاولة فاشلة أو نتيجة رفضتها الأم ما تخسّرها التجربة.
  await markTrialUploadUsed(motherId, "plan");
  await cleanupCompletedBeforeThisWeek(sb, child.id);

  await sb.from("upload_drafts").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", draft.id);

  return NextResponse.json({ ok: true, ...counts });
}

export async function DELETE(req, { params }) {
  const sb = supabaseAdmin();
  const draft = await loadDraft(sb, params.id, req.headers.get("x-mother-id"));
  if (!draft) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  await sb.from("upload_drafts").update({ status: "discarded" }).eq("id", draft.id).eq("status", "pending");
  return NextResponse.json({ ok: true });
}
