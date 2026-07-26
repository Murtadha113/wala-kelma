import { LegalPage, Section } from '@/components/legal-page'
import { AlertTriangle } from 'lucide-react'

export default function RefundPage() {
  return (
    <LegalPage title="سياسة الاسترجاع" updatedAt="2026-07-20">
      <Section title="1. عام">
        بما إن الباقات رصيد رقمي يُستهلك فور بدء كل مباراة، الاسترجاع غير متاح بعد استخدام أي جزء من الرصيد.
      </Section>
      <Section title="2. رصيد غير مُستخدم">
        لو ما استخدمت أي لعبة من الباقة المشتراة خلال 48 ساعة من الشراء، تقدر تطلب استرجاع كامل المبلغ بالتواصل مع الدعم.
      </Section>
      <Section title="3. خطأ بالدفع">
        لو حوّلت مبلغ خطأ أو تكرر التحويل بالخطأ، تواصل معنا فوراً بإيصال التحويل وسنراجع الحالة يدوياً.
      </Section>
      <Section title="4. رفض الطلب">
        لو رُفض طلب شرائك (إيصال غير واضح أو غير صحيح)، ما يُخصم أي مبلغ ولا يُمنح رصيد.
      </Section>
      <Section title="5. مدة المعالجة">
        طلبات الاسترجاع المقبولة تُعالج خلال 3-5 أيام عمل.
      </Section>
      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>هذا نص عام مبدئي وليس استشارة قانونية — راجعه مع مختص قانوني قبل الإطلاق التجاري.</span>
      </p>
    </LegalPage>
  )
}
