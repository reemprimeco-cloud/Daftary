import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitWeekMap } from "@/lib/kuwaitDate";
import { familyIdOf } from "@/lib/family";

export async function GET(req) {
  const motherId = req.nextUrl.searchParams.get("motherId");
  if (!motherId) return NextResponse.json({ error: "motherId مطلوب" }, { status: 400 });
  const sb = supabaseAdmin();

  // آخر مرة فتحت فيها ولية الأمر التطبيق. لوحة التحكم تُنادى بكل فتحة،
  // فهي أدق مؤشر على النشاط الفعلي. ما ننتظرها: تحديث إحصائي ما يستاهل
  // تأخير تحميل الشاشة، وفشله ما يضر.
  sb.from("mothers").update({ last_seen_at: new Date().toISOString() }).eq("id", motherId).then(
    () => {},
    () => {}
  );

  // هل نعرض طلب التقييم؟ بعد أسبوع من التسجيل (عشان تكون جرّبت البرنامج
  // فعلاً قبل ما نسألها عن رأيها)، وطالما ما قيّمت. الخادم هو اللي يقرر
  // مو المتصفح — لو تركناها للعميل رجع الطلب بمسح بيانات المتصفح.
  const FEEDBACK_AFTER_DAYS = 7;
  // قائمة الأبناء ما تعتمد على التقييم ولا العكس، فتنجيب معهم بنفس الرحلة.
  const familyChildren = async (sb, id) => {
    const familyId = await familyIdOf(sb, id);
    if (!familyId) return { data: [], error: null };
    return sb.from("children").select("*").eq("family_id", familyId).order("created_at");
  };
  const [{ data: profile }, { data: rated }, { data: children, error: cErr }] = await Promise.all([
    sb.from("mothers").select("created_at, password_hash").eq("id", motherId).maybeSingle(),
    // صار سجلاً بعدة صفوف، فـmaybeSingle تنكسر بأكثر من صف
    sb.from("app_feedback").select("mother_id").eq("mother_id", motherId).limit(1),
    // أبناء العائلة لا أبناء هذا الحساب وحده — فالأب يشوف نفس الأبناء.
    // (كل حساب بلا شريك = عائلة من شخص واحد، فالنتيجة ما تتغير له.)
    familyChildren(sb, motherId),
  ]);
  // الشريط بالرئيسية يبقى «مرة وحدة»: يطلع لمن ما قيّمت أبداً. واللي
  // قيّمت تدخل من سطر «رأيك وملاحظاتك» بحسابي، بلا شرط ولا اختفاء.
  const feedbackDue =
    !rated?.length &&
    !!profile?.created_at &&
    Date.now() - new Date(profile.created_at).getTime() >= FEEDBACK_AFTER_DAYS * 86400e3;

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

  const childIds = (children || []).map((c) => c.id);
  const { sunday, thursday, saturday } = kuwaitWeekMap();

  let tasks = [];
  let undatedTasks = [];
  let upcomingTasks = [];
  let doneTasks = [];
  let requirements = [];
  let classSchedule = [];
  let meetings = [];
  let memorization = [];
  // الاجتماع ما يظهر إلا لو الاستعلام نجح — الجدول يُنشأ بترحيل منفصل
  // (migrations/2026-10-24_parent_meetings.sql)، ولو انشر الكود قبله يطلع
  // للأم زر ينكسر أول ما تضغطه. فالغياب الصامت مقصود، والميزة تولد وحدها
  // لحظة ما ينطبّق الترحيل بلا نشر ثانٍ. (كان الحارس بالواجهة على رد
  // /api/meetings، وانتقل هنا بعد ما انضم للوحة.)
  let meetingsReady = false;
  if (childIds.length) {
    // الثمانية مستقلة عن بعض تماماً، وكانت تنفّذ واحداً بعد الآخر — رحلات
    // شبكة متتابعة لقاعدة البيانات على كل فتحة للتطبيق. صارت رحلة وحدة.
    //
    // والاجتماعات والحفظ انضموا هنا (قياس ٤ نوفمبر): كانت `WeekPlanPanel`
    // تجيبهم بطلبين **بعد** ما ترد اللوحة، فيتأخر اكتمال الشاشة الرئيسية
    // برحلتين متسلسلتين — على 3G ضعيف قيست ~٨٠٠ ms زيادة. وفوقها كان
    // `/api/meetings` يرجّع اجتماعات العائلة كلها ويُعاد طلبه **بكل تبديل
    // طالب/ة** لأن `key={planChild.id}` يعيد تركيب المكوّن.
    const [{ data: t }, { data: u }, { data: up }, { data: r }, { data: cs }, { data: dn }, mt, mz] = await Promise.all([
      // نجيب لين آخر السبت (مو الخميس بس) عشان أي واجب تاريخه صريح صادف
      // يوم جمعة/سبت (نادر، لكن ممكن بعد ميزة التواريخ البعيدة) ما يختفي.
      sb.from("tasks").select("*").in("child_id", childIds).eq("status", "active")
        .gte("due_date", sunday).lte("due_date", saturday).order("due_date"),
      sb.from("tasks").select("*").in("child_id", childIds).eq("status", "active")
        .is("due_date", null).order("created_at"),
      // واجبات لها تاريخ فعلي لكن بعد هذا الأسبوع (مشروع نهاية فصل، اختبار
      // بعد أسابيع...) — بدون هذا الاستعلام تختفي تماماً لين يجي أسبوعها.
      sb.from("tasks").select("*").in("child_id", childIds).eq("status", "active")
        .gt("due_date", saturday).order("due_date"),
      sb.from("requirements").select("*").in("child_id", childIds).order("created_at"),
      sb.from("class_schedule").select("*").in("child_id", childIds).order("period_number"),
      // المنجز من هذا الأسبوع فصاعداً (أو بلا تاريخ) — يظهر بقائمة الإنجاز
      // بعلامة ✓ ويدخل بنسبة الإنجاز. الأقدم ما يهم أحداً.
      sb.from("tasks").select("*").in("child_id", childIds).eq("status", "done")
        .or(`due_date.gte.${sunday},due_date.is.null`).order("due_date"),
      // اجتماع أولياء الأمور: صف واحد جارٍ لكل طالب/ة، والواجهة تصفّي
      // باللي معروض. نفس أعمدة /api/meetings بالضبط.
      sb.from("parent_meetings")
        .select("id, child_id, meet_on, meet_time, note, source_text, source_id")
        .in("child_id", childIds).order("meet_on"),
      // الحفظ بنفس ترتيب /api/memorization: غير المحفوظ أولاً، والأحدث
      // أولاً بين كل مجموعة.
      sb.from("memorization").select("*").in("child_id", childIds)
        .order("done", { ascending: true }).order("created_at", { ascending: false }),
    ]);
    tasks = t || [];
    undatedTasks = u || [];
    upcomingTasks = up || [];
    requirements = r || [];
    classSchedule = cs || [];
    doneTasks = dn || [];
    meetings = mt.data || [];
    meetingsReady = !mt.error;
    memorization = mz.data || [];
  }

  // حساب ما حدّد رقماً سرياً لسه: التطبيق يطلبه منه داخل التطبيق بجلسته
  // الحالية — بلا كود ولا تكلفة Twilio. نرجّع القيمة كنعم/لا فقط، البصمة
  // نفسها ما تطلع للعميل أبداً.
  const needsPassword = !profile?.password_hash;

  return NextResponse.json({ children, tasks, undatedTasks, upcomingTasks, doneTasks, requirements, classSchedule, meetings, meetingsReady, memorization, feedbackDue, needsPassword, weekRange: { sunday, thursday, saturday } });
}
