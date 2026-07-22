'use client'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { GradientBlobs } from '@/components/shared'

const C = WK_COLORS

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode }) {
  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto', padding: '24px 18px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.red }}>ولا كلمة</div>
          <a href="/" style={{ fontSize: 13, color: `${C.ink}88`, textDecoration: 'none' }}>← الرئيسية</a>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>{title}</h1>
        <p style={{ fontSize: 12, color: `${C.ink}66`, marginBottom: 20 }}>آخر تحديث: {updatedAt}</p>
        <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: `1px solid ${C.ink}12`, boxShadow: `0 10px 28px ${C.ink}0d`, lineHeight: 2, fontSize: 14, color: `${C.ink}dd` }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 6, color: C.ink }}>{title}</h2>
      <div>{children}</div>
    </div>
  )
}
