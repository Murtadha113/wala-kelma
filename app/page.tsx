'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange, type UserProfile, getUserProfile } from '@/lib/auth'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { Logo } from '@/components/logo'

const C = WK_COLORS

const HOW_TO_PLAY = [
  { emoji: '🎬', title: 'يطلع لك عمل', desc: 'فيلم، مسلسل، مسرحية، أو مثل شعبي — يظهر لك أنت بس' },
  { emoji: '🤐', title: 'مثّله بصمت', desc: 'بدون ما تنطق ولا كلمة، فريقك يحاول يخمّن خلال الوقت' },
  { emoji: '⚡', title: 'استخدم الخصائص', desc: 'مضاعفة النقطة، إسكات لاعب، أو الجوكر لتقلب الموازين' },
  { emoji: '🥷', title: 'أو اسرقها', desc: 'لو ما خمّن فريقك، الفريق المنافس يسرق النقطة بـ10 ثواني' },
]

const FEATURES = [
  { emoji: '📺', title: 'شاشتين متزامنتين', desc: 'شاشة للمقدّم وشاشة عرض للتلفاز — تتزامنان لحظياً' },
  { emoji: '🎭', title: 'فئات متنوعة', desc: 'أفلام، مسلسلات، مسرحيات خليجية وعربية وأجنبية، وأمثال شعبية' },
  { emoji: '⭐', title: 'فئتك الخاصة', desc: 'أضف أعمال وأسماء من عندك تخص شلتك أو عائلتك' },
  { emoji: '🏆', title: 'أفضل ممثل + صدارة', desc: 'شارك النتيجة، وتابع لوحة الصدارة مع أصدقائك شهرياً' },
]

