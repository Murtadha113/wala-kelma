'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/lib/auth'
import { getActivePackages, type Package } from '@/lib/packages'
import { WK_COLORS } from '@/lib/wala-kelma-content'

const C = WK_COLORS

export default function PackagesPage() {
  const router = useRouter()
  const [pkgs, setPkgs] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange(user => {
      if (!user) { router.replace('/login?next=/packages'); return }
    })
    getActivePackages().then(p => { setPkgs(p); setLoading(false) })
    return unsub
  }, [router])

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '20px 16px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.red }}>الباقات</div>
          <a href="/account" style={{ fontSize: 13, color: `${C.ink}88`, textDecoration: 'none' }}>← حسابي</a>
        </div>

        {loading && <p style={{ textAlign: 'center', color: `${C.ink}88` }}>جاري التحميل…</p>}
        {!loading && pkgs.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 20, textAlign: 'center', border: `1px solid ${C.ink}12` }}>
            <p style={{ color: `${C.ink}88` }}>لا توجد باقات متاحة حالياً</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pkgs.map(p => (
            <div key={p.id} onClick={() => router.push(`/packages/pay?packageId=${p.id}`)}
              style={{
                cursor: 'pointer', position: 'relative', background: '#fff', borderRadius: 18, padding: 18,
                border: `2px solid ${p.isFeatured ? C.orange : `${C.ink}12`}`,
              }}>
              {p.isFeatured && (
                <div style={{ position: 'absolute', top: -10, right: 16, background: C.orange, color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 999 }}>
                  الأكثر مبيعاً 🔥
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{p.nameAr}</div>
                  <div style={{ fontSize: 13, color: `${C.ink}88`, marginTop: 2 }}>{p.descriptionAr}</div>
                  <div style={{ fontSize: 13, color: C.violet, fontWeight: 800, marginTop: 6 }}>
                    {p.gamesCount} لعبة{p.expiryDays ? ` · صالحة ${p.expiryDays} يوم` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  {p.oldPrice && <div style={{ fontSize: 13, color: `${C.ink}55`, textDecoration: 'line-through' }}>{p.oldPrice.toFixed(3)} د.ب</div>}
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.red }}>{p.price.toFixed(3)}</div>
                  <div style={{ fontSize: 11, color: `${C.ink}66` }}>د.ب</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
