# ولا كلمة 🎭

لعبة التمثيل الصامت (بانتومايم) — فريقان يتنافسان، لاعب يمثّل عملاً (فيلم/مسلسل/مسرحية/مثل شعبي) **بدون نطق أي كلمة**، وفريقه يخمّن خلال وقت محدد. لو ما خمّنوا، الفريق المنافس يحصل على **10 ثواني سرقة**. تشمل الخصائص (Power-Ups)، الجوكر، الجولات، والجولة الفاصلة.

**مشروع مستقل تماماً** (لا علاقة له بأي مشروع آخر). يعمل بشاشتين متزامنتين:
- **شاشة المقدّم** (`/host`) — لوحة التحكم الوحيدة (جوال المقدّم).
- **شاشة العرض** (`/display?code=XXXX`) — للتلفاز/اللابتوب، عرض فقط، ما تُظهر اسم العمل.

## التقنيات
- Next.js 16 (App Router) + React 19 + TypeScript
- Firebase: **Firestore** (المحتوى) + **Realtime Database** (تزامن الغرف) + Storage (اختياري)
- Tailwind CSS v4

## الإعداد

### 1) تثبيت الحزم
```bash
npm install
```

### 2) إنشاء مشروع Firebase
1. افتح [Firebase Console](https://console.firebase.google.com/) → أنشئ مشروعاً جديداً خاصاً بـ "ولا كلمة".
2. **Firestore Database** → أنشئ قاعدة (Production/Test mode).
3. **Realtime Database** → أنشئ قاعدة → انسخ رابطها (databaseURL).
4. Project settings → General → Your apps → Web app → انسخ إعدادات SDK.

### 3) متغيرات البيئة
انسخ `.env.local.example` إلى `.env.local` واملأ القيم:
```bash
cp .env.local.example .env.local
```
- بيانات Firebase الستة + `NEXT_PUBLIC_FIREBASE_DATABASE_URL` (رابط الـ Realtime Database).
- `NEXT_PUBLIC_ADMIN_PASSCODE` — كلمة مرور لوحة الأدمن.

الصور (بوسترات الأعمال، صور الفئات، إيصالات الدفع) تُرفع مباشرة إلى **Firebase Storage** الخاص بنفس المشروع — لا تحتاج مفتاح أو إعداد خارجي إضافي.

### 4) قواعد الأمان (مبدئية للتجربة)
Firestore و Realtime Database — للتجربة السريعة اسمح بالقراءة/الكتابة، ثم شدّد لاحقاً:
```
// Realtime Database rules
{ "rules": { ".read": true, ".write": true } }
```

### 5) التشغيل
```bash
npm run dev
```
افتح http://localhost:3000

## أول استخدام
1. افتح `/admin` (كلمة المرور من `.env.local`) → تبويب **الفئات** → "زرع الفئات الثماني الافتراضية".
2. تبويب **الأعمال** → أضف أعمالاً (أو **استيراد CSV** دفعة واحدة).
3. ارجع للرئيسية → **سوّ مباراة جديدة** → اربط شاشة العرض بالـ QR/الكود → اختر الفئات → أدخل الفرق واللاعبين → ابدأ.

## البنية
```
app/
  page.tsx            الرئيسية (مقدّم / شاشة عرض)
  host/page.tsx       شاشة المقدّم (إعداد + تحكم)
  display/page.tsx    شاشة العرض (قراءة فقط)
  admin/page.tsx      إدارة المحتوى (أعمال/فئات/CSV)
lib/
  firebase.ts         تهيئة Firebase
  wala-kelma.ts       محرّك اللعبة (Realtime DB)
  works.ts            الفئات والأعمال (Firestore)
  wala-kelma-content.ts  الإعدادات والخصائص والهوية
  sound.ts / code.ts
components/shared.tsx  المؤقّت والعناصر المشتركة
```
