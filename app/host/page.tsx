'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { onAuthChange, getUserProfile, type UserProfile } from '@/lib/auth'
import { getCategories, WKCategory } from '@/lib/works'
import { getCustomWorksCount, CUSTOM_CATEGORY_ID, CUSTOM_CATEGORY_NAME } from '@/lib/custom-works'
import {
  createWalaKelmaRoom, subscribeToWalaKelmaRoom, updateWKHostHeartbeat,
  updateMatchSetup, startMatch, beginPlaying, startTurn, beginActing, markCorrect, markWrong,
  onStealTimeUp, nextTurn, continueAfterRound, activatePowerUp, deactivatePowerUp, useJoker, undoJoker, togglePause, resetPhaseTimer,
  toggleQuestionHidden, adjustScore, skipTurn, cancelMatch, deleteWalaKelmaRoom, setRoomRedirect, getBestActor,
  WalaKelmaRoom, TeamId, WKPlayer,
} from '@/lib/wala-kelma'
import { WK_COLORS, WK_EXPLAIN_OPTIONS, WK_ROUND_OPTIONS, WK_MAX_CATEGORIES, WK_POWERUPS, WK_QUICK_EXPLAIN, typeLabelForCategory } from '@/lib/wala-kelma-content'
import { useWalaKelmaCountdown, useResultSounds, useWakeLock, PHASE_LABEL, GradientBlobs, Confetti } from '@/components/shared'
import { playDrumRollSound } from '@/lib/sound'
import { ShareResultButton } from '@/components/share-result'
import { Logo } from '@/components/logo'
import {
  BookOpen, Drama, Swords, Dices, Zap, Check, AlertTriangle, Eye, EyeOff,
  Play, Pause, Trophy, Frown, ArrowLeft, Clapperboard,
} from 'lucide-react'

const C = WK_COLORS
const uid = () => `p_${Math.random().toString(36).slice(2, 9)}`

function HostPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const resumeCode = params.get('resume')
  const [profile, setProfile] = useState<UserProfile | null | 'loading'>('loading')
  const [room, setRoom] = useState<WalaKelmaRoom | null>(null)
  const [error, setError] = useState('')
  const creatingRef = useRef(false)

  // بوابة الدخول — لازم حساب حقيقي عشان نقدر نخصم/نستهلك اللعبة المجانية
  useEffect(() => {
    return onAuthChange(async (user) => {
      if (!user) { router.replace('/login?next=/host'); return }
      const p = await getUserProfile(user.uid)
      setProfile(p)
    })
  }, [router])

  useEffect(() => {
    if (profile === 'loading' || !profile) return
    // "resume" = غرفة جديدة انسوّت مسبقاً (زر "مباراة جديدة" بعد مباراة سابقة) — نتصل فيها مباشرة بدون إنشاء وحدة زيادة.
    // لازم تشتغل حتى لو "creatingRef" مسبوق: التنقّل لـ /host?resume=... يعيد رندر نفس الصفحة بدون remount
    if (resumeCode) { setRoom(null); return subscribeToWalaKelmaRoom(resumeCode, r => { if (r) setRoom(r) }) }
    if (creatingRef.current) return
    creatingRef.current = true
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const res = await createWalaKelmaRoom({ hostId: profile.id, hostName: profile.name })
      if (!res.success) { setError(res.error); return }
      if (cancelled) return
      unsub = subscribeToWalaKelmaRoom(res.code, r => { if (r) setRoom(r) })
    })()
    return () => { cancelled = true; unsub?.() }
  }, [profile, resumeCode])

  useEffect(() => {
    if (!room?.code) return
    updateWKHostHeartbeat(room.code)
    const t = setInterval(() => updateWKHostHeartbeat(room.code), 5000)
    return () => clearInterval(t)
  }, [room?.code])

  const timeLeft = useWalaKelmaCountdown(room, true)
  useResultSounds(room)
  useWakeLock(!!room && room.status !== 'finished')

  if (profile === 'loading') return <Loading />
  if (error) return <ErrorScreen msg={error} onBack={() => router.push('/')} />
  if (!room) return <Loading />

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto', padding: '16px 14px 40px' }}>
        {room.status === 'setup' && <SetupWizard room={room} />}
        {room.status === 'draw' && <DrawScreen room={room} />}
        {room.status === 'playing' && <ControlPanel room={room} timeLeft={timeLeft} />}
        {room.status === 'finished' && <FinishedScreen room={room} onNew={async () => {
          const res = await createWalaKelmaRoom({ hostId: room.hostId, hostName: room.hostName })
          if (!res.success) { deleteWalaKelmaRoom(room.code); location.reload(); return }
          await setRoomRedirect(room.code, res.code)
          await deleteWalaKelmaRoom(room.code)
          router.push(`/host?resume=${res.code}`)
        }} />}
      </div>
    </div>
  )
}

export default function HostPage() {
  return <Suspense fallback={<Loading />}><HostPageInner /></Suspense>
}

