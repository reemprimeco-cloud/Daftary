import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { kuwaitWeekMap } from "@/lib/kuwaitDate";

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
  const [{ data: profile }, { data: rated }, { data: children, error: cErr }] = await Promise.all([
    sb.from("mothers").select("created_at").eq("id", motherId).maybeSingle(),
    sb.from("app_feedback").select("mother_id").eq("mother_id", motherId).maybeSingle(),
    sb.from("children").select("*").eq("mother_id", motherId).order("created_at"),
  ]);
  const feedbackDue =
    !rated &&
    !!profile?.created_at &&
    Date.now() - new Date(profile.created_at).getTime() >= FEEDBACK_AFTER_DAYS * 86400e3;

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

  const childIds = (children || []).map((c) => c.id);
  const { sunday, thursday, saturday } = kuwaitWeekMap();

  let tasks = [];
  let undatedTasks = [];
  let upcomingTasks = [];
  let requirements = [];
  let classSchedule = [];
  if (childIds.length) {
    // الخمسة مستقلة عن بعض تماماً، وكانت تنفّذ واحداً بعد الآخر — خمس رحلات
    // شبكة متتابعة لقاعدة البيانات على كل فتحة للتطبيق. صارت رحلة وحدة.
    const [{ data: t }, { data: u }, { data: up }, { data: r }, { data: cs }] = await Promise.all([
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
    ]);
    tasks = t || [];
    undatedTasks = u || [];
    upcomingTasks = up || [];
    requirements = r || [];
    classSchedule = cs || [];
  }

  return NextResponse.json({ children, tasks, undatedTasks, upcomingTasks, requirements, classSchedule, feedbackDue, weekRange: { sunday, thursday } });
}
