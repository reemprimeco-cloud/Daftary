// العائلة = اشتراك واحد يغطي ولي أمر أساسي + ولي أمر ثانٍ وأبناءهما.
// كل حساب موجود صار عائلة من شخص واحد بالترحيل، فسلوك من ما عنده شريك
// ما يتغير أبداً.
//
// قاعدة أمان ثابتة: معرّف العائلة يُستخرج دائماً من معرّف الجلسة الموثوق
// (x-mother-id اللي يحطه الحارس المركزي)، وما يُقرأ من جسم الطلب ولا من
// الرابط أبداً — وإلا قدر أي أحد يوصل بيانات عائلة ثانية بتبديل رقم.

export async function familyIdOf(sb, motherId) {
  if (!motherId) return null;
  const { data } = await sb.from("mothers").select("family_id").eq("id", motherId).maybeSingle();
  return data?.family_id || null;
}

export async function familyContext(sb, motherId) {
  if (!motherId) return null;
  const { data } = await sb.from("mothers").select("id, name, family_id, family_role").eq("id", motherId).maybeSingle();
  return data?.family_id ? { familyId: data.family_id, role: data.family_role, name: data.name } : null;
}

// أولياء أمور العائلة — تُستخدم بالتذكيرات عشان يوصل التنبيه للأب والأم.
export async function familyParents(sb, familyId) {
  if (!familyId) return [];
  const { data } = await sb
    .from("mothers")
    .select("id, name, phone, family_role, created_at")
    .eq("family_id", familyId)
    .order("family_role");
  return data || [];
}

// هل هذا الطالب/ة من عائلة صاحب الجلسة؟ بديل الفحص القديم اللي كان يقارن
// بـmother_id — وهو اللي كان يمنع الأب من رؤية أبناء نفس العائلة.
export async function childInFamily(sb, childId, motherId, columns = "*") {
  const familyId = await familyIdOf(sb, motherId);
  if (!familyId || !childId) return null;
  const { data } = await sb.from("children").select(columns).eq("id", childId).eq("family_id", familyId).maybeSingle();
  return data || null;
}

export async function familyChildIds(sb, motherId) {
  const familyId = await familyIdOf(sb, motherId);
  if (!familyId) return [];
  const { data } = await sb.from("children").select("id").eq("family_id", familyId);
  return (data || []).map((c) => c.id);
}

// ملكية صف معلّق على طالب/ة (مهمة، مستلزم، حفظ، درجة، حصة) — العبرة
// بعائلة الطالب/ة لا بمن أنشأ الصف.
export async function rowInFamily(sb, table, id, motherId) {
  if (!id) return false;
  const [{ data }, familyId] = await Promise.all([
    sb.from(table).select("id, children(family_id)").eq("id", id).maybeSingle(),
    familyIdOf(sb, motherId),
  ]);
  return !!data && !!familyId && data.children?.family_id === familyId;
}

// تسجيل فعل بسجل العائلة انطلاقاً من معرّف صاحب الجلسة وحده — يجيب
// عائلته واسمه ثم يسجّل. للحسابات بلا شريك السجل موجود لكن ما يُعرض.
export async function logFamilyAction(sb, motherId, action, entity = null) {
  const ctx = await familyContext(sb, motherId);
  if (!ctx) return;
  await logActivity(sb, { familyId: ctx.familyId, actorId: motherId, actorName: ctx.name, action, entity });
}

// سجل النشاط: مين سوّى وش. فشله ما يوقف العملية نفسها — السجل مساعد.
export async function logActivity(sb, { familyId, actorId, actorName, action, entity = null }) {
  if (!familyId || !action) return;
  const { error } = await sb.from("family_activity").insert({
    family_id: familyId,
    actor_id: actorId || null,
    actor_name: actorName || null,
    action,
    entity,
  });
  if (error) console.warn("logActivity failed:", error.message);
}
