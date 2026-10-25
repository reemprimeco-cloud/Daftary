import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily } from "@/lib/family";
import { kuwaitTerm } from "@/lib/moeCurriculum";
import { itemIn, schemeFor } from "@/lib/gradeScheme";

export async function GET(req) {
  const childId = req.nextUrl.searchParams.get("childId");
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!childId || !motherId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId, "id");
  if (!child) return NextResponse.json({ error: "الطالب/ة غير موجود" }, { status: 400 });

  const { data, error } = await sb
    .from("exam_grades")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // هل انطبّق ترحيل الأعمدة الجديدة؟ (migrations/2026-10-25_grade_items.sql)
  // الواجهة ما تعرض بطاقة البنود إلا لو `structured` صحيحة — وإلا طلعت
  // للأم خانات تنكسر أول ما تكتب فيها. استعلام واحد رخيص بصف واحد.
  const { error: probe } = await sb.from("exam_grades").select("item").limit(1);
  return NextResponse.json({ grades: data, structured: !probe });
}

export async function POST(req) {
  const body = await req.json();
  const { childId, subject, score, maxScore, examName, period, item, semester, scheme } = body;
  const motherId = req.headers.get("x-mother-id");
  if (!motherId || !childId || !subject?.trim()) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const child = await childInFamily(sb, childId, motherId, "id");
  if (!child) return NextResponse.json({ error: "الطالب/ة غير موجود" }, { status: 400 });

  // ———— إدخال ببند من القالب ————
  // الدرجة الكلية تجي **من القالب بالخادم لا من العميل**: لو أخذناها من
  // الطلب، أي طلب معدّل يخلي المشاركة من ١٠٠ فتطلع نسبة الطالب/ة غلط.
  if (item) {
    const def = itemIn(scheme, item);
    if (!def) return NextResponse.json({ error: "بند غير معروف" }, { status: 400 });
    if (!semester?.trim()) return NextResponse.json({ error: "الفصل مطلوب" }, { status: 400 });

    const where = (q) =>
      q.eq("child_id", childId).eq("subject", subject.trim()).eq("semester", semester.trim()).eq("item", item);

    // خانة انفرغت = البند ما انرصد بعد، لا صفر. فنحذف الصف بدل ما نكتب ٠ —
    // وإلا صار المجموع يقول «٠ من ٤» وهي بس مسحت الرقم لتعيد كتابته.
    if (score === "" || score == null) {
      const { error } = await where(sb.from("exam_grades").delete());
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, cleared: true });
    }

    const n = Number(score);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "درجة غير صالحة" }, { status: 400 });
    if (n > def.max) {
      return NextResponse.json({ error: `أقصى درجة لهذا البند ${def.max}` }, { status: 400 });
    }

    const row = {
      child_id: childId,
      subject: subject.trim(),
      semester: semester.trim(),
      item,
      scheme: schemeFor(scheme).key,
      score: n,
      max_score: def.max,
      period: def.part || null,
      exam_name: def.label,
      term: kuwaitTerm(),
    };

    // القيد الفريد جزئي (where item is not null)، وupsert بـPostgREST ما
    // يعرف يستهدف فهرساً جزئياً — فنقرأ ثم نكتب، والقيد يبقى حارساً أخيراً.
    const { data: existing } = await where(sb.from("exam_grades").select("id")).maybeSingle();
    const q = existing
      ? sb.from("exam_grades").update(row).eq("id", existing.id)
      : sb.from("exam_grades").insert(row);
    const { data, error } = await q.select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ grade: data });
  }

  // ———— الإدخال الحر القديم (يبقى كما هو) ————
  if (score == null || !maxScore) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  const scoreNum = Number(score);
  const maxNum = Number(maxScore);
  if (!Number.isFinite(scoreNum) || !Number.isFinite(maxNum) || scoreNum < 0 || maxNum <= 0) {
    return NextResponse.json({ error: "درجة غير صالحة" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("exam_grades")
    .insert({
      child_id: childId,
      subject: subject.trim(),
      score: scoreNum,
      max_score: maxNum,
      // العمود القديم: عدد صحيح يُحسب من الشهر، ما يُقرأ بأي مكان
      term: kuwaitTerm(),
      // الفترة اللي اختارتها الأم أو كتبتها بنفسها — هذي اللي تُعرض
      period: period?.trim() || null,
      exam_name: examName?.trim() || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ grade: data });
}
