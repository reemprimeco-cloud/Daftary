import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { childInFamily, familyChildIds } from "@/lib/family";
import { storeAttachment, signedAttachmentUrls, ATTACHMENT_KINDS } from "@/lib/attachments";

// رفع الصور يطول ويكبر، فمهلة أطول من الافتراضية العشر ثوانٍ.
export const runtime = "nodejs";
export const maxDuration = 120;

// المرفقات: صور جداول تحفظها الأم للرجوع إليها بلا تحليل وبلا تذكير.
// ما تدخل جداول المهام ولا المستلزمات ولا الحفظ إطلاقاً — ولهذا ما فيه
// تذكير عنها: ما فيه صف بـ`tasks` ليتذكّر عنه كرون.
export async function POST(req) {
  const motherId = req.headers.get("x-mother-id");
  const { childId, kind, images, note } = await req.json().catch(() => ({}));

  if (!childId || !Array.isArray(images) || !images.length) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!ATTACHMENT_KINDS.has(kind)) {
    return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  if (!(await childInFamily(sb, childId, motherId, "id"))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const row = await storeAttachment(sb, { motherId, childId, kind, images, note });
    return NextResponse.json({ ok: true, attachment: row });
  } catch (e) {
    console.error("attachment save failed:", e.message);
    return NextResponse.json({ error: "تعذّر حفظ الصورة، حاولي مرة ثانية." }, { status: 500 });
  }
}

// القائمة ترجّع روابط موقّعة جاهزة للعرض — الدلو خاص فما ينفع رابط مباشر،
// والروابط تنتهي بخمس دقايق فتُطلب من جديد مع كل فتحة للشاشة.
export async function GET(req) {
  const motherId = req.headers.get("x-mother-id");
  const childId = req.nextUrl.searchParams.get("childId");
  const sb = supabaseAdmin();

  let ids;
  if (childId) {
    if (!(await childInFamily(sb, childId, motherId, "id"))) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    ids = [childId];
  } else {
    ids = await familyChildIds(sb, motherId);
  }
  if (!ids?.length) return NextResponse.json({ attachments: [] });

  const { data, error } = await sb
    .from("plan_attachments")
    .select("id, child_id, kind, paths, note, created_at")
    .in("child_id", ids)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const attachments = await Promise.all(
    (data || []).map(async (row) => ({
      id: row.id,
      child_id: row.child_id,
      kind: row.kind,
      note: row.note,
      created_at: row.created_at,
      count: (row.paths || []).length,
      urls: await signedAttachmentUrls(sb, row.paths),
    }))
  );
  return NextResponse.json({ attachments });
}
