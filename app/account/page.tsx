'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange, getUserProfile, signOutUser, deleteAccount, type UserProfile } from '@/lib/auth'
import { clearSeenWorks, type Difficulty } from '@/lib/works'
import { getCustomWorks, addCustomWork, deleteCustomWork, FREE_CUSTOM_LIMIT, CUSTOM_WORK_TYPES, CUSTOM_OTHER_TYPE, type CustomWork } from '@/lib/custom-works'
import { uploadImage } from '@/lib/storage'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { Logo } from '@/components/logo'
import { GradientBlobs } from '@/components/shared'
import { BottomNav } from '@/components/bottom-nav'
import { Gift, CreditCard, Trophy, Star, Check, RefreshCw, Upload } from 'lucide-react'

const C = WK_COLORS

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null | 'loading'>('loading')
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  useEffect(() => {
    return onAuthChange(async (user) => {
      if (!user) { router.replace('/login?next=/account'); return }
      setProfile(await getUserProfile(user.uid))
    })
  }, [router])

  if (profile === 'loading' || !profile) {
    return (
      <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `4px solid ${C.red}30`, borderTopColor: C.red, animation: 'wkspin 0.8s linear infinite' }} />
        <style>{`@keyframes wkspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const noBalance = profile.gamesBalance <= 0 && profile.freeGameUsed

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', maxWidth: 440, margin: '0 auto', padding: '20px 16px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo height={30} />
        </div>

        <Card>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{profile.name}</div>
          <div style={{ fontSize: 13, color: `${C.ink}88` }}>{profile.email}</div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 12, borderRadius: 20, padding: 20, background: '#fff', border: `1px solid ${C.violet}22`, boxShadow: `0 14px 34px ${C.violet}1c` }}>
          <div style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700 }}>رصيدك من الألعاب</div>
          <div style={{ fontSize: 48, fontWeight: 900, color: C.violet, margin: '6px 0' }}>{profile.gamesBalance}</div>
          {!profile.freeGameUsed && <div style={{ fontSize: 13, color: '#27AE78', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Gift size={14} /> عندك لعبة مجانية أول مرة</div>}
          {noBalance && <div style={{ fontSize: 13, color: C.red, fontWeight: 800 }}>ما عندك رصيد — اشترِ باقة عشان تلعب</div>}
          <a href="/packages" className="transition-transform hover:scale-[1.02] active:scale-[0.99]"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: 13, borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 15, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, textDecoration: 'none', boxShadow: `0 10px 24px ${C.red}33` }}>
            <CreditCard size={16} /> اشترِ باقة
          </a>
        </div>

        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700 }}>إجمالي المباريات</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{profile.totalGamesPlayed || 0}</div>
        </Card>

        <a href="/groups" className="transition-transform hover:scale-[1.01] active:scale-[0.99]"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: 14, borderRadius: 16, background: '#fff', border: `1px solid ${C.ink}12`, boxShadow: `0 8px 22px ${C.ink}0a`, textDecoration: 'none', color: C.ink, fontWeight: 800, fontSize: 14, textAlign: 'center' }}>
          <Trophy size={16} color={C.orange} /> لوحات الصدارة مع الأصدقاء
        </a>

        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700, marginBottom: 8 }}>الأعمال اللي شفتها</div>
          <p style={{ fontSize: 12, color: `${C.ink}77`, marginBottom: 10, lineHeight: 1.7 }}>
            اللعبة تتجنب تكرار نفس العمل بين مبارياتك. لو تبي تبدأ من جديد وتشوف كل الأعمال زي أول مرة:
          </p>
          <button onClick={async () => { setResetting(true); await clearSeenWorks(profile.id); setResetting(false); setResetDone(true); setTimeout(() => setResetDone(false), 2000) }}
            disabled={resetting}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: `1.5px solid ${C.violet}55`, background: `${C.violet}0d`, color: C.violet, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: resetting ? 0.6 : 1 }}>
            {resetDone ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={14} /> تم</span> : resetting ? '…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>نسيت الأعمال <RefreshCw size={14} /></span>}
          </button>
        </Card>

        <CustomWorksCard uid={profile.id} hasActiveBalance={!noBalance} />

        <button onClick={async () => { await signOutUser(); router.push('/') }}
          style={{ width: '100%', marginTop: 20, padding: 13, borderRadius: 12, border: `1.5px solid ${C.ink}22`, background: 'transparent', color: `${C.ink}cc`, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          تسجيل الخروج
        </button>

        <button onClick={async () => {
          if (!confirm('حذف الحساب نهائي وما يمكن التراجع عنه — أكيد تبي تحذفه؟')) return
          await deleteAccount(profile.id)
          router.push('/')
        }} style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: 'none', background: 'transparent', color: `${C.red}99`, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          حذف الحساب نهائياً
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, fontSize: 11, color: `${C.ink}55`, marginTop: 24 }}>
          <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>الشروط والأحكام</a>
          <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>الخصوصية</a>
          <a href="/refund" style={{ color: 'inherit', textDecoration: 'none' }}>الاسترجاع</a>
          <a href="/contact" style={{ color: 'inherit', textDecoration: 'none' }}>تواصل معنا</a>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

function CustomWorksCard({ uid, hasActiveBalance }: { uid: string; hasActiveBalance: boolean }) {
  const [works, setWorks] = useState<CustomWork[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState<string>(CUSTOM_WORK_TYPES[0])
  const [otherType, setOtherType] = useState('')
  const [country, setCountry] = useState('')
  const [hint, setHint] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [posterUrl, setPosterUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const inputStyle = { flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.ink}20`, background: C.cream, fontSize: 13, outline: 'none' } as const
  const reload = () => getCustomWorks(uid).then(setWorks)
  useEffect(() => { reload() }, [uid])

  const uploadPoster = async (file: File) => {
    setUploading(true); setErr('')
    try { setPosterUrl(await uploadImage(file, 'custom-works')) }
    catch (e) { setErr((e as Error).message) }
    setUploading(false)
  }

  const add = async () => {
    setErr('')
    if (!title.trim()) { setErr('اكتب اسم العمل'); return }
    if (type === CUSTOM_OTHER_TYPE && !otherType.trim()) { setErr('اكتب نوع العمل'); return }
    const res = await addCustomWork(uid, {
      title: title.trim(), type: type === CUSTOM_OTHER_TYPE ? otherType.trim() : type, country: country.trim() || null, hint: hint.trim(), difficulty, posterUrl,
    }, hasActiveBalance)
    if (!res.success) { setErr(res.error); return }
    setTitle(''); setCountry(''); setHint(''); setPosterUrl(''); reload()
  }

  return (
    <Card style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Star size={13} /> فئتي الخاصة</div>
      <p style={{ fontSize: 12, color: `${C.ink}77`, marginBottom: 10, lineHeight: 1.7 }}>
        أضف أعمالك أو أسماء ومواقف من عندك — تظهر كفئة إضافية وقت إعداد المباراة.
        {!hasActiveBalance && ` (حد ${FREE_CUSTOM_LIMIT} بدون رصيد نشط، بدون حد مع أي باقة)`}
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم العمل" style={inputStyle} />
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, flex: 'unset' }}>
          {CUSTOM_WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {type === CUSTOM_OTHER_TYPE && (
        <input value={otherType} onChange={e => setOtherType(e.target.value)} placeholder="اكتب نوع العمل (مثلاً: دعاء، أغنية، شخصية)" autoFocus style={{ ...inputStyle, width: '100%', marginBottom: 6 }} />
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={country} onChange={e => setCountry(e.target.value)} placeholder="البلد (اختياري)" style={inputStyle} />
        <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)} style={{ ...inputStyle, flex: 'unset' }}>
          <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
        </select>
      </div>
      <input value={hint} onChange={e => setHint(e.target.value)} placeholder="تلميح للمقدّم (اختياري)" style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <input value={posterUrl} onChange={e => setPosterUrl(e.target.value)} placeholder="رابط البوستر (اختياري، أو ارفع)" style={{ ...inputStyle, marginBottom: 0 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.ink}20`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {uploading ? '…' : <><Upload size={13} /> رفع</>}
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPoster(f) }} />
        </label>
      </div>
      {posterUrl && <img src={posterUrl} alt="" style={{ width: 50, borderRadius: 8, marginBottom: 8 }} />}
      {err && <p style={{ color: C.red, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{err}</p>}
      <button onClick={add} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, background: C.violet, cursor: 'pointer', marginBottom: works.length ? 12 : 0 }}>
        + أضف
      </button>
      {works.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
          {works.map(w => (
            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: C.cream, borderRadius: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {w.posterUrl ? <img src={w.posterUrl} alt="" width={22} height={30} style={{ borderRadius: 4, objectFit: 'cover' }} /> : null}
                <span>{w.title}</span>
                <span style={{ fontSize: 11, color: `${C.ink}66` }}>{[w.type, w.country].filter(Boolean).join(' · ')}</span>
              </div>
              <button onClick={async () => { await deleteCustomWork(uid, w.id); reload() }} style={{ color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>حذف</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 18, padding: 16, border: `1px solid ${C.ink}12`, boxShadow: `0 8px 22px ${C.ink}0a`, ...style }}>{children}</div>
}
