-- اجتماع أولياء الأمور (طلبها ٢٤ أكتوبر): موعد واحد جارٍ لكل طالب/ة،
-- تكتبه الأم يدوياً أو يُستخرج من صورة وتعتمده هي.
--
-- **صف واحد لكل طالب/ة** (`unique(child_id)`): الموعد الجديد يحل محل
-- السابق. الشاشة تعرض سطراً واحداً جنب الطالب/ة، فموعدان يعني أي واحد
-- يُعرض؟ ونفس قاعدة استبدال الصور المرفقة.
create table if not exists parent_meetings (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references children(id) on delete cascade,
  mother_id uuid not null references mothers(id) on delete cascade,
  meet_on date not null,
  -- نص حر كما كُتب بالصورة ("٥:٣٠ م"، "الفترة المسائية") — ما يُوحَّد،
  -- والتذكير يعتمد على meet_on وحده فما يحتاج وقتاً مفهوماً للآلة.
  meet_time text,
  note text,
  -- النص كما ظهر بالصورة حرفياً، جنب المنظّم لا بدلاً عنه
  source_text text,
  source_id uuid references upload_sources(id) on delete set null,
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists parent_meetings_meet_on_idx on parent_meetings(meet_on);

-- كل الوصول من الخادم بمفتاح service_role — نقفل REST المباشر بلا سياسات.
alter table parent_meetings enable row level security;
