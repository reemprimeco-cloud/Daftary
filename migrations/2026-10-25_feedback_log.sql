-- التقييم صار سجلاً لا صفاً واحداً للأبد (طلبها ٢٥ أكتوبر): كان
-- mother_id هو المفتاح الأساسي، فأم قيّمت بسبتمبر ما عندها ولا طريق
-- توصل فيه ملاحظة اليوم.
alter table app_feedback add column if not exists id uuid default gen_random_uuid();
update app_feedback set id = gen_random_uuid() where id is null;
alter table app_feedback alter column id set not null;
alter table app_feedback drop constraint app_feedback_pkey;
alter table app_feedback add constraint app_feedback_pkey primary key (id);
create index if not exists app_feedback_mother_idx on app_feedback(mother_id);
