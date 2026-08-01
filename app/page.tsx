'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange, type UserProfile, getUserProfile } from '@/lib/auth'
import { WK_COLORS, WK_POWERUPS } from '@/lib/wala-kelma-content'
import { Logo } from '@/components/logo'
import { BottomNav } from '@/components/bottom-nav'
import { getBanners, type BannerItem } from '@/lib/banners'
import {
  Clapperboard, Tv, Drama, VolumeX, Zap, Swords,
  Smartphone, HelpCircle, X, User, Gamepad2, ChevronDown,
} from 'lucide-react'

const C = WK_COLORS

const HOW_TO_PLAY = [
  { Icon: Clapperboard, title: 'يطلع لك عمل', desc: 'فيلم، مسلسل، مسرحية، أو مثل شعبي — يظهر لك أنت بس' },
  { Icon: VolumeX, title: 'مثّله بصمت', desc: 'بدون ما تنطق ولا كلمة، فريقك يحاول يخمّن خلال الوقت' },
  { Icon: Zap, title: 'استخدم الخصائص', desc: 'مضاعفة النقطة، إسكات لاعب، أو الجوكر لتقلب الموازين' },
  { Icon: Swords, title: 'أو اسرقها', desc: 'لو ما خمّن فريقك، الفريق المنافس يسرق النقطة بـ10 ثواني' },
]

const SCREENS_GUIDE = [
  {
    Icon: Smartphone, title: 'شاشة المقدّم (الهاتف)', badge: '١',
    desc: 'يفتحها الشخص اللي يمسك الجوال ويدير اللعبة — فيها كل أزرار التحكم: بدء الدور، صح/غلط، السرقة، الخصائص، والإيقاف المؤقت.',
    steps: ['اضغط "ابدأ اللعبة" من الرئيسية', 'اختر الفئات وسجّل أسماء الفرق واللاعبين', 'ابدأ المباراة وتحكّم بكل خطوة من نفس الشاشة'],
  },
  {
    Icon: Tv, title: 'شاشة العرض (تلفاز/لابتوب)', badge: '٢',
    desc: 'تفتح على شاشة كبيرة يشوفها الكل — تعرض بس (بدون أي أزرار تحكم): كود المباراة، الفرق، والنتيجة الحية.',
    steps: ['من شاشة المقدّم، انسخ رابط العرض أو امسح الـQR', 'افتحه على تلفاز أو لابتوب متصل بالواي فاي نفسه', 'يتزامن تلقائياً مع كل حركة يسويها المقدّم'],
  },
]

const HELP_TOOLS = [
  ...WK_POWERUPS.map(p => ({ Icon: p.icon, title: p.name, desc: p.desc, when: p.preTurn ? 'تفعّلها قبل بداية دور فريقك' : 'تفعّلها أي وقت خلال دوركم' })),
]

type ModalKey = 'how' | 'screens' | 'help' | null

const INFO_CARDS = [
  { key: 'how' as const, Icon: HelpCircle, title: 'كيف تلعب؟' },
  { key: 'screens' as const, Icon: Tv, title: 'تشغيل الشاشتين' },
  { key: 'help' as const, Icon: Zap, title: 'وسائل المساعدة' },
]

function BannerCarousel({ items }: { items: BannerItem[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const t = setInterval(() => setI(p => (p + 1) % items.length), 4000)
    return () => clearInterval(t)
  }, [items.length])

  // نسبة ثابتة 7:3 (تطابق أبعاد صور البنر الحالية 2688×1152) بدل ارتفاع ثابت — يعرض الصورة كاملة بلا قص، وبنفس الشكل على كل الشاشات
  const img = <img src={items[i].imageUrl} alt="" style={{ width: '100%', aspectRatio: '7 / 3', objectFit: 'cover', borderRadius: 18, display: 'block' }} />
  return (
    <div style={{ marginTop: 14 }}>
      {items[i].linkUrl ? <a href={items[i].linkUrl} style={{ display: 'block' }}>{img}</a> : img}
      {items.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          {items.map((b, idx) => (
            <span key={b.id} style={{ width: 6, height: 6, borderRadius: '50%', background: idx === i ? C.violet : `${C.ink}22` }} />
          ))}
        </div>
      )}
    </div>
  )
}

function InfoModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: '24px 16px' }} onClick={onClose}>
      <div className="wk-pop-in" onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 24, padding: '18px 20px 22px', width: '100%', maxWidth: 480,
        maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, position: 'sticky', top: 0, background: C.cream, paddingTop: 2 }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: C.ink, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: `${C.ink}0d`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} color={`${C.ink}99`} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [openModal, setOpenModal] = useState<ModalKey>(null)
  const [banners, setBannersState] = useState<BannerItem[]>([])

  useEffect(() => {
    return onAuthChange(async (user) => {
      setProfile(user ? await getUserProfile(user.uid) : null)
    })
  }, [])

  useEffect(() => {
    getBanners().then(setBannersState)
  }, [])

  return (
    <div dir="rtl" style={{ background: C.cream, overflowX: 'hidden' }}>
      {/* ── الشريط العلوي ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: `${C.cream}ee`, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.ink}0d` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo height={34} />
          {profile ? (
            <a href="/account" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: C.violet, textDecoration: 'none', background: '#fff', padding: '7px 12px', borderRadius: 999, border: `1px solid ${C.ink}12` }}>
              <User size={13} /> {profile.name} · {profile.gamesBalance} <Gamepad2 size={13} />
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
          {banners.length > 0 && <BannerCarousel items={banners} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28, maxWidth: 360, marginInline: 'auto' }}>
            <div className="group cursor-pointer" style={{ position: 'relative' }} onClick={() => router.push('/host')}>
              <div style={{ position: 'absolute', inset: -4, borderRadius: 24, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, filter: 'blur(16px)', opacity: 0.4 }}
                className="group-hover:opacity-70 transition-opacity duration-500" />
              <div style={{ position: 'relative', width: '100%', padding: '20px', borderRadius: 20, textAlign: 'center',
                background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, color: '#fff', boxShadow: '0 8px 24px rgba(218,35,66,0.25)' }}
                className="flex flex-col items-center gap-1 transition-transform hover:scale-[1.02] active:scale-[0.99]">
                <Drama size={26} />
                <div style={{ fontWeight: 900, fontSize: 18 }}>ابدأ اللعبة</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>أنشئ مباراة، اربط شاشة العرض، وابدأوا اللعب</div>
              </div>
            </div>

            <details className="wk-code-details wk-breathe" style={{
              background: `${C.violet}0c`, borderRadius: 18, border: `1.5px solid ${C.violet}33`, overflow: 'hidden',
              ['--wk-glow' as string]: `${C.violet}40`,
            } as React.CSSProperties}>
              <summary style={{ padding: '14px 18px', fontSize: 13, fontWeight: 800, color: C.violet, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.violet}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Tv size={14} />
                </span>
                <span style={{ flex: 1 }}>عندك كود مباراة؟ افتح شاشة العرض</span>
                <ChevronDown size={16} className="wk-chevron" style={{ transition: 'transform 0.25s ease', flexShrink: 0 }} />
              </summary>
              <div className="wk-slide-up" style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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

      {/* ── كروت المعلومات (تفتح شاشة منبثقة) ── */}
      <section style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 8px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {INFO_CARDS.map(item => (
            <button key={item.key} onClick={() => setOpenModal(item.key)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              background: '#fff', borderRadius: 18, padding: '18px 8px', border: `1px solid ${C.ink}10`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <item.Icon size={24} color={C.violet} />
              <span style={{ fontSize: 12, fontWeight: 800, color: C.ink, textAlign: 'center' }}>{item.title}</span>
            </button>
          ))}
        </div>
      </section>

      {openModal === 'how' && (
        <InfoModal title="كيف تلعب؟" onClose={() => setOpenModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {HOW_TO_PLAY.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 12, background: `${C.red}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.Icon size={18} color={C.red} />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{i + 1}. {s.title}</div>
                  <div style={{ fontSize: 12.5, color: `${C.ink}88`, lineHeight: 1.6, marginTop: 2 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </InfoModal>
      )}

      {openModal === 'screens' && (
        <InfoModal title="طريقة تشغيل الشاشتين" onClose={() => setOpenModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {SCREENS_GUIDE.map((s, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: `${C.violet}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.Icon size={17} color={C.violet} />
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{s.title}</div>
                </div>
                <div style={{ fontSize: 12.5, color: `${C.ink}88`, lineHeight: 1.7, marginBottom: 8 }}>{s.desc}</div>
                <ol style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {s.steps.map((step, si) => (
                    <li key={si} style={{ fontSize: 12, color: `${C.ink}99`, lineHeight: 1.6 }}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </InfoModal>
      )}

      {openModal === 'help' && (
        <InfoModal title="وسائل المساعدة" onClose={() => setOpenModal(null)}>
          <p style={{ fontSize: 12.5, color: `${C.ink}77`, marginTop: -6, marginBottom: 14 }}>خصائص تقلب موازين اللعبة — كل فريق يقدر يستخدمها مرة كل دور</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {HELP_TOOLS.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 12, background: `${C.violet}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <h.Icon size={18} color={C.violet} />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{h.title}</div>
                  <div style={{ fontSize: 12.5, color: `${C.ink}88`, lineHeight: 1.6, marginTop: 2 }}>{h.desc}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.violet, marginTop: 3 }}>{h.when}</div>
                </div>
              </div>
            ))}
          </div>
        </InfoModal>
      )}

      <BottomNav />
    </div>
  )
}
