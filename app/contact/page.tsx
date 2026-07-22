'use client'

import { useEffect, useState } from 'react'
import { getContactSettings, type ContactSettings } from '@/lib/contact'
import { WK_COLORS } from '@/lib/wala-kelma-content'

const C = WK_COLORS

const ROWS: { key: keyof ContactSettings; label: string; icon: string; href: (v: string) => string }[] = [
  { key: 'phone', label: 'الهاتف', icon: '📞', href: v => `tel:${v}` },
  { key: 'whatsapp', label: 'واتساب', icon: '💬', href: v => `https://wa.me/${v.replace(/[^0-9]/g, '')}` },
  { key: 'email', label: 'الإيميل', icon: '📧', href: v => `mailto:${v}` },
  { key: 'instagram', label: 'إنستغرام', icon: '📷', href: v => `https://instagram.com/${v.replace('@', '')}` },
  { key: 'twitter', label: 'X (تويتر)', icon: '𝕏', href: v => `https://x.com/${v.replace('@', '')}` },
  { key: 'snapchat', label: 'سناب شات', icon: '👻', href: v => `https://snapchat.com/add/${v.replace('@', '')}` },
]

export default function ContactPage() {
  const [s, setS] = useState<ContactSettings | null>(null)
  useEffect(() => { getContactSettings().then(setS) }, [])

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 18px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.red }}>ولا كلمة</div>
          <a href="/" style={{ fontSize: 13, color: `${C.ink}88`, textDecoration: 'none' }}>← الرئيسية</a>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10 }}>تواصل معنا</h1>
        {s && <p style={{ fontSize: 14, color: `${C.ink}99`, marginBottom: 22, lineHeight: 1.8 }}>{s.intro}</p>}

        {!s && <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: `1px solid ${C.ink}12` }}>جاري التحميل…</div>}

        {s && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ROWS.filter(r => s[r.key]?.trim()).map(r => (
              <a key={r.key} href={r.href(s[r.key])} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16,
                  padding: '14px 16px', border: `1px solid ${C.ink}12`, textDecoration: 'none', color: C.ink,
                }}>
                <span style={{ fontSize: 22 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: `${C.ink}66` }}>{r.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{s[r.key]}</div>
                </div>
              </a>
            ))}
            {ROWS.every(r => !s[r.key]?.trim()) && (
              <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: `1px solid ${C.ink}12`, textAlign: 'center', color: `${C.ink}66` }}>
                ما فيه وسائل تواصل مضافة حالياً.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
