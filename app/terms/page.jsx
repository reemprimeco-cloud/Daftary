import { PLAN, SUBSCRIPTION_TIERS } from "@/lib/plans";

export const metadata = {
  title: "شروط الاستخدام — دفتري",
  description: "شروط استخدام تطبيق دفتري وأحكام الاشتراك في المعلم الذكي",
};

const UPDATED = "٣٠ أغسطس ٢٠٢٦";

export default function TermsPage() {
  return (
    <div dir="rtl" className="app-scroll" style={{ background: "#FAF7F2", padding: "20px 20px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto 16px" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#5C4B8C", fontWeight: 700, fontSize: 14, textDecoration: "none", padding: "8px 4px" }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>→</span> رجوع لدفتري
        </a>
      </div>
      <main style={{ maxWidth: 680, margin: "0 auto", background: "white", borderRadius: 20, padding: "32px 26px", boxShadow: "0 1px 3px rgba(0,0,0,.06)", lineHeight: 1.9, color: "#374151", fontSize: 15 }}>
        <header style={{ textAlign: "center", marginBottom: 30, paddingBottom: 22, borderBottom: "1px solid #F0EEE8" }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 72, height: 72, borderRadius: 18, margin: "0 auto 14px", display: "block" }} />
          <h1 style={{ color: "#5C4B8C", fontSize: 25, fontWeight: 800, margin: "0 0 6px" }}>شروط الاستخدام</h1>
          <p style={{ color: "#9CA3AF", fontSize: 13, margin: 0 }}>تطبيق دفتري · آخر تحديث: {UPDATED}</p>
        </header>

        <Section title="قبول الشروط">
          <p style={p}>
            دفتري تطبيق تعليمي يساعد أولياء الأمور في الكويت على متابعة واجبات واختبارات أبنائهم، مقدَّم من
            {" "}<strong>Reemora</strong>. باستخدامك للتطبيق أو الموقع فأنت توافق على هذه الشروط، فإن لم توافق عليها
            فلا تستخدم التطبيق.
          </p>
          <p style={p}>
            التطبيق موجَّه لأولياء الأمور البالغين، وأنت مسؤول عن صحة البيانات التي تدخلها عن أبنائك وعن الحفاظ
            على سرية حسابك.
          </p>
        </Section>

        <Section title="التطبيق مجاني">
          <p style={{ ...p, background: "#EBF7F1", padding: "12px 14px", borderRadius: 12, color: "#2F6E56", fontSize: 14 }}>
            <strong>كل ميزات دفتري مجانية بالكامل</strong> — الواجبات والاختبارات والمتطلبات وجدول الحصص والحفظ
            والدرجات والتذكيرات وتصدير الجداول. الاشتراك المدفوع يخص ميزة <strong>المعلم الذكي</strong> وحدها،
            وباقي التطبيق يعمل كاملاً بدونه.
          </p>
        </Section>

        <Section title="اشتراك المعلم الذكي">
          <p style={p}>
            المعلم الذكي ميزة اختيارية تشرح الدروس وتجيب على أسئلتك بالاستناد إلى المنهج الدراسي الكويتي.
            يعمل برصيد أسئلة، وكل سؤال ترسله يخصم سؤالاً واحداً من الرصيد.
          </p>
          <ul style={ul}>
            <li style={li}>
              <strong>تجربة مجانية:</strong> {PLAN.TRIAL_QUESTIONS} أسئلة مجانية لكل طالب/ة، بلا اشتراك وبلا بيانات دفع.
            </li>
            {SUBSCRIPTION_TIERS.map((t) => (
              <li key={t.productId} style={li}>
                <strong>{t.label}:</strong> {t.priceKwd} د.ك للسنة الدراسية.
              </li>
            ))}
            <li style={li}>
              <strong>رصيد إضافي:</strong> {PLAN.CREDIT_PACK_QUESTIONS} سؤال مقابل {PLAN.CREDIT_PACK_PRICE_KWD} د.ك،
              يُضاف لطالب/ة تختاره، ويمكن شراؤه أكثر من مرة.
            </li>
          </ul>
          <p style={p}>
            <strong>قسمة الرصيد:</strong> رصيد الاشتراك يُقسَّم بالتساوي بين أبنائك المسجَّلين، ولكل واحد رصيده الخاص
            حتى لا يستهلك أحدهم نصيب إخوته. وإذا أضفت طالباً/ة بعد الاشتراك، يُعاد توزيع الرصيد المتبقي على الجميع
            بالتساوي — دون أن يزيد أو ينقص مجموع ما اشتريته.
          </p>
          <p style={p}>
            الأسعار بالدينار الكويتي وقد تختلف بحسب متجر آبل في بلدك والضرائب المطبَّقة فيه.
          </p>
        </Section>

        <Section title="الدفع والتجديد والإلغاء">
          <p style={p}>
            تتم جميع المدفوعات عبر <strong>مشتريات آبل داخل التطبيق</strong>. نحن لا نستقبل ولا نخزّن ولا نعالج أي
            بيانات بطاقة بنكية إطلاقاً.
          </p>
          <ul style={ul}>
            <li style={li}>يُخصم المبلغ من حساب آبل الخاص بك عند تأكيد الشراء.</li>
            <li style={li}>
              الاشتراك <strong>يتجدد تلقائياً كل سنة</strong> ما لم تلغِه قبل ٢٤ ساعة على الأقل من نهاية المدة الحالية،
              ويُخصم مبلغ التجديد خلال الـ٢٤ ساعة السابقة لنهاية المدة.
            </li>
            <li style={li}>
              يمكنك إدارة الاشتراك أو إيقاف التجديد التلقائي في أي وقت من
              {" "}<strong>إعدادات جهازك ← اسمك ← الاشتراكات</strong>. حذف التطبيق وحده لا يُلغي الاشتراك.
            </li>
            <li style={li}>
              <strong>الرصيد الإضافي شراء لمرة واحدة</strong> ولا يتجدد تلقائياً.
            </li>
            <li style={li}>
              الرصيد غير المستخدم ينتهي بانتهاء مدة الاشتراك ولا يُرحَّل للسنة التالية، ولا يُستبدل بمبلغ نقدي.
            </li>
          </ul>
          <p style={p}>
            <strong>الاسترجاع:</strong> طلبات استرجاع المبالغ تخضع لسياسة آبل وتُقدَّم إليها مباشرة عبر
            {" "}<a href="https://reportaproblem.apple.com" style={link}>reportaproblem.apple.com</a>، فنحن لا نملك
            صلاحية إرجاع مبالغ دفعتها عبر متجر آبل.
          </p>
        </Section>

        <Section title="حدود المعلم الذكي">
          <p style={p}>
            المعلم الذكي أداة <strong>مساعدة تعليمية</strong> تعتمد على الذكاء الاصطناعي، وإجاباته قد تحتوي على أخطاء
            أو نقص. هو لا يُغني عن المعلم أو الكتاب المدرسي، وننصحك بمراجعة إجاباته قبل الاعتماد عليها — خصوصاً في
            الواجبات المقيَّمة والاختبارات.
          </p>
          <ul style={ul}>
            <li style={li}>يجيب بالنصوص فقط، ولا يرسل ولا يصمّم صوراً.</li>
            <li style={li}>مقيَّد بالمنهج الدراسي الكويتي، ويعتذر عن الأسئلة الخارجة عن النطاق التعليمي.</li>
            <li style={li}>
              أدق ما يكون حين ترفق صورة من صفحة الكتاب أو الواجب، لأنه يشرح ما في الصورة نفسها.
            </li>
          </ul>
          <p style={p}>
            لا نضمن أن الخدمة ستكون متاحة دون انقطاع، فقد تتوقف مؤقتاً لأعمال الصيانة أو لأسباب خارجة عن إرادتنا
            تتعلق بمزوّدي الخدمات الذين نعتمد عليهم.
          </p>
        </Section>

        <Section title="الاستخدام المقبول">
          <p style={p}>باستخدامك للتطبيق، أنت توافق على ألا:</p>
          <ul style={ul}>
            <li style={li}>تستخدمه لأي غرض غير قانوني أو مخالف للآداب العامة.</li>
            <li style={li}>ترفع محتوى مسيئاً أو ينتهك حقوق الآخرين أو خصوصيتهم.</li>
            <li style={li}>تحاول اختراق التطبيق أو تجاوز حدود الرصيد أو الوصول لبيانات مستخدمين آخرين.</li>
            <li style={li}>تستخدم الخدمة آلياً أو بشكل مفرط يضر بتشغيلها لبقية المستخدمين.</li>
            <li style={li}>تشارك حسابك مع آخرين خارج نطاق أسرتك.</li>
          </ul>
          <p style={p}>
            يحق لنا إيقاف الحساب المخالف لهذه الشروط، ولا يستحق صاحبه استرجاع ما دفعه في حال المخالفة الجسيمة.
          </p>
        </Section>

        <Section title="حسابك وبياناتك">
          <p style={p}>
            يمكنك حذف حسابك وكل بياناته نهائياً في أي وقت من داخل التطبيق. <strong>حذف الحساب لا يُلغي اشتراكك
            في آبل ولا يستردّ مبلغه</strong> — عليك إلغاء التجديد التلقائي من إعدادات جهازك بشكل منفصل.
          </p>
          <p style={p}>
            طريقة تعاملنا مع بياناتك موضّحة في <a href="/privacy" style={link}>سياسة الخصوصية</a>، وهي جزء لا يتجزأ
            من هذه الشروط.
          </p>
        </Section>

        <Section title="الملكية الفكرية">
          <p style={p}>
            التطبيق وتصميمه واسمه وشعاره ملك لـ<strong>Reemora</strong>. البيانات التي تدخلها تبقى ملكك، وتمنحنا
            فقط الإذن اللازم لمعالجتها وعرضها لك داخل التطبيق. المناهج والمواد الدراسية ملك لوزارة التربية الكويتية،
            ولا ندّعي ملكيتها ولا نمثّل الوزارة رسمياً.
          </p>
        </Section>

        <Section title="حدود المسؤولية">
          <p style={p}>
            يُقدَّم التطبيق «كما هو». نبذل جهداً معقولاً ليعمل بشكل صحيح، لكننا لا نتحمل مسؤولية أي ضرر غير مباشر
            ناتج عن استخدامه — كنتيجة اختبار، أو موعد فات، أو قرار دراسي اتُّخذ بناءً على إجابة من المعلم الذكي.
            وفي كل الأحوال، لا تتجاوز مسؤوليتنا المبلغ الذي دفعته فعلياً خلال الاثني عشر شهراً السابقة.
          </p>
        </Section>

        <Section title="تعديلات على الشروط">
          <p style={p}>
            قد نحدّث هذه الشروط من وقت لآخر، وسنغيّر تاريخ «آخر تحديث» أعلى الصفحة. التغييرات الجوهرية — ومنها أي
            تغيير في الأسعار أو في عدد الأسئلة — سنُعلمك بها داخل التطبيق قبل سريانها، ولن تُطبَّق على اشتراك جارٍ
            إلا عند تجديده.
          </p>
        </Section>

        <Section title="القانون المطبَّق">
          <p style={p}>
            تخضع هذه الشروط لقوانين دولة الكويت، وتختص محاكمها بالنظر في أي نزاع ينشأ عنها.
          </p>
        </Section>

        <Section title="تواصل معنا">
          <p style={p}>لأي استفسار يخص الاشتراك أو هذه الشروط:</p>
          <p style={{ ...p, textAlign: "center", marginTop: 16 }}>
            <a href="mailto:reemprimeco@gmail.com" style={{ display: "inline-block", padding: "11px 26px", borderRadius: 12, background: "#B7A6E8", color: "white", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
              reemprimeco@gmail.com
            </a>
          </p>
        </Section>

        <footer style={{ marginTop: 34, paddingTop: 20, borderTop: "1px solid #F0EEE8", textAlign: "center" }}>
          <a href="/" style={{ color: "#B7A6E8", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>العودة إلى دفتري</a>
          <p style={{ color: "#B7B2C4", fontSize: 12, margin: "10px 0 0" }}>Copyright © Reemora.app 2026</p>
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ color: "#5C4B8C", fontSize: 17.5, fontWeight: 800, margin: "0 0 8px" }}>{title}</h2>
      {children}
    </section>
  );
}

const p = { margin: "0 0 10px" };
const ul = { margin: "0 0 10px", paddingInlineStart: 22 };
const li = { marginBottom: 6 };
const link = { color: "#5C4B8C", fontWeight: 700 };
