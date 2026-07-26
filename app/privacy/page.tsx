import { LegalPage, Section } from '@/components/legal-page'
import { AlertTriangle } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <LegalPage title="سياسة الخصوصية" updatedAt="2026-07-20">
      <Section title="1. البيانات اللي نجمعها">
        الاسم، الإيميل، ورقم الجوال (إن أدخلته). صور إيصالات الدفع وقت شراء باقة. أسماء اللاعبين اللي تدخلها بالمباريات (بدون بيانات شخصية إضافية عنهم).
      </Section>
      <Section title="2. كيف نستخدم بياناتك">
        لإدارة حسابك ورصيدك، لمعالجة طلبات الشراء والتحقق منها، ولتحسين تجربة اللعب (مثل تجنب تكرار نفس المحتوى).
      </Section>
      <Section title="3. مشاركة البيانات">
        ما نبيع ولا نشارك بياناتك مع أي طرف ثالث لأغراض تسويقية. الصور (البوسترات، الإيصالات) تُخزَّن عبر مزوّد استضافة صور خارجي (ImgBB) لأغراض تقنية بحتة.
      </Section>
      <Section title="4. أمان الإيصالات">
        إيصالات الدفع بيانات حساسة — الوصول لها مقيّد بلوحة الأدمن فقط.
      </Section>
      <Section title="5. حقوقك">
        تقدر تطلب حذف حسابك وبياناته بالكامل من صفحة "حسابي" بأي وقت.
      </Section>
      <Section title="6. التواصل">
        لأي استفسار عن الخصوصية، تواصل معنا عبر وسائل الدعم المتوفرة بالتطبيق.
      </Section>
      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>هذا نص عام مبدئي وليس استشارة قانونية — راجعه مع مختص قانوني قبل الإطلاق التجاري.</span>
      </p>
    </LegalPage>
  )
}