// ═══════════════ SETUP ═══════════════
function SetupWizard({ room }: { room: WalaKelmaRoom }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [cats, setCats] = useState<WKCategory[]>([])
  const [customCount, setCustomCount] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [matchName, setMatchName] = useState('')
  const [teamAName, setTeamAName] = useState('الفريق الأول')
  const [teamBName, setTeamBName] = useState('الفريق الثاني')
  const [distMode, setDistMode] = useState<'manual' | 'random'>('manual')
  const [allPlayers, setAllPlayers] = useState<string[]>(['', '', '', ''])
  const [distributed, setDistributed] = useState(false)
  const [aPlayers, setAPlayers] = useState<string[]>(['', ''])
  const [bPlayers, setBPlayers] = useState<string[]>(['', ''])
  const [explain, setExplain] = useState<60 | 90 | 105>(90)
  const [rounds, setRounds] = useState<number>(2)
  const [quickMode, setQuickMode] = useState(false)
  const [namesEnabled, setNamesEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => { getCategories(true).then(setCats) }, [])
  useEffect(() => { getCustomWorksCount(room.hostId).then(setCustomCount) }, [room.hostId])

  const toggleCat = (id: string) => setSelected(prev =>
    prev.includes(id) ? prev.filter(c => c !== id) : prev.length >= WK_MAX_CATEGORIES ? prev : [...prev, id])

  const distributeRandomly = () => {
    const names = allPlayers.map(s => s.trim()).filter(Boolean)
    const shuffled = [...names].sort(() => Math.random() - 0.5)
    const a: string[] = [], b: string[] = []
    shuffled.forEach((n, i) => (i % 2 === 0 ? a : b).push(n))
    setAPlayers(a.length ? a : ['']); setBPlayers(b.length ? b : [''])
    setDistributed(true)
  }

  // نبث نتيجة التوزيع العشوائي لشاشة العرض أول بأول، عشان الفريقين يتأكدون منها قبل بداية المباراة —
  // ونحدّثها لو المقدّم عدّل الأسماء بعد التوزيع
  useEffect(() => {
    if (distMode !== 'random' || !distributed) return
    const A = aPlayers.map(s => s.trim()).filter(Boolean)
    const B = bPlayers.map(s => s.trim()).filter(Boolean)
    updateMatchSetup(room.code, {
      teams: {
        A: { name: teamAName.trim() || 'الفريق الأول', score: 0, players: A.map(n => ({ id: uid(), name: n })) },
        B: { name: teamBName.trim() || 'الفريق الثاني', score: 0, players: B.map(n => ({ id: uid(), name: n })) },
      },
    })
  }, [distMode, distributed, aPlayers, bPlayers, teamAName, teamBName, room.code])

  const start = async () => {
    setErr('')
    const A = aPlayers.map(s => s.trim()).filter(Boolean)
    const B = bPlayers.map(s => s.trim()).filter(Boolean)
    if (namesEnabled && (A.length < 1 || B.length < 1)) { setErr('أضف لاعباً واحداً على الأقل لكل فريق'); return }
    if (selected.length < 1) { setErr('اختر فئة واحدة على الأقل'); return }
    setBusy(true)
    const teams: Record<TeamId, { name: string; score: number; players: WKPlayer[] }> = {
      A: { name: teamAName.trim() || 'الفريق الأول', score: 0, players: namesEnabled ? A.map(n => ({ id: uid(), name: n })) : [] },
      B: { name: teamBName.trim() || 'الفريق الثاني', score: 0, players: namesEnabled ? B.map(n => ({ id: uid(), name: n })) : [] },
    }
    await updateMatchSetup(room.code, {
      matchName: matchName.trim() || 'مباراة ولا كلمة', teams, categories: selected,
      explainDuration: explain, totalRounds: rounds,
      mode: quickMode ? 'quick' : 'full',
      playerNamesEnabled: namesEnabled,
    })
    const res = await startMatch(room.code)
    setBusy(false)
    if (!res.success) setErr(res.error)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Header title="إعداد المباراة" showHome />
      <DisplayLinkCard code={room.code} />

      <div style={{ display: 'flex', gap: 8, background: '#fff', borderRadius: 16, padding: 6, border: `1px solid ${C.ink}12` }}>
        {([[1, 'اختر الفئات'], [2, 'التفاصيل']] as const).map(([n, label]) => (
          <button key={n} onClick={() => setStep(n)} style={{
            flex: 1, padding: 10, borderRadius: 12, fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer',
            background: step === n ? `linear-gradient(135deg, ${C.red}, ${C.orange})` : 'transparent',
            color: step === n ? '#fff' : `${C.ink}88`,
          }}>{n} · {label}</button>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <SectionTitle>الفئات (حتى {WK_MAX_CATEGORIES}) — مختار: {selected.length}</SectionTitle>
          {cats.length === 0 && <Muted>لا توجد فئات بعد — أضفها من لوحة الإدارة.</Muted>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 10 }}>
            {cats.map(c => <CategoryCard key={c.id} name={c.name} imageUrl={c.imageUrl} selected={selected.includes(c.id)} onClick={() => toggleCat(c.id)} />)}
            {customCount > 0 && (
              <CategoryCard name={`${CUSTOM_CATEGORY_NAME} (${customCount})`} selected={selected.includes(CUSTOM_CATEGORY_ID)} onClick={() => toggleCat(CUSTOM_CATEGORY_ID)} />
            )}
          </div>
          <button onClick={() => setStep(2)} style={{ ...primaryBtn, marginTop: 14, opacity: selected.length < 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={selected.length < 1}>التالي <ArrowLeft size={17} /></button>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <SectionTitle style={{ margin: 0 }}>بيانات المباراة</SectionTitle>
              <button onClick={() => setShowHelp(v => !v)} style={{ ...iconBtn, width: 26, height: 26, fontSize: 13, borderRadius: '50%' }}>؟</button>
            </div>
            {showHelp && (
              <div style={{ background: `${C.violet}0d`, border: `1px solid ${C.violet}22`, borderRadius: 12, padding: '10px 12px', marginBottom: 10, fontSize: 12.5, color: `${C.ink}cc`, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><BookOpen size={15} style={{ flexShrink: 0, marginTop: 2 }} /><span><b>القراءة:</b> الممثّل يقرأ العمل لحاله بالوقت المحدد.</span></div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><Drama size={15} style={{ flexShrink: 0, marginTop: 2 }} /><span><b>التمثيل:</b> يمثّل العمل بالحركات بدون كلام لفريقه.</span></div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><Swords size={15} style={{ flexShrink: 0, marginTop: 2 }} /><span><b>السرقة:</b> لو الفريق غلط، الفريق الثاني يقدر يخمّن ويسرق النقطة.</span></div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><Dices size={15} style={{ flexShrink: 0, marginTop: 2 }} /><span><b>الجوكر:</b> نتيجة عشوائية مرة واحدة كل فريق بالمباراة.</span></div>
              </div>
            )}
            <Input value={matchName} onChange={setMatchName} placeholder="اسم المباراة" />
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={teamAName} onChange={setTeamAName} placeholder="الفريق الأول" accent={C.violet} />
              <Input value={teamBName} onChange={setTeamBName} placeholder="الفريق الثاني" accent={C.red} />
            </div>
          </Card>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <SectionTitle style={{ margin: 0 }}>بدون أسماء لاعبين</SectionTitle>
                <Muted>فرق فقط، بدون تسجيل لاعبين — دور كل فريق يعرض باسم الفريق</Muted>
              </div>
              <button onClick={() => setNamesEnabled(v => !v)} style={{
                width: 50, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                background: !namesEnabled ? C.violet : `${C.ink}22`, transition: 'background 0.2s', flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 3, right: !namesEnabled ? 25 : 3, width: 22, height: 22, borderRadius: '50%',
                  background: '#fff', transition: 'right 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          </Card>
          {namesEnabled && (
            <Card>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={() => setDistMode('manual')} style={{ ...choice(distMode === 'manual'), flex: 1 }}>توزيع يدوي</button>
                <button onClick={() => { setDistMode('random'); setDistributed(false) }} style={{ ...choice(distMode === 'random'), flex: 1 }}>توزيع عشوائي</button>
              </div>

              {distMode === 'manual' && (
                <>
                  <PlayersEditor label={teamAName} color={C.violet} players={aPlayers} setPlayers={setAPlayers} />
                  <div style={{ height: 12 }} />
                  <PlayersEditor label={teamBName} color={C.red} players={bPlayers} setPlayers={setBPlayers} />
                  <TeamSizeWarning aPlayers={aPlayers} bPlayers={bPlayers} />
                </>
              )}

              {distMode === 'random' && !distributed && (
                <>
                  <PlayersEditor label="" title="أسماء كل اللاعبين" color={C.orange} players={allPlayers} setPlayers={setAllPlayers} />
                  <button onClick={distributeRandomly} style={{ ...primaryBtn, marginTop: 12 }}
                    disabled={allPlayers.map(s => s.trim()).filter(Boolean).length < 2}>
                    وزّع الفرق
                  </button>
                </>
              )}

              {distMode === 'random' && distributed && (
                <>
                  <Muted>توزّعوا عشوائياً — تقدر تعدّل قبل ما تبدأ:</Muted>
                  <div style={{ height: 8 }} />
                  <PlayersEditor label={teamAName} color={C.violet} players={aPlayers} setPlayers={setAPlayers} />
                  <div style={{ height: 12 }} />
                  <PlayersEditor label={teamBName} color={C.red} players={bPlayers} setPlayers={setBPlayers} />
                  <TeamSizeWarning aPlayers={aPlayers} bPlayers={bPlayers} />
                  <button onClick={() => setDistributed(false)} style={{ ...ghostBtn, marginTop: 8 }}>أعد التوزيع</button>
                </>
              )}
            </Card>
          )}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <SectionTitle style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={13} /> الوضع السريع</SectionTitle>
                <Muted>دور {WK_QUICK_EXPLAIN} ثانية، جولة وحدة، بدون خصائص</Muted>
              </div>
              <button onClick={() => setQuickMode(v => !v)} style={{
                width: 50, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                background: quickMode ? C.orange : `${C.ink}22`, transition: 'background 0.2s', flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 3, right: quickMode ? 25 : 3, width: 22, height: 22, borderRadius: '50%',
                  background: '#fff', transition: 'right 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          </Card>
          <Card style={quickMode ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <SectionTitle>مدة الشرح</SectionTitle>
            <div style={{ display: 'flex', gap: 8 }}>
              {WK_EXPLAIN_OPTIONS.map(o => <button key={o} onClick={() => setExplain(o)} style={choice(explain === o)}>{o === 60 ? 'دقيقة' : o === 90 ? 'دقيقة ونص' : 'دقيقة و45'}</button>)}
            </div>
            <div style={{ height: 12 }} />
            <SectionTitle>عدد الجولات</SectionTitle>
            <div style={{ display: 'flex', gap: 8 }}>
              {WK_ROUND_OPTIONS.map(o => <button key={o} onClick={() => setRounds(o)} style={choice(rounds === o)}>{o}</button>)}
            </div>
          </Card>
          {err && <ErrorText>{err}</ErrorText>}
          <button onClick={start} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'ابدأ المباراة'}</button>
        </>
      )}
    </div>
  )
}

function CategoryCard({ name, imageUrl, selected, onClick }: { name: string; imageUrl?: string; selected: boolean; onClick: () => void }) {
  const [pulse, setPulse] = useState(false)
  return (
    <button onClick={() => { onClick(); setPulse(true); setTimeout(() => setPulse(false), 260) }} className={pulse ? 'wk-tap-pulse' : undefined} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px 8px', borderRadius: 14, cursor: 'pointer',
      border: `2px solid ${selected ? C.red : C.ink + '14'}`, background: selected ? `${C.red}0d` : '#fff',
      transition: 'all 0.15s',
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} style={{ width: '100%', aspectRatio: '1', borderRadius: 12, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, background: selected ? `${C.red}18` : `${C.ink}0a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Drama size={32} color={selected ? C.red : `${C.ink}44`} /></div>
      )}
      <span style={{ fontSize: 13, fontWeight: 800, color: selected ? C.red : `${C.ink}99`, textAlign: 'center', lineHeight: 1.3 }}>{name}</span>
    </button>
  )
}

function DisplayLinkCard({ code }: { code: string }) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/display?code=${code}` : ''
  useEffect(() => { if (url) QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr).catch(() => {}) }, [url])
  return (
    <Card>
      <SectionTitle>شاشة العرض (تلفاز/لابتوب)</SectionTitle>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {qr && <img src={qr} alt="QR" width={92} height={92} style={{ borderRadius: 12, border: `1px solid ${C.ink}12` }} />}
        <div style={{ flex: 1 }}>
          <Muted>افتح الرابط على شاشة كبيرة، أو امسح الكود.</Muted>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.28em', color: C.violet, marginTop: 6 }}>{code}</div>
          <button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            className={copied ? 'wk-copied-pulse' : undefined}
            style={{ ...ghostBtn, marginTop: 8, ...(copied ? { borderColor: '#27AE78', color: '#27AE78' } : {}) }}>
            {copied ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={13} /> تم النسخ</span> : 'نسخ رابط العرض'}
          </button>
        </div>
      </div>
    </Card>
  )
}

function TeamSizeWarning({ aPlayers, bPlayers }: { aPlayers: string[]; bPlayers: string[] }) {
  const a = aPlayers.map(s => s.trim()).filter(Boolean).length
  const b = bPlayers.map(s => s.trim()).filter(Boolean).length
  if (a === 0 || b === 0 || a === b) return null
  return <p style={{ fontSize: 11.5, color: `${C.ink}77`, marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 5 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span>الفرق مو متساوية بالعدد — لاعبو الفريق الأصغر بيمثّلون أكثر من غيرهم نسبياً.</span></p>
}

function PlayersEditor({ label, title, color, players, setPlayers }: { label: string; title?: string; color: string; players: string[]; setPlayers: (p: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const names = players.map(s => s.trim()).filter(Boolean)

  const add = () => {
    const name = draft.trim()
    if (!name) return
    setPlayers([...names, name])
    setDraft('')
  }
  const remove = (i: number) => setPlayers(names.filter((_, j) => j !== i))

  return (
    <div>
      <SectionTitle style={{ color }}>{title ?? `لاعبو ${label}`}</SectionTitle>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="اسم اللاعب"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          style={{ ...inputStyle(color), marginBottom: 0 }} />
        <button onClick={add} style={{ ...ghostBtn, borderColor: color, color, whiteSpace: 'nowrap' }}>إضافة</button>
      </div>
      {names.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {names.map((name, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${color}14`, border: `1px solid ${color}33`, borderRadius: 999, padding: '5px 6px 5px 12px', fontSize: 13, fontWeight: 700, color }}>
              {name}
              <button onClick={() => remove(i)} style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', background: color, color: '#fff', fontSize: 11, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════ DRAW ═══════════════
function DrawScreen({ room }: { room: WalaKelmaRoom }) {
  const slot = room.turnOrder[room.currentTurnIndex]
  const color = room.activeTeam === 'A' ? C.violet : C.red
  const [revealed, setRevealed] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    // ملاحظة: ما نوقف الجدولة بحارس firedRef — بس نمنع تكرار الصوت وقت الإعادة المزدوجة بوضع React Strict
    if (!firedRef.current) { firedRef.current = true; playDrumRollSound() }
    const t = setTimeout(() => setRevealed(true), 1300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', paddingTop: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: `${C.ink}aa`, display: 'flex', alignItems: 'center', gap: 8 }}>القرعة <Dices size={22} /></div>
      {!revealed ? (
        <div style={{
          width: '100%', maxWidth: 320, height: 148, borderRadius: 22,
          background: `linear-gradient(135deg, ${C.ink}, ${C.ink}dd)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'wkDrawShake 0.25s ease-in-out infinite',
        }}>
          <Dices size={40} color="#fff" />
        </div>
      ) : (
        <div className="wk-pop-in" style={{
          width: '100%', maxWidth: 320, borderRadius: 22, padding: '24px 22px',
          background: `linear-gradient(135deg, ${color}, ${room.activeTeam === 'A' ? '#4726c9' : C.orange})`,
          color: '#fff', boxShadow: `0 16px 40px ${color}33`,
        }}>
          <div style={{ fontSize: 15, opacity: 0.9, fontWeight: 700 }}>الفريق البادئ</div>
          <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{room.teams[room.activeTeam].name}</div>
          {room.playerNamesEnabled !== false && slot && <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, opacity: 0.95 }}>أول لاعب: {slot.playerName}</div>}
        </div>
      )}
      <button onClick={() => beginPlaying(room.code)} disabled={!revealed} style={{ ...primaryBtn, maxWidth: 280, opacity: revealed ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>يلا نبدأ <ArrowLeft size={18} /></button>
      <style>{`@keyframes wkDrawShake{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}`}</style>
    </div>
  )
}

// ═══════════════ CONTROL PANEL ═══════════════
function ControlPanel({ room, timeLeft }: { room: WalaKelmaRoom; timeLeft: number }) {
  const slot = room.turnOrder[room.currentTurnIndex]
  const nextSlot = room.turnOrder.length > 1 ? room.turnOrder[(room.currentTurnIndex + 1) % room.turnOrder.length] : null
  const team = room.activeTeam
  const other: TeamId = team === 'A' ? 'B' : 'A'
  const color = team === 'A' ? C.violet : C.red
  const [silencePick, setSilencePick] = useState(false)
  const [turnErr, setTurnErr] = useState('')
  const [endConfirm, setEndConfirm] = useState(false)
  const [scoreConfirm, setScoreConfirm] = useState<{ title: string; desc: string; onConfirm: () => void } | null>(null)
  const [cats, setCats] = useState<WKCategory[]>([])
  const w = room.currentWork

  useEffect(() => { getCategories(true).then(setCats) }, [])

  const typeLabel = w
    ? (w.categoryId === CUSTOM_CATEGORY_ID ? 'من فئتك الخاصة' : typeLabelForCategory(cats.find(c => c.id === w.categoryId)?.name || ''))
    : ''

  const handleStartTurn = async () => {
    setTurnErr('')
    const res = await startTurn(room.code, room.hostId)
    if (!res.success) setTurnErr(res.error)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700 }}>
          {room.isTiebreak ? 'الجولة الفاصلة' : `الجولة ${room.currentRound}/${room.totalRounds} — سؤال ${Math.min((room.turnsThisRound || 0) + 1, room.questionsPerRound || 1)}/${room.questionsPerRound}`}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: `${C.ink}66`, letterSpacing: '0.15em' }}>{room.code}</div>
      </div>
      {turnErr && <Card><p style={{ color: C.red, fontWeight: 700, fontSize: 13, margin: 0 }}>{turnErr}</p></Card>}

      <div style={{ display: 'flex', gap: 10 }}>
        {(['A', 'B'] as TeamId[]).map(id => (
          <div key={id} style={{
            flex: 1, textAlign: 'center', padding: 10, borderRadius: 16,
            border: `2px solid ${room.activeTeam === id ? (id === 'A' ? C.violet : C.red) : `${C.ink}12`}`, background: '#fff',
            boxShadow: room.activeTeam === id ? `0 10px 26px ${(id === 'A' ? C.violet : C.red)}22` : `0 6px 16px ${C.ink}08`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{room.teams[id].name}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 }}>
              <button onClick={() => adjustScore(room.code, id, -1)} style={miniBtn}>−</button>
              <span style={{ fontSize: 30, fontWeight: 900, color: id === 'A' ? C.violet : C.red, minWidth: 30 }}>{room.teams[id].score}</span>
              <button onClick={() => adjustScore(room.code, id, +1)} style={miniBtn}>+</button>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: `${C.ink}99` }}>{PHASE_LABEL[room.phase]}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color }}>{room.teams[team].name}</div>
          {room.playerNamesEnabled !== false && slot && <div style={{ fontSize: 16, fontWeight: 700 }}>يمثّل: {slot.playerName}</div>}
          {room.playerNamesEnabled !== false && nextSlot && <div style={{ fontSize: 12, color: `${C.ink}66`, marginTop: 2 }}>التالي: {nextSlot.playerName}</div>}
          {(room.phase === 'reading' || room.phase === 'acting' || room.phase === 'stealing') && (
            <div style={{ fontSize: 40, fontWeight: 900, color: timeLeft <= 10 ? C.red : color, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </Card>

      {room.phase === 'idle' && (
        <>
          {room.mode === 'quick' ? (
            <Card><Muted><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Zap size={13} /> الوضع السريع: بدون خصائص ما قبل الدور — الجوكر متاح فقط أثناء التمثيل.</span></Muted></Card>
          ) : (
            <Card>
              <SectionTitle>خصائص {room.teams[team].name} (قبل الدور)</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {WK_POWERUPS.filter(p => p.preTurn).map(p => {
                  const used = room.powerUpsUsed[team][p.id]
                  const active = room.activePowerUps[p.id as 'double' | 'deduct' | 'silence']
                  return (
                    <div key={p.id} style={{ display: 'flex', gap: 6 }}>
                      <button disabled={used && !active} style={{ ...powerBtn(p.color, active, used), flex: 1 }}
                        onClick={() => { if (used) return; if (p.id === 'silence') setSilencePick(true); else activatePowerUp(room.code, team, p.id as 'double' | 'deduct') }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><p.icon size={15} /> {p.name}</span>
                        <span style={{ fontSize: 11, opacity: 0.8 }}>{active ? 'مفعّلة لهذا الدور' : used ? 'استُخدمت' : p.desc}</span>
                      </button>
                      {active && (
                        <button onClick={() => { deactivatePowerUp(room.code, team, p.id as 'double' | 'deduct' | 'silence'); setSilencePick(false) }}
                          style={{ ...ghostBtn, borderColor: C.red, color: C.red }}>تراجع</button>
                      )}
                    </div>
                  )
                })}
              </div>
              {silencePick && (
                <div style={{ marginTop: 10 }}>
                  <Muted>اختر لاعباً من {room.teams[other].name} لإسكاته:</Muted>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {room.teams[other].players.map(pl => <button key={pl.id} onClick={() => { activatePowerUp(room.code, team, 'silence', pl.id); setSilencePick(false) }} style={pill(false)}>{pl.name}</button>)}
                  </div>
                </div>
              )}
            </Card>
          )}
          <button onClick={handleStartTurn} className="wk-breathe" style={{ ...primaryBtn, padding: '26px 15px', fontSize: 20, ['--wk-glow' as string]: 'rgba(88,46,244,0.45)' } as React.CSSProperties}>ابدأ</button>
          <SkipCancelRow room={room} setEndConfirm={setEndConfirm} />
        </>
      )}

      {room.phase === 'searching' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: `4px solid ${C.violet}30`, borderTopColor: C.violet, animation: 'wkspin 0.8s linear infinite' }} />
          <style>{`@keyframes wkspin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {(room.phase === 'reading' || room.phase === 'acting' || room.phase === 'stealing') && w && (
        <>
          {room.categoryExhausted && (
            <div style={{ fontSize: 12, fontWeight: 800, color: C.orange, background: `${C.orange}14`, padding: '8px 12px', borderRadius: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> خلصت الأعمال الجديدة بهذي الفئة — نعيد أعمال شفتها قبل
            </div>
          )}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionTitle style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>العمل (للمقدّم فقط) <EyeOff size={12} /></SectionTitle>
              <button onClick={() => toggleQuestionHidden(room.code, !room.questionHidden)} title={room.questionHidden ? 'إظهار' : 'إخفاء'} style={{ ...ghostBtn, display: 'flex', alignItems: 'center' }}>{room.questionHidden ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            {!room.questionHidden ? (
              <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                {w.posterUrl ? <img src={w.posterUrl} alt="" width={150} style={{ borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 150, height: 206, borderRadius: 16, background: `${C.ink}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Clapperboard size={40} color={`${C.ink}44`} /></div>}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {typeLabel && <div style={{ fontSize: 13, fontWeight: 800, color: C.violet, marginBottom: 4 }}>{typeLabel}</div>}
                  <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.4 }}>{w.title}</div>
                  <div style={{ fontSize: 14, color: `${C.ink}99`, marginTop: 8 }}>{[w.year, w.country].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ) : <div style={{ padding: 20, textAlign: 'center', color: `${C.ink}66` }}>العمل مخفي</div>}
          </Card>

          {room.phase === 'reading' && <button onClick={() => beginActing(room.code)} style={primaryBtn}>جاهز — ابدأ التمثيل</button>}

          {room.phase === 'acting' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setScoreConfirm({ title: `صح لـ ${room.teams[team].name}؟`, desc: 'بتنحسب نقطة (أو نقطتين لو مفعّلة المضاعفة) لهذا الفريق.', onConfirm: () => markCorrect(room.code, team) })} style={successBtn}>صح ({room.teams[team].name})</button>
              <button onClick={() => setScoreConfirm({ title: 'غلط؟', desc: `ينتقل الدور للسرقة — ${room.teams[other].name} يقدر يخمّن.`, onConfirm: () => markWrong(room.code) })} style={dangerBtn}>غلط → سرقة</button>
            </div>
          )}

          {room.phase === 'stealing' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setScoreConfirm({ title: `سرقها ${room.teams[other].name}؟`, desc: 'بتنحسب نقطة لهذا الفريق.', onConfirm: () => markCorrect(room.code, other) })} style={{ ...successBtn, background: C.red }}>سرقها {room.teams[other].name}</button>
              <button onClick={() => setScoreConfirm({ title: 'ما خمّنوا؟', desc: 'ينتهي الدور بدون أي نقطة.', onConfirm: () => onStealTimeUp(room.code) })} style={dangerBtn}>ما خمّنوا</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {!room.powerUpsUsed[team].joker && (
              <button onClick={() => useJoker(room.code)} className="wk-breathe"
                style={{ ...ghostBtn, flex: 1, borderColor: C.orange, color: C.orange, ['--wk-glow' as string]: 'rgba(242,107,33,0.45)' } as React.CSSProperties}>جوكر</button>
            )}
            <button onClick={() => togglePause(room.code)} title={room.paused ? 'استئناف' : 'إيقاف'} style={{ ...ghostBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{room.paused ? <Play size={16} /> : <Pause size={16} />}</button>
            <button onClick={() => resetPhaseTimer(room.code)} style={{ ...ghostBtn, flex: 1 }}>إعادة الوقت</button>
          </div>
          {room.joker && (
            <div className="wk-pop-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: C.orange, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Dices size={16} /> نتيجة الجوكر: {room.joker.outcome === 'addPoint' ? 'إضافة نقطة' : room.joker.outcome === 'deductPoint' ? 'خصم نقطة' : 'إعادة تمثيل بعمل جديد'}
              </div>
              {room.joker.outcome === 'redoWithNewWork' && (
                <button onClick={() => startTurn(room.code, room.hostId)} style={{ ...ghostBtn, borderColor: '#27AE78', color: '#27AE78' }}>اسحب العمل الجديد</button>
              )}
              <button onClick={() => undoJoker(room.code)} style={{ ...ghostBtn, borderColor: C.red, color: C.red }}>تراجع</button>
            </div>
          )}
          <SkipCancelRow room={room} setEndConfirm={setEndConfirm} />
        </>
      )}

      {room.phase === 'resolved' && (
        <>
          <Confetti key={room.lastResult?.ts} count={12} active={!!room.lastResult && room.lastResult.points > 0} />
          <Card>
            <div key={room.lastResult?.ts} className="wk-pop-in" style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, color: room.lastResult?.points ? '#27AE78' : `${C.ink}88` }}>
              {room.lastResult?.type === 'correct' && `✅ نقطة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult?.type === 'steal' && `🥷 سرقة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult?.type === 'timeout' && '⏱ انتهى الوقت — ولا نقطة'}
            </div>
          </Card>
          <button onClick={() => nextTurn(room.code)} style={{ ...primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>الدور التالي <ArrowLeft size={17} /></button>
        </>
      )}

      {room.phase === 'roundEnd' && <RoundEndSummary room={room} onContinue={() => continueAfterRound(room.code)} />}

      {endConfirm && (
        <ConfirmModal
          title="إنهاء المباراة؟"
          desc="بتنتهي المباراة الحين بالنتيجة الحالية — ما تقدر ترجع."
          onCancel={() => setEndConfirm(false)}
          onConfirm={() => { setEndConfirm(false); cancelMatch(room.code) }}
        />
      )}

      {scoreConfirm && (
        <ConfirmModal
          title={scoreConfirm.title}
          desc={scoreConfirm.desc}
          onCancel={() => setScoreConfirm(null)}
          onConfirm={() => { const fn = scoreConfirm.onConfirm; setScoreConfirm(null); fn() }}
        />
      )}
    </div>
  )
}

function RoundEndSummary({ room, onContinue }: { room: WalaKelmaRoom; onContinue: () => void }) {
  const a = room.teams.A.score || 0
  const b = room.teams.B.score || 0
  const diff = Math.abs(a - b)
  const leading = a === b ? null : a > b ? room.teams.A.name : room.teams.B.name
  return (
    <>
      <Card>
        <div className="wk-pop-in" style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, color: C.orange, marginBottom: 12 }}>انتهت الجولة {room.currentRound} 🎬</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['A', 'B'] as TeamId[]).map(id => (
            <div key={id} style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 14, background: `${(id === 'A' ? C.violet : C.red)}0d`, border: `1px solid ${(id === 'A' ? C.violet : C.red)}22` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: `${C.ink}99` }}>{room.teams[id].name}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: id === 'A' ? C.violet : C.red }}>{room.teams[id].score}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: `${C.ink}88`, marginTop: 12 }}>
          {leading ? `${leading} متقدّم بـ ${diff} ${diff === 1 ? 'نقطة' : 'نقاط'} 🔥` : 'تعادل حتى الآن 🤝'}
        </div>
      </Card>
      <button onClick={onContinue} style={{ ...primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>ابدأ الجولة التالية <ArrowLeft size={17} /></button>
    </>
  )
}

function ConfirmModal({ title, desc, onCancel, onConfirm }: { title: string; desc: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 20 }}>
      <div className="wk-pop-in" style={{ background: '#fff', borderRadius: 20, padding: 22, maxWidth: 340, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, textAlign: 'center' }}>{title}</div>
        <div style={{ fontSize: 13, color: `${C.ink}99`, textAlign: 'center', marginTop: 8 }}>{desc}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} style={{ ...ghostBtn, flex: 1, textAlign: 'center' }}>تراجع</button>
          <button onClick={onConfirm} style={{ ...dangerBtn, flex: 1 }}>تأكيد</button>
        </div>
      </div>
    </div>
  )
}