export default function LandingPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    return onAuthChange(async (user) => {
      setProfile(user ? await getUserProfile(user.uid) : null)
    })
  }, [])

  return (
    <div dir="rtl" style={{ background: C.cream, overflowX: 'hidden' }}>
      {/* ── الشريط العلوي ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: `${C.cream}ee`, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.ink}0d` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo height={34} />
          {profile ? (
            <a href="/account" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: C.violet, textDecoration: 'none', background: '#fff', padding: '7px 12px', borderRadius: 999, border: `1px solid ${C.ink}12` }}>
              👤 {profile.name} · {profile.gamesBalance} 🎮
            </a>
          ) : (
            <a href="/login" style={{ fontSize: 12, fontWeight: 800, color: C.violet, textDecoration: 'none', background: '#fff', padding: '7px 14px', borderRadius: 999, border: `1px solid ${C.ink}12` }}>
              تسجيل الدخول
            </a>
          )}
        </div>
      </div>

      {/* ── القسم الرئيسي (Hero) ── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -140, right: -100, width: 380, height: 380, borderRadius: '50%', background: `${C.orange}22`, filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: 60, left: -120, width: 320, height: 320, borderRadius: '50%', background: `${C.violet}1c`, filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -100, right: '30%', width: 260, height: 260, borderRadius: '50%', background: `${C.red}14`, filter: 'blur(60px)' }} />

        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto', padding: 'clamp(32px,8vw,64px) 20px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Logo height={110} priority />
          </div>
          <p style={{ fontSize: 'clamp(15px,4vw,18px)', color: `${C.ink}aa`, fontWeight: 700, marginTop: 6, lineHeight: 1.6 }}>
            لعبة التمثيل الصامت اللي تحمّس كل مجلس 🔥<br />مثّل بدون ما تنطق… وخلّهم يخمّنون
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {['🎬 أفلام', '📺 مسلسلات', '🎭 مسرحيات', '💬 أمثال شعبية'].map(t => (
              <span key={t} style={{ background: '#fff', border: `1px solid ${C.ink}14`, borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 800, color: `${C.ink}99` }}>{t}</span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28, maxWidth: 360, marginInline: 'auto' }}>
            <div className="group cursor-pointer" style={{ position: 'relative' }} onClick={() => router.push('/host')}>
              <div style={{ position: 'absolute', inset: -4, borderRadius: 24, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, filter: 'blur(16px)', opacity: 0.4 }}
                className="group-hover:opacity-70 transition-opacity duration-500" />
              <div style={{ position: 'relative', width: '100%', padding: '20px', borderRadius: 20, textAlign: 'center',
                background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, color: '#fff', boxShadow: '0 8px 24px rgba(218,35,66,0.25)' }}
                className="flex flex-col items-center gap-1 transition-transform hover:scale-[1.02] active:scale-[0.99]">
                <div style={{ fontSize: 26 }}>🎭</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>سوّ مباراة جديدة</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>أنشئ مباراة، اربط شاشة العرض، وابدأوا اللعب</div>
              </div>
            </div>

            <details style={{ background: '#fff', borderRadius: 18, border: `1px solid ${C.ink}14`, overflow: 'hidden' }}>
              <summary style={{ padding: '14px 18px', fontSize: 13, fontWeight: 800, color: `${C.ink}99`, cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                📺 عندك كود مباراة؟ افتح شاشة العرض
              </summary>
              <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="A B 3 D"
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${C.ink}20`, color: C.ink,
                    fontWeight: 900, fontSize: 24, textAlign: 'center', letterSpacing: '0.4em', background: C.cream, outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && code.length === 4 && router.push(`/display?code=${code}`)}
                />
                <button onClick={() => router.push(`/display?code=${code}`)} disabled={code.length < 4}
                  className="transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ width: '100%', padding: 14, borderRadius: 12, color: '#fff', border: 'none', fontWeight: 800, fontSize: 14,
                    background: `linear-gradient(135deg, ${C.violet}, #4726c9)`, opacity: code.length < 4 ? 0.4 : 1, cursor: 'pointer' }}>
                  افتح شاشة العرض
                </button>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ── كيف تلعب ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 8px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(20px,5vw,26px)', fontWeight: 900, color: C.ink, marginBottom: 4 }}>كيف تلعب؟</h2>
        <p style={{ textAlign: 'center', fontSize: 13, color: `${C.ink}77`, marginBottom: 24 }}>4 خطوات بس، وأنتوا بحماس كامل</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {HOW_TO_PLAY.map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 20, padding: '20px 16px', border: `1px solid ${C.ink}10`, textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 11, fontWeight: 900, color: `${C.ink}30` }}>{i + 1}</div>
              <div style={{ fontSize: 34, marginBottom: 8 }}>{s.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: `${C.ink}88`, lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── المزايا ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fff', borderRadius: 20, padding: 18, border: `1px solid ${C.ink}10`,
            }}>
              <div style={{ fontSize: 28, flexShrink: 0, width: 46, height: 46, borderRadius: 14, background: `${[C.red, C.violet, C.orange, C.red][i % 4]}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.emoji}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: `${C.ink}88`, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── دعوة ختامية ── */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '10px 20px 40px', textAlign: 'center' }}>
        <div style={{ background: `linear-gradient(135deg, ${C.violet}, #4726c9)`, borderRadius: 24, padding: '28px 24px', color: '#fff' }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>جهّز الشلة وابدأوا الآن 🎉</div>
          <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 18 }}>لعبة مجانية أول تسجيل — بدون ما تدفع ريال</p>
          <button onClick={() => router.push(profile ? '/host' : '/signup')}
            className="transition-transform hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: '#fff', color: C.violet, border: 'none', borderRadius: 14, padding: '14px 32px', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
            {profile ? '🎭 ابدأ اللعب' : '🎁 جرّبها مجاناً'}
          </button>
        </div>
      </section>

      {/* ── فوتر ── */}
      <footer style={{ borderTop: `1px solid ${C.ink}0d`, padding: '20px 20px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, fontSize: 11, color: `${C.ink}55` }}>
            <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>الشروط والأحكام</a>
            <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>الخصوصية</a>
            <a href="/refund" style={{ color: 'inherit', textDecoration: 'none' }}>الاسترجاع</a>
            <a href="/contact" style={{ color: 'inherit', textDecoration: 'none' }}>تواصل معنا</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
