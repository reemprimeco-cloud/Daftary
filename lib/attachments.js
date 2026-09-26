// «إرفاق الجدول فقط» — الصورة تُحفظ للرجوع إليها بلا تحليل وبلا تذكير
// (قرار صاحبة التطبيق ٢٦ سبتمبر). نفس دلو `plan-sources` الخاص (غير عام،
// ما ينفتح إلا برابط موقّع من الخادم بعد التحقق من الملكية)، لكن ببادئة
// مسار خاصة وجدول خاص: `purgeExpiredSources` يحذف حسب صفوف
// `upload_sources` وحدها، فالمرفقات ما تنمسّ بأي تنظيف.
//
// **ما لها مدة انتهاء**: الصورة هنا هي الميزة نفسها لا نسخة مساعدة منها.
const BUCKET = "plan-sources";
const SIGNED_URL_SECONDS = 300;
const EXT = { "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/jpeg": "jpg" };

export const ATTACHMENT_KINDS = new Set(["plan", "class_schedule"]);

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z+]+);base64,/i.exec(dataUrl || "");
  const mime = match?.[1] || "image/jpeg";
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  return { mime, buffer: Buffer.from(base64, "base64") };
}

// بخلاف صور التحليل، فشل الحفظ هنا **يفشل العملية كلها**: ما فيه تحليل
// ناجح نحميه، والصورة هي كل اللي طلبته الأم. رفعة نصف ناجحة تخلي الأم
// تظن إن جدولها محفوظ وهو ضايع.
export async function storeAttachment(sb, { motherId, childId, kind, images, note }) {
  const id = crypto.randomUUID();
  const paths = [];
  try {
    for (let i = 0; i < images.length; i++) {
      const { mime, buffer } = decodeDataUrl(images[i]);
      const path = `${motherId}/attach/${id}/${i}.${EXT[mime] || "jpg"}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: true });
      if (error) throw new Error(error.message);
      paths.push(path);
    }
  } catch (e) {
    // ما نخلي ملفات يتيمة بالتخزين لو انقطعت بالنص
    if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => {});
    throw e;
  }

  const { data, error } = await sb
    .from("plan_attachments")
    .insert({ id, child_id: childId, mother_id: motherId, kind, paths, note: note || null })
    .select("id, child_id, kind, paths, note, created_at")
    .single();
  if (error) {
    await sb.storage.from(BUCKET).remove(paths).catch(() => {});
    throw new Error(error.message);
  }
  return data;
}

export async function signedAttachmentUrls(sb, paths) {
  const urls = [];
  for (const path of paths || []) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}

// الحذف يشيل الملفات قبل الصف — لو انعكس الترتيب وفشل حذف الملفات صارت
// ملفات يتيمة بلا أي أثر يدلّنا عليها.
// تنظيف ملفات مرفقات مجموعة طلاب — تُنادى قبل حذف الصفوف بمسارات «تصفير
// السنة» و«حذف الحساب»، وإلا بقيت الملفات بالتخزين بلا أي صف يدلّ عليها.
// الفشل ما يوقف الحذف نفسه: أسوأ ما يصير ملف يتيم، وأسوأ من ذلك إن حذف
// حساب الأم يفشل من أصله.
export async function purgeAttachmentFiles(sb, childIds) {
  if (!childIds?.length) return 0;
  try {
    const { data } = await sb.from("plan_attachments").select("paths").in("child_id", childIds);
    const paths = (data || []).flatMap((r) => r.paths || []);
    if (!paths.length) return 0;
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    if (error) throw new Error(error.message);
    return paths.length;
  } catch (e) {
    console.warn("purgeAttachmentFiles failed:", e.message);
    return 0;
  }
}

export async function deleteAttachment(sb, row) {
  if (row.paths?.length) {
    const { error } = await sb.storage.from(BUCKET).remove(row.paths);
    if (error) throw new Error(error.message);
  }
  const { error } = await sb.from("plan_attachments").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
}
