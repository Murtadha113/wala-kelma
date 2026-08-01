'use client'

// شريط تنقّل رئيسي — 3 وجهات: الرئيسية / سجل الألعاب / حسابي، بنفس تصميم الصندوق البنفسجي
import { usePathname, useRouter } from 'next/navigation'
import { Home, History, User } from 'lucide-react'
import { WK_COLORS } from '@/lib/wala-kelma-content'

const C = WK_COLORS

const TABS = [
  { href: '/', label: 'الرئيسية', Icon: Home },
  { href: '/history', label: 'سجل الألعاب', Icon: History },
  { href: '/account', label: 'حسابي', Icon: User },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <section style={{ maxWidth: 640, margin: '0 auto', padding: '10px 20px 40px' }}>
      <div style={{
        display: 'flex', gap: 6, padding: 8, borderRadius: 24,
        background: `linear-gradient(135deg, ${C.violet}, #4726c9)`, boxShadow: `0 14px 34px ${C.violet}33`,
      }}>
        {TABS.map(t => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)
          return (
            <button key={t.href} onClick={() => router.push(t.href)}
              className="transition-transform active:scale-[0.97]"
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '12px 4px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: '#fff', fontWeight: 800, fontSize: 12,
              }}>
              <t.Icon size={20} />
              {t.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