function SkipCancelRow({ room, setEndConfirm }: { room: WalaKelmaRoom; setEndConfirm: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(room.phase === 'reading' || room.phase === 'acting' || room.phase === 'idle') && <button onClick={() => skipTurn(room.code)} style={{ ...ghostBtn, flex: 1 }}>تخطّي العمل</button>}
      <button onClick={() => setEndConfirm(true)} style={{ ...ghostBtn, flex: 1, color: C.red, borderColor: `${C.red}55` }}>إنهاء</button>
    </div>
  )
}

// ═══════════════ FINISHED ═══════════════
function FinishedScreen({ room, onNew }: { room: WalaKelmaRoom; onNew: () => void }) {
  const win = room.winner
  const bestActor = getBestActor(room)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', paddingTop: 30, textAlign: 'center' }}>
      <Confetti count={70} active={win !== 'draw'} />
      <div className="wk-float"><Trophy size={56} color={C.orange} /></div>
      <div className="wk-pop-in" style={{ fontSize: 30, fontWeight: 900, color: win === 'A' ? C.violet : win === 'B' ? C.red : C.ink }}>{win === 'draw' ? 'تعادل!' : `فاز ${room.teams[win as TeamId].name}`}</div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        {(['A', 'B'] as TeamId[]).map(id => (
          <div key={id} style={{ flex: 1, padding: 16, borderRadius: 16, background: '#fff', border: `1px solid ${(id === 'A' ? C.violet : C.red)}2a`, boxShadow: `0 10px 26px ${(id === 'A' ? C.violet : C.red)}1c` }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{room.teams[id].name}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: id === 'A' ? C.violet : C.red }}>{room.teams[id].score}</div>
          </div>
        ))}
      </div>
      {room.playerNamesEnabled !== false && bestActor && (
        <div style={{ background: `${C.orange}14`, borderRadius: 14, padding: '10px 20px', border: `1px solid ${C.orange}22`, boxShadow: `0 8px 20px ${C.orange}1c` }}>
          <span style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Drama size={14} color={C.orange} /> أفضل ممثل: </span>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.orange }}>{bestActor.playerName}</span>
        </div>
      )}
      <ShareResultButton room={room} refUid={room.hostId} />
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
        <button onClick={onNew} className="transition-transform hover:scale-[1.02] active:scale-[0.99]"
          style={{ flex: 1.4, padding: '13px 10px', borderRadius: 12, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap',
            background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, cursor: 'pointer', boxShadow: `0 8px 18px ${C.red}2a` }}>
          مباراة جديدة
        </button>
        <a href="/" style={{ flex: 1, padding: '13px 10px', borderRadius: 12, border: `1.5px solid ${C.ink}22`, background: 'transparent', color: `${C.ink}cc`, fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none' }}>
          <ArrowLeft size={13} /> الرئيسية
        </a>
      </div>
    </div>
  )
}

