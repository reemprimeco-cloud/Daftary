# إعداد التحقق برمز OTP — خطوات ما قبل النشر

## ١. متغيرات البيئة (Vercel → Settings → Environment Variables)

أضيفي هذي الستة على **Production** و **Preview**:

| المتغير | القيمة |
|---|---|
| `SESSION_SECRET` | ولّديها بالأمر تحت — **لا تُحفظ في الريبو** |
| `TWILIO_ACCOUNT_SID` | من Twilio Console (يبدأ بـ `AC`) |
| `TWILIO_AUTH_TOKEN` | من Twilio Console |
| `TWILIO_VERIFY_SERVICE_SID` | Verify Service SID (يبدأ بـ `VA`) — انظري خطوة ٢ |
| `APPLE_REVIEW_PHONE` | `99000000` (أي رقم وهمي مو مستخدم من أحد) |
| `APPLE_REVIEW_CODE` | كود من ٦ أرقام تختارينه (مثلاً `340011`) |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> ملاحظة: `SESSION_SECRET` لو تغيّر، كل المستخدمات تنطرد وتحتاج تحقق جديد.
> ما ينفع يتغيّر بعد الإطلاق إلا لضرورة أمنية.

## ٢. Twilio Verify Service

Verify مو نفس الـ Messaging. تحتاجين **Verify Service SID** جديد (يبدأ بـ `VA`):

Twilio Console → **Verify → Services → Create new**
- الاسم: `Daftary` (بدون أرقام — أسماء فيها ٥ أرقام أو أكثر تسبب خطأ 60200)
- طول الكود: 6

ثم في نفس الخدمة فعّلي قناة واتساب واختاري رقم المرسِل المسجّل عندك.

> **قالب واتساب الموجود عندك من التطبيق الثاني ما راح تحتاجينه.**
> Twilio Verify يستخدم قالب Meta الرسمي للتحقق تلقائياً وما يقبل قالب مخصص.
> اللي تحتاجينه فقط: رقم مرسِل واتساب مسجّل على الحساب.

## ٣. صلاحيات الدول

Verify → Settings → **Geo Permissions** → فعّلي **الكويت** فقط.
هذا يمنع استنزاف رصيدك بهجمات SMS pumping على أرقام دولية.

## ٤. اختبار قبل التقديم

1. سجّلي برقمك الحقيقي → لازم يوصل كود واتساب
2. أدخلي كود غلط → لازم تطلع «الكود غير صحيح»
3. أدخلي الكود الصحيح → تدخلين، وتبقين داخل حتى لو أقفلتي التطبيق
4. سجّلي خروج → لازم يطلب تحقق من جديد
5. جرّبي رقم المراجعة `99000000` بالكود `340011` → يدخل بدون ما يرسل شي

## ٥. بيانات مراجعة آبل

في App Store Connect → App Review Information:

- Sign-in required: ✅
- Username: `99000000`
- Password: `340011`

وأضيفي في Notes:

> The app signs in with a Kuwaiti phone number and a one-time code delivered by
> WhatsApp (with automatic SMS fallback). For App Review, use the dedicated demo
> number **99000000** with the fixed code **340011** — this number bypasses the
> WhatsApp/SMS delivery entirely, so no real device or WhatsApp account is needed.
> Enter 99000000 in the phone field, tap متابعة, then enter 340011 on the next
> screen. The session then stays signed in until the user explicitly signs out.
