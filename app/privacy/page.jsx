export const metadata = {
  title: "سياسة الخصوصية — دفتري",
  description: "سياسة الخصوصية وحماية البيانات في تطبيق دفتري",
};

const UPDATED = "١٤ أغسطس ٢٠٢٦";

export default function PrivacyPage() {
  return (
    <div dir="rtl" style={{ minHeight: "100%", overflowY: "auto", background: "#FAF7F2", padding: "40px 20px 60px" }}>
      <main style={{ maxWidth: 680, margin: "0 auto", background: "white", borderRadius: 20, padding: "32px 26px", boxShadow: "0 1px 3px rgba(0,0,0,.06)", lineHeight: 1.9, color: "#374151", fontSize: 15 }}>
        <header style={{ textAlign: "center", marginBottom: 30, paddingBottom: 22, borderBottom: "1px solid #F0EEE8" }}>
          <img src="/logo.png" alt="دفتري" style={{ width: 72, height: 72, borderRadius: 18, margin: "0 auto 14px", display: "block" }} />
          <h1 style={{ color: "#5C4B8C", fontSize: 25, fontWeight: 800, margin: "0 0 6px" }}>سياسة الخصوصية</h1>
          <p style={{ color: "#9CA3AF", fontSize: 13, margin: 0 }}>تطبيق دفتري · آخر تحديث: {UPDATED}</p>
        </header>

        <Section title="من نحن">
          <p style={p}>
            دفتري تطبيق تعليمي يساعد أولياء الأمور في الكويت على متابعة واجبات واختبارات أبنائهم. التطبيق مقدَّم من
            {" "}<strong>Reemora</strong>، ونلتزم بحماية خصوصية بياناتك وبيانات أبنائك.
          </p>
          <p style={p}>
            باستخدامك للتطبيق أو الموقع، فأنت توافقين على ما ورد في هذه السياسة.
          </p>
        </Section>

        <Section title="البيانات التي نجمعها">
          <p style={p}>نجمع فقط البيانات اللازمة لتشغيل التطبيق:</p>
          <ul style={ul}>
            <li style={li}><strong>بيانات ولي الأمر:</strong> الاسم ورقم الجوال.</li>
            <li style={li}><strong>بيانات الطالب/ة:</strong> الاسم، المدرسة، المحافظة، الصف والشعبة، الجنس، وصورة اختيارية تضيفينها بنفسك.</li>
            <li style={li}><strong>البيانات الدراسية:</strong> الواجبات والاختبارات والمشاريع، المتطلبات المدرسية، جدول الحصص، مطلوبات الحفظ، ودرجات الاختبارات التي تدخلينها.</li>
            <li style={li}><strong>الصور:</strong> صور جداول الواجبات أو صفحات الواجب التي تصوّرينها أو ترفعينها للتحليل.</li>
            <li style={li}><strong>محادثات المعلم الذكي:</strong> أسئلتك والإجابات المقدَّمة لك.</li>
            <li style={li}><strong>التذكيرات:</strong> داخل تطبيق آيفون تُجدول التذكيرات محلياً على جهازك فقط، ولا يُرسَل أي معرّف جهاز إلى خوادمنا.</li>
          </ul>
          <p style={{ ...p, background: "#F1EFFA", padding: "12px 14px", borderRadius: 12, color: "#5C4B8C", fontSize: 14 }}>
            <strong>لا نجمع:</strong> موقعك الجغرافي، جهات اتصالك، سجل تصفحك، أي معرّفات إعلانية، أو بيانات بطاقتك البنكية.
          </p>
        </Section>

        <Section title="كيف نستخدم بياناتك">
          <ul style={ul}>
            <li style={li}>عرض وتنظيم واجبات ودرجات أبنائك داخل التطبيق.</li>
            <li style={li}>تحليل صور الجداول التي ترفعينها لاستخراج الواجبات والمواعيد تلقائياً.</li>
            <li style={li}>الإجابة على أسئلتك في المعلم الذكي بما يتوافق مع المنهج الدراسي.</li>
            <li style={li}>إرسال تذكيرات بمواعيد الاختبارات والواجبات.</li>
          </ul>
          <p style={p}>
            <strong>لا نبيع بياناتك ولا نؤجّرها ولا نشاركها لأغراض تسويقية أو إعلانية، إطلاقاً.</strong>
          </p>
        </Section>

        <Section title="الذكاء الاصطناعي">
          <p style={p}>
            لتحليل صور الجداول والإجابة على أسئلة المعلم الذكي، نستعين بخدمة الذكاء الاصطناعي
            {" "}<strong>Claude</strong> من شركة <strong>Anthropic</strong>. يُرسَل إليها فقط محتوى السؤال أو الصورة المطلوب
            تحليلها مع الصف والمادة، ولا تُستخدم هذه البيانات لتدريب نماذج الذكاء الاصطناعي.
          </p>
          <p style={p}>
            المعلم الذكي مقيَّد بالمنهج الدراسي الكويتي الرسمي، ويعتذر عن الإجابة على الأسئلة الخارجة عن النطاق التعليمي.
            الإجابات مساعدة تعليمية وقد تحتاج مراجعتك، ولا تُغني عن المعلم أو الكتاب المدرسي.
          </p>
        </Section>

        <Section title="أطراف نستعين بها">
          <p style={p}>نعتمد على مزوّدي خدمات موثوقين لتشغيل التطبيق، ولا يستخدمون بياناتك لأغراضهم:</p>
          <ul style={ul}>
            <li style={li}><strong>Supabase</strong> — تخزين قاعدة البيانات.</li>
            <li style={li}><strong>Vercel</strong> — استضافة التطبيق والموقع.</li>
            <li style={li}><strong>Anthropic</strong> — خدمة الذكاء الاصطناعي.</li>
            <li style={li}><strong>وزارة التربية الكويتية</strong> — مكتبتها الإلكترونية العامة (elibrary.moe.edu.kw) للاستعانة بنماذج الاختبارات والمراجعات الرسمية عند الإجابة على أسئلة المعلم الذكي.</li>
          </ul>
          <p style={p}>
            قد تُخزَّن البيانات على خوادم خارج الكويت لدى هؤلاء المزوّدين. كما قد نفصح عن البيانات إذا فرض علينا القانون ذلك.
          </p>
        </Section>

        <Section title="بيانات الأطفال">
          <p style={p}>
            دفتري موجَّه لأولياء الأمور البالغين، وليس للأطفال. البيانات المتعلقة بالطالب/ة يدخلها ولي الأمر بنفسه وتحت
            مسؤوليته، ونتعامل معها بنفس مستوى الحماية والسرية. لا نطلب من الأطفال أي بيانات مباشرة، ولا نوجّه أي محتوى
            إعلاني لهم.
          </p>
        </Section>

        <Section title="مدة الاحتفاظ بالبيانات">
          <p style={p}>
            نحتفظ ببياناتك ما دام حسابك نشطاً. يمكنك في أي وقت:
          </p>
          <ul style={ul}>
            <li style={li}>حذف أي واجب أو متطلب أو درجة بشكل فردي.</li>
            <li style={li}>مسح كل بيانات العام الدراسي دفعة واحدة من تبويب «الحفظ والدرجات».</li>
            <li style={li}><strong>حذف حسابك نهائياً</strong> مع كل البيانات المرتبطة به، من نفس التبويب.</li>
          </ul>
          <p style={p}>
            عند حذف الحساب تُمسح بياناتك من قاعدة بياناتنا مباشرة وبشكل غير قابل للاسترجاع، وتُزال من النسخ الاحتياطية
            خلال ٣٠ يوماً.
          </p>
        </Section>

        <Section title="حقوقك">
          <p style={p}>
            لك الحق في الاطلاع على بياناتك، أو تصحيحها، أو حذفها، أو طلب نسخة منها. أغلب هذه الحقوق متاحة لك مباشرة داخل
            التطبيق، ولأي طلب آخر تواصلي معنا وسنستجيب خلال ٣٠ يوماً.
          </p>
        </Section>

        <Section title="أمان البيانات">
          <p style={p}>
            جميع الاتصالات بين التطبيق وخوادمنا مشفَّرة عبر HTTPS، والبيانات مخزَّنة لدى مزوّدين يلتزمون بمعايير أمان
            معتمدة. ومع ذلك، لا توجد وسيلة نقل أو تخزين إلكتروني آمنة بنسبة ١٠٠٪، ونحن نبذل جهداً معقولاً لحمايتها.
          </p>
        </Section>

        <Section title="التطبيق مجاني">
          <p style={p}>
            <strong>دفتري مجاني بالكامل.</strong> لا يحتوي على أي مشتريات داخل التطبيق، ولا اشتراكات، ولا محتوى مدفوع،
            ولا إعلانات. لا نطلب منك أي بيانات دفع ولا نعالج أي مدفوعات، ولا توجد أي بوابة دفع مرتبطة بالتطبيق.
          </p>
        </Section>

        <Section title="تعديلات على هذه السياسة">
          <p style={p}>
            قد نحدّث هذه السياسة من وقت لآخر، وسنغيّر تاريخ «آخر تحديث» أعلى الصفحة. التغييرات الجوهرية سنُعلمك بها داخل
            التطبيق.
          </p>
        </Section>

        <Section title="تواصلي معنا">
          <p style={p}>
            لأي استفسار أو طلب يخص خصوصيتك وبياناتك:
          </p>
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
