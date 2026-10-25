-- إدخال الدرجات ببنودها (قرارها ٢٥ أكتوبر): بدل خانتين فاضيتين «الدرجة /
-- الدرجة الكلية»، تطلع للأم بطاقة فيها كل بند ودرجته مكتوبة جنبه وهي
-- تعبّي الرقم بس.
--
-- ما نحتاج جدولاً جديداً: exam_grades عنده أصلاً subject و score و
-- max_score و period. يكفي عمودان + قيد يمنع التكرار.
alter table exam_grades add column if not exists item text;
alter table exam_grades add column if not exists semester text;
-- أي قالب انحفظ به الصف (أكاديمي/علوم/عملي/مجموع فقط) — نحتاجه عشان نعرض
-- الصف بنفس القالب اللي انحفظ به حتى لو تغيّر تخمين المادة بعدين.
alter table exam_grades add column if not exists scheme text;

-- **إعادة إدخال نفس البند تستبدل لا تكرّر**: عدّلت المعلمة درجة المشاركة،
-- تكتبها الأم فوق القديمة. القيد جزئي (item is not null) عشان الدرجات
-- القديمة الحرة — اللي بلا بند — تبقى كما هي ويقدر يتكرر منها كم ما شاءت.
create unique index if not exists exam_grades_item_uniq
  on exam_grades (child_id, subject, semester, item)
  where item is not null;