// ═══════════════ UI helpers ═══════════════
function Loading() {
  return <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: `4px solid ${C.red}30`, borderTopColor: C.red, margin: '0 auto', animation: 'wkspin 0.8s linear infinite' }} />
      <p style={{ marginTop: 14, color: `${C.ink}aa`, fontWeight: 700 }}>جاري التحضير…</p>
      <style>{`@keyframes wkspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </div>
}
function ErrorScreen({ msg, onBack }: { msg: string; onBack: () => void }) {
  return <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <div style={{ textAlign: 'center' }}>
      <Frown size={44} color={`${C.ink}66`} style={{ margin: '0 auto' }} />
      <p style={{ fontSize: 18, fontWeight: 800, color: C.ink, marginTop: 10 }}>{msg}</p>
      <button onClick={onBack} style={{ ...primaryBtn, maxWidth: 220, marginTop: 16 }}>رجوع</button>
    </div>
  </div>
}
function Header({ title, showHome }: { title: string; showHome?: boolean }) {
  return <div style={{ textAlign: 'center', position: 'relative' }}>
    {showHome && <a href="/" style={{ position: 'absolute', top: 0, right: 0, fontSize: 12, fontWeight: 800, color: `${C.ink}88`, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={12} /> الرئيسية</a>}
    <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={46} /></div>
    <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginTop: 6 }}>{title}</div>
  </div>
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) { return <div style={{ background: '#fff', borderRadius: 18, padding: 16, border: `1px solid ${C.ink}12`, boxShadow: `0 8px 22px ${C.ink}0a`, ...style }}>{children}</div> }
function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) { return <p style={{ fontSize: 12, fontWeight: 900, color: `${C.ink}77`, marginBottom: 8, ...style }}>{children}</p> }
function Muted({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: 12, color: `${C.ink}88` }}>{children}</p> }
function ErrorText({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: 13, fontWeight: 700, color: C.red, textAlign: 'center' }}>{children}</p> }
function Input({ value, onChange, placeholder, accent }: { value: string; onChange: (v: string) => void; placeholder: string; accent?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle(accent)} />
}

const inputStyle = (accent?: string): React.CSSProperties => ({ width: '100%', padding: '11px 12px', borderRadius: 12, border: `1px solid ${accent ? accent + '55' : C.ink + '20'}`, fontSize: 14, color: C.ink, background: C.cream, outline: 'none', marginBottom: 8 })
const primaryBtn: React.CSSProperties = { width: '100%', padding: '22px 15px', borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 18, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, cursor: 'pointer', boxShadow: `0 10px 24px ${C.red}33` }
const successBtn: React.CSSProperties = { flex: 1, padding: 15, borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, background: '#27AE78', cursor: 'pointer', boxShadow: '0 10px 24px #27AE7833' }
const dangerBtn: React.CSSProperties = { flex: 1, padding: 15, borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, background: C.red, cursor: 'pointer', boxShadow: `0 10px 24px ${C.red}33` }
const ghostBtn: React.CSSProperties = { padding: '9px 12px', borderRadius: 12, borderWidth: 1.5, borderStyle: 'solid', borderColor: `${C.ink}22`, background: 'transparent', color: `${C.ink}cc`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { width: 40, borderRadius: 12, border: `1px solid ${C.ink}20`, background: '#fff', fontWeight: 900, fontSize: 18, cursor: 'pointer' }
const miniBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.ink}20`, background: C.cream, fontWeight: 900, fontSize: 16, cursor: 'pointer', color: C.ink }
const pill = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${on ? C.red : C.ink + '22'}`, background: on ? `${C.red}14` : 'transparent', color: on ? C.red : `${C.ink}99` })
const choice = (on: boolean): React.CSSProperties => ({ flex: 1, padding: 12, borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', border: `1.5px solid ${on ? C.violet : C.ink + '18'}`, background: on ? `${C.violet}14` : '#fff', color: on ? C.violet : `${C.ink}99` })
const powerBtn = (color: string, active: boolean, used: boolean): React.CSSProperties => ({ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${used ? C.ink + '18' : color}`, background: used ? `${C.ink}08` : active ? `${color}20` : `${color}0d`, color: used ? `${C.ink}55` : color, fontWeight: 800, fontSize: 14, cursor: used ? 'not-allowed' : 'pointer', opacity: used ? 0.6 : 1, textAlign: 'right', width: '100%' })
