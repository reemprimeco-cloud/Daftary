const BUCKET = "plan-sources";
// مدة بقاء الصورة الأصلية — قرار صاحبة التطبيق (١٨ سبتمبر): أسبوع يكفي
// للتأكد من أي معلومة بأسبوع الخطة نفسه، وبعدها تُحذف الصورة نهائياً.
export const SOURCE_TTL_DAYS = 7;
// الرابط الموقّع قصير العمر: يكفي لفتح الصورة بالشاشة وما ينفع لمشاركتها.
const SIGNED_URL_SECONDS = 300;

const EXT = { "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/jpeg": "jpg" };

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z+]+);base64,/i.exec(dataUrl || "");
  const mime = match?.[1] || "image/jpeg";
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  return { mime, buffer: Buffer.from(base64, "base64") };
}

// نحفظ الصور كما رفعتها الأم ونسجّل مسارها. فشل الحفظ ما يوقف التحليل —
// المصدر ميزة مساعدة، والبديل عن تجاهل الفشل خسارة رفعة كاملة نجح تحليلها.
export async function storeSourceImages(sb, { motherId, childId, images }) {
  try {
    const id = crypto.randomUUID();
    const paths = [];
    for (let i = 0; i < images.length; i++) {
      const { mime, buffer } = decodeDataUrl(images[i]);
      const path = `${motherId}/${id}/${i}.${EXT[mime] || "jpg"}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: true });
      if (error) throw new Error(error.message);
      paths.push(path);
    }
    if (!paths.length) return null;

    const expires = new Date(Date.now() + SOURCE_TTL_DAYS * 86400e3).toISOString();
    const { data, error } = await sb
      .from("upload_sources")
      .insert({ id, mother_id: motherId, child_id: childId, paths, expires_at: expires })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  } catch (e) {
    console.warn("storeSourceImages failed:", e.message);
    return null;
  }
}

// روابط موقّعة للعرض — تُنشأ بالخادم بعد التحقق من ملكية المصدر.
export async function signedSourceUrls(sb, paths) {
  const urls = [];
  for (const path of paths || []) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}

// تنظيف يومي: الصور المنتهية تُحذف من التخزين ثم يُحذف صفها، فالبنود
// المرتبطة بها تبقى وسجل مصدرها يصير null (ON DELETE SET NULL).
export async function purgeExpiredSources(sb) {
  const { data: expired } = await sb
    .from("upload_sources")
    .select("id, paths")
    .lt("expires_at", new Date().toISOString())
    .limit(500);
  if (!expired?.length) return 0;

  const paths = expired.flatMap((s) => s.paths || []);
  if (paths.length) {
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    // لو فشل حذف الملفات ما نحذف الصفوف — وإلا ضاع أثرها وبقيت الملفات
    // بالتخزين للأبد. نعيد المحاولة بتشغيل الكرون الجاي.
    if (error) {
      console.warn("purgeExpiredSources: storage remove failed:", error.message);
      return 0;
    }
  }
  await sb.from("upload_sources").delete().in("id", expired.map((s) => s.id));
  return expired.length;
}
