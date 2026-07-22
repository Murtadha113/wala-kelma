'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { onAuthChange, getUserProfile, type UserProfile } from '@/lib/auth'
import { getCategories, WKCategory } from '@/lib/works'
import { getCustomWorksCount, CUSTOM_CATEGORY_ID, CUSTOM_CATEGORY_NAME } from '@/lib/custom-works'
import {
  createWalaKelmaRoom, subscribeToWalaKelmaRoom, updateWKHostHeartbeat,
  updateMatchSetup, startMatch, beginPlaying, startTurn, beginActing, markCorrect, markWrong,
  onStealTimeUp, nextTurn, continueAfterRound, activatePowerUp, useJoker, togglePause, resetPhaseTimer,
  toggleQuestionHidden, adjustScore, skipTurn, cancelMatch, deleteWalaKelmaRoom, getBestActor,
  WalaKelmaRoom, TeamId, WKPlayer,
} from '@/lib/wala-kelma'
import { WK_COLORS, WK_EXPLAIN_OPTIONS, WK_ROUND_OPTIONS, WK_MAX_CATEGORIES, WK_POWERUPS, WK_QUICK_EXPLAIN } from '@/lib/wala-kelma-content'
import { useWalaKelmaCountdown, useResultSounds, PHASE_LABEL } from '@/components/shared'
import { ShareResultButton } from '@/components/share-result'
import { Logo } from '@/components/logo'

const C = WK_COLORS
const uid = () => `p_${Math.random().toString(36).slice(2, 9)}`

export default function HostPage() {
  const router = useRouter()
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
    if (profile === 'loading' || !profile || creatingRef.current) return
    creatingRef.current = true
    ;(async () => {
      const res = await createWalaKelmaRoom({ hostId: profile.id, hostName: profile.name })
      if (!res.success) { setError(res.error); return }
      subscribeToWalaKelmaRoom(res.code, r => { if (r) setRoom(r) })
    })()
  }, [profile])

  useEffect(() => {
    if (!room?.code) return
    updateWKHostHeartbeat(room.code)
    const t = setInterval(() => updateWKHostHeartbeat(room.code), 30000)
    return () => clearInterval(t)
  }, [room?.code])

  const timeLeft = useWalaKelmaCountdown(room, true)
  useResultSounds(room)

  if (profile === 'loading') return <Loading />
  if (error) return <ErrorScreen msg={error} onBack={() => router.push('/')} />
  if (!room) return <Loading />

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 14px 40px' }}>
        {room.status === 'setup' && <SetupWizard room={room} />}
        {room.status === 'draw' && <DrawScreen room={room} />}
        {room.status === 'playing' && <ControlPanel room={room} timeLeft={timeLeft} />}
        {room.status === 'finished' && <FinishedScreen room={room} onNew={() => { deleteWalaKelmaRoom(room.code); location.reload() }} />}
      </div>
    </div>
  )
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
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

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

  const start = async () => {
    setErr('')
    const A = aPlayers.map(s => s.trim()).filter(Boolean)
    const B = bPlayers.map(s => s.trim()).filter(Boolean)
    if (A.length < 1 || B.length < 1) { setErr('أضف لاعباً واحداً على الأقل لكل فريق'); return }
    if (selected.length < 1) { setErr('اختر فئة واحدة على الأقل'); return }
    setBusy(true)
    const teams: Record<TeamId, { name: string; score: number; players: WKPlayer[] }> = {
      A: { name: teamAName.trim() || 'الفريق الأول', score: 0, players: A.map(n => ({ id: uid(), name: n })) },
      B: { name: teamBName.trim() || 'الفريق الثاني', score: 0, players: B.map(n => ({ id: uid(), name: n })) },
    }
    await updateMatchSetup(room.code, {
      matchName: matchName.trim() || 'مباراة ولا كلمة', teams, categories: selected,
      explainDuration: explain, totalRounds: rounds,
      mode: quickMode ? 'quick' : 'full',
    })
    const res = await startMatch(room.code)
    setBusy(false)
    if (!res.success) setErr(res.error)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Header title="إعداد المباراة" />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10, marginTop: 10 }}>
            {cats.map(c => <CategoryCard key={c.id} name={c.name} imageUrl={c.imageUrl} selected={selected.includes(c.id)} onClick={() => toggleCat(c.id)} />)}
            {customCount > 0 && (
              <CategoryCard name={`${CUSTOM_CATEGORY_NAME} (${customCount})`} selected={selected.includes(CUSTOM_CATEGORY_ID)} onClick={() => toggleCat(CUSTOM_CATEGORY_ID)} />
            )}
          </div>
          <button onClick={() => setStep(2)} style={{ ...primaryBtn, marginTop: 14, opacity: selected.length < 1 ? 0.5 : 1 }} disabled={selected.length < 1}>التالي ←</button>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <SectionTitle>بيانات المباراة</SectionTitle>
            <Input value={matchName} onChange={setMatchName} placeholder="اسم المباراة" />
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={teamAName} onChange={setTeamAName} placeholder="الفريق الأول" accent={C.violet} />
              <Input value={teamBName} onChange={setTeamBName} placeholder="الفريق الثاني" accent={C.red} />
            </div>
          </Card>
          <Card>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setDistMode('manual')} style={{ ...choice(distMode === 'manual'), flex: 1 }}>توزيع يدوي</button>
              <button onClick={() => { setDistMode('random'); setDistributed(false) }} style={{ ...choice(distMode === 'random'), flex: 1 }}>🎲 توزيع عشوائي</button>
            </div>

            {distMode === 'manual' && (
              <>
                <PlayersEditor label={teamAName} color={C.violet} players={aPlayers} setPlayers={setAPlayers} />
                <div style={{ height: 12 }} />
                <PlayersEditor label={teamBName} color={C.red} players={bPlayers} setPlayers={setBPlayers} />
              </>
            )}

            {distMode === 'random' && !distributed && (
              <>
                <PlayersEditor label="" title="أسماء كل اللاعبين" color={C.orange} players={allPlayers} setPlayers={setAllPlayers} />
                <button onClick={distributeRandomly} style={{ ...primaryBtn, marginTop: 12 }}
                  disabled={allPlayers.map(s => s.trim()).filter(Boolean).length < 2}>
                  🎲 وزّع الفرق
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
                <button onClick={() => setDistributed(false)} style={{ ...ghostBtn, marginTop: 8 }}>🎲 أعد التوزيع</button>
              </>
            )}
          </Card>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <SectionTitle style={{ margin: 0 }}>⚡ الوضع السريع</SectionTitle>
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
          <button onClick={start} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : '🎭 ابدأ المباراة'}</button>
        </>
      )}
    </div>
  )
}

function CategoryCard({ name, imageUrl, selected, onClick }: { name: string; imageUrl?: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px 8px', borderRadius: 14, cursor: 'pointer',
      border: `2px solid ${selected ? C.red : C.ink + '14'}`, background: selected ? `${C.red}0d` : '#fff',
      transition: 'all 0.15s',
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} width={72} height={72} style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 72, height: 72, borderRadius: 12, background: selected ? `${C.red}18` : `${C.ink}0a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎭</div>
      )}
      <span style={{ fontSize: 11.5, fontWeight: 800, color: selected ? C.red : `${C.ink}99`, textAlign: 'center', lineHeight: 1.3 }}>{name}</span>
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
          <button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }} style={{ ...ghostBtn, marginTop: 8 }}>{copied ? '✓ تم النسخ' : 'نسخ رابط العرض'}</button>
        </div>
      </div>
    </Card>
  )
}

function PlayersEditor({ label, title, color, players, setPlayers }: { label: string; title?: string; color: string; players: string[]; setPlayers: (p: string[]) => void }) {
  return (
    <div>
      <SectionTitle style={{ color }}>{title ?? `لاعبو ${label}`}</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {players.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input value={p} onChange={e => setPlayers(players.map((x, j) => j === i ? e.target.value : x))} placeholder={`لاعب ${i + 1}`} style={inputStyle(color)} />
            {players.length > 1 && <button onClick={() => setPlayers(players.filter((_, j) => j !== i))} style={{ ...iconBtn, color: C.red }}>−</button>}
          </div>
        ))}
      </div>
      <button onClick={() => setPlayers([...players, ''])} style={{ ...ghostBtn, marginTop: 8 }}>+ أضف لاعب</button>
    </div>
  )
}

// ═══════════════ DRAW ═══════════════
function DrawScreen({ room }: { room: WalaKelmaRoom }) {
  const slot = room.turnOrder[room.currentTurnIndex]
  const color = room.activeTeam === 'A' ? C.violet : C.red
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', paddingTop: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: `${C.ink}aa` }}>القرعة 🎲</div>
      <div>
        <div style={{ fontSize: 16, color: `${C.ink}88` }}>الفريق البادئ</div>
        <div style={{ fontSize: 40, fontWeight: 900, color }}>{room.teams[room.activeTeam].name}</div>
      </div>
      {slot && <div style={{ fontSize: 22, fontWeight: 700 }}>أول لاعب: {slot.playerName}</div>}
      <button onClick={() => beginPlaying(room.code)} style={{ ...primaryBtn, maxWidth: 280 }}>يلا نبدأ ←</button>
    </div>
  )
}

// ═══════════════ CONTROL PANEL ═══════════════
function ControlPanel({ room, timeLeft }: { room: WalaKelmaRoom; timeLeft: number }) {
  const slot = room.turnOrder[room.currentTurnIndex]
  const team = room.activeTeam
  const other: TeamId = team === 'A' ? 'B' : 'A'
  const color = team === 'A' ? C.violet : C.red
  const [silencePick, setSilencePick] = useState(false)
  const [turnErr, setTurnErr] = useState('')
  const [cats, setCats] = useState<WKCategory[]>([])
  const [pickedCatId, setPickedCatId] = useState('')
  const w = room.currentWork

  useEffect(() => { getCategories(true).then(setCats) }, [])

  const catName = (id: string) => id === CUSTOM_CATEGORY_ID ? CUSTOM_CATEGORY_NAME : (cats.find(c => c.id === id)?.name || '')

  const handleStartTurn = async () => {
    setTurnErr('')
    const res = await startTurn(room.code, room.hostId, pickedCatId || undefined)
    setPickedCatId('')
    if (!res.success) setTurnErr(res.error)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700 }}>{room.isTiebreak ? 'الجولة الفاصلة' : `الجولة ${room.currentRound}/${room.totalRounds}`}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: `${C.ink}66`, letterSpacing: '0.15em' }}>{room.code}</div>
      </div>
      {turnErr && <Card><p style={{ color: C.red, fontWeight: 700, fontSize: 13, margin: 0 }}>{turnErr}</p></Card>}

      <div style={{ display: 'flex', gap: 10 }}>
        {(['A', 'B'] as TeamId[]).map(id => (
          <div key={id} style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 16, border: `2px solid ${room.activeTeam === id ? (id === 'A' ? C.violet : C.red) : `${C.ink}12`}`, background: '#fff' }}>
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
          {slot && <div style={{ fontSize: 16, fontWeight: 700 }}>يمثّل: {slot.playerName}</div>}
          {(room.phase === 'reading' || room.phase === 'acting' || room.phase === 'stealing') && (
            <div style={{ fontSize: 40, fontWeight: 900, color: timeLeft <= 10 ? C.red : color, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </Card>

      {room.phase === 'idle' && (
        <>
          {room.categories.length > 1 && (
            <Card>
              <SectionTitle>الفئة لهذا الدور (اختياري)</SectionTitle>
              <Muted>ما اخترت؟ بنسحب عشوائياً من كل الفئات المختارة زي المعتاد.</Muted>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {room.categories.map(id => (
                  <button key={id} onClick={() => setPickedCatId(prev => prev === id ? '' : id)}
                    style={pill(pickedCatId === id)}>{catName(id)}</button>
                ))}
              </div>
            </Card>
          )}
          {room.mode === 'quick' ? (
            <Card><Muted>⚡ الوضع السريع: بدون خصائص ما قبل الدور — الجوكر متاح فقط أثناء التمثيل.</Muted></Card>
          ) : (
            <Card>
              <SectionTitle>خصائص {room.teams[team].name} (قبل الدور)</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {WK_POWERUPS.filter(p => p.preTurn).map(p => {
                  const used = room.powerUpsUsed[team][p.id]
                  const active = room.activePowerUps[p.id as 'double' | 'deduct' | 'silence']
                  return (
                    <button key={p.id} disabled={used}
                      onClick={() => { if (p.id === 'silence') setSilencePick(true); else activatePowerUp(room.code, team, p.id as 'double' | 'deduct') }}
                      style={powerBtn(p.color, active, used)}>
                      <span>{p.icon} {p.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.8 }}>{active ? 'مفعّلة لهذا الدور ✓' : used ? 'استُخدمت' : p.desc}</span>
                    </button>
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
          <button onClick={handleStartTurn} style={primaryBtn}>▶️ ابدأ الدور</button>
          <SkipCancelRow room={room} />
        </>
      )}

      {(room.phase === 'reading' || room.phase === 'acting' || room.phase === 'stealing') && w && (
        <>
          {room.categoryExhausted && (
            <div style={{ fontSize: 12, fontWeight: 800, color: C.orange, background: `${C.orange}14`, padding: '8px 12px', borderRadius: 10, textAlign: 'center' }}>
              ⚠️ خلصت الأعمال الجديدة بهذي الفئة — نعيد أعمال شفتها قبل
            </div>
          )}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionTitle style={{ margin: 0 }}>العمل (للمقدّم فقط 🤫)</SectionTitle>
              <button onClick={() => toggleQuestionHidden(room.code, !room.questionHidden)} style={ghostBtn}>{room.questionHidden ? '👁 إظهار' : '🙈 إخفاء'}</button>
            </div>
            {!room.questionHidden ? (
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                {w.posterUrl ? <img src={w.posterUrl} alt="" width={84} style={{ borderRadius: 12, objectFit: 'cover' }} /> : <div style={{ width: 84, height: 116, borderRadius: 12, background: `${C.ink}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎬</div>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{w.title}</div>
                  <div style={{ fontSize: 12, color: `${C.ink}99`, marginTop: 4 }}>{[w.year, w.country].filter(Boolean).join(' · ')}</div>
                  {w.actors?.length > 0 && <div style={{ fontSize: 12, color: `${C.ink}99`, marginTop: 2 }}>👤 {w.actors.join('، ')}</div>}
                  {w.extraInfo && <div style={{ fontSize: 12, color: `${C.ink}aa`, marginTop: 4 }}>{w.extraInfo}</div>}
                </div>
              </div>
            ) : <div style={{ padding: 20, textAlign: 'center', color: `${C.ink}66` }}>العمل مخفي</div>}
          </Card>

          {room.phase === 'reading' && <button onClick={() => beginActing(room.code)} style={primaryBtn}>جاهز — ابدأ التمثيل ▶️</button>}

          {room.phase === 'acting' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => markCorrect(room.code, team)} style={successBtn}>✅ صح ({room.teams[team].name})</button>
              <button onClick={() => markWrong(room.code)} style={dangerBtn}>❌ غلط → سرقة</button>
            </div>
          )}

          {room.phase === 'stealing' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => markCorrect(room.code, other)} style={{ ...successBtn, background: C.red }}>🥷 سرقها {room.teams[other].name}</button>
              <button onClick={() => onStealTimeUp(room.code)} style={dangerBtn}>ما خمّنوا</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {!room.powerUpsUsed[team].joker && (
              <button onClick={async () => { const o = await useJoker(room.code); if (o === 'redoWithNewWork') setTimeout(() => startTurn(room.code, room.hostId), 1200) }} style={{ ...ghostBtn, flex: 1, borderColor: C.orange, color: C.orange }}>🃏 جوكر</button>
            )}
            <button onClick={() => togglePause(room.code)} style={{ ...ghostBtn, flex: 1 }}>{room.paused ? '▶️ استئناف' : '⏸ إيقاف'}</button>
            <button onClick={() => resetPhaseTimer(room.code)} style={{ ...ghostBtn, flex: 1 }}>🔄 إعادة الوقت</button>
          </div>
          {room.joker && <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: C.orange }}>🃏 نتيجة الجوكر: {room.joker.outcome === 'addPoint' ? 'إضافة نقطة' : room.joker.outcome === 'deductPoint' ? 'خصم نقطة' : 'إعادة تمثيل بعمل جديد'}</div>}
          <SkipCancelRow room={room} />
        </>
      )}

      {room.phase === 'resolved' && (
        <>
          <Card>
            <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, color: room.lastResult?.points ? '#27AE78' : `${C.ink}88` }}>
              {room.lastResult?.type === 'correct' && `✅ نقطة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult?.type === 'steal' && `🥷 سرقة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult?.type === 'timeout' && '⏱ انتهى الوقت — ولا نقطة'}
            </div>
          </Card>
          <button onClick={() => nextTurn(room.code)} style={primaryBtn}>الدور التالي ←</button>
        </>
      )}

      {room.phase === 'roundEnd' && (
        <>
          <Card><div style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: C.orange }}>انتهت الجولة 🎬</div></Card>
          <button onClick={() => continueAfterRound(room.code)} style={primaryBtn}>ابدأ الجولة التالية ←</button>
        </>
      )}
    </div>
  )
}

function SkipCancelRow({ room }: { room: WalaKelmaRoom }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(room.phase === 'reading' || room.phase === 'acting' || room.phase === 'idle') && <button onClick={() => skipTurn(room.code)} style={{ ...ghostBtn, flex: 1 }}>⏭ تخطّي العمل</button>}
      <button onClick={() => { if (confirm('إنهاء المباراة؟')) cancelMatch(room.code) }} style={{ ...ghostBtn, flex: 1, color: C.red, borderColor: `${C.red}55` }}>🏁 إنهاء</button>
    </div>
  )
}

// ═══════════════ FINISHED ═══════════════
function FinishedScreen({ room, onNew }: { room: WalaKelmaRoom; onNew: () => void }) {
  const win = room.winner
  const bestActor = getBestActor(room)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', paddingTop: 30, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>🏆</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: win === 'A' ? C.violet : win === 'B' ? C.red : C.ink }}>{win === 'draw' ? 'تعادل!' : `فاز ${room.teams[win as TeamId].name}`}</div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        {(['A', 'B'] as TeamId[]).map(id => (
          <div key={id} style={{ flex: 1, padding: 16, borderRadius: 16, background: '#fff', border: `1px solid ${C.ink}12` }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{room.teams[id].name}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: id === 'A' ? C.violet : C.red }}>{room.teams[id].score}</div>
          </div>
        ))}
      </div>
      {bestActor && (
        <div style={{ background: `${C.orange}14`, borderRadius: 14, padding: '10px 20px' }}>
          <span style={{ fontSize: 13, color: `${C.ink}88`, fontWeight: 700 }}>🎭 أفضل ممثل: </span>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.orange }}>{bestActor.playerName}</span>
        </div>
      )}
      <ShareResultButton room={room} refUid={room.hostId} />
      <button onClick={onNew} style={{ ...primaryBtn, maxWidth: 280 }}>🎭 مباراة جديدة</button>
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
      <div style={{ fontSize: 50 }}>😕</div>
      <p style={{ fontSize: 18, fontWeight: 800, color: C.ink, marginTop: 10 }}>{msg}</p>
      <button onClick={onBack} style={{ ...primaryBtn, maxWidth: 220, marginTop: 16 }}>رجوع</button>
    </div>
  </div>
}
function Header({ title }: { title: string }) {
  return <div style={{ textAlign: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={46} /></div>
    <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginTop: 6 }}>{title}</div>
  </div>
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) { return <div style={{ background: '#fff', borderRadius: 18, padding: 16, border: `1px solid ${C.ink}12`, ...style }}>{children}</div> }
function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) { return <p style={{ fontSize: 12, fontWeight: 900, color: `${C.ink}77`, marginBottom: 8, ...style }}>{children}</p> }
function Muted({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: 12, color: `${C.ink}88` }}>{children}</p> }
function ErrorText({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: 13, fontWeight: 700, color: C.red, textAlign: 'center' }}>{children}</p> }
function Input({ value, onChange, placeholder, accent }: { value: string; onChange: (v: string) => void; placeholder: string; accent?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle(accent)} />
}

const inputStyle = (accent?: string): React.CSSProperties => ({ width: '100%', padding: '11px 12px', borderRadius: 12, border: `1px solid ${accent ? accent + '55' : C.ink + '20'}`, fontSize: 14, color: C.ink, background: C.cream, outline: 'none', marginBottom: 8 })
const primaryBtn: React.CSSProperties = { width: '100%', padding: 15, borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 16, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, cursor: 'pointer' }
const successBtn: React.CSSProperties = { flex: 1, padding: 15, borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, background: '#27AE78', cursor: 'pointer' }
const dangerBtn: React.CSSProperties = { flex: 1, padding: 15, borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, background: C.red, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { padding: '9px 12px', borderRadius: 12, border: `1.5px solid ${C.ink}22`, background: 'transparent', color: `${C.ink}cc`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { width: 40, borderRadius: 12, border: `1px solid ${C.ink}20`, background: '#fff', fontWeight: 900, fontSize: 18, cursor: 'pointer' }
const miniBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.ink}20`, background: C.cream, fontWeight: 900, fontSize: 16, cursor: 'pointer', color: C.ink }
const pill = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${on ? C.red : C.ink + '22'}`, background: on ? `${C.red}14` : 'transparent', color: on ? C.red : `${C.ink}99` })
const choice = (on: boolean): React.CSSProperties => ({ flex: 1, padding: 12, borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', border: `1.5px solid ${on ? C.violet : C.ink + '18'}`, background: on ? `${C.violet}14` : '#fff', color: on ? C.violet : `${C.ink}99` })
const powerBtn = (color: string, active: boolean, used: boolean): React.CSSProperties => ({ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${used ? C.ink + '18' : color}`, background: used ? `${C.ink}08` : active ? `${color}20` : `${color}0d`, color: used ? `${C.ink}55` : color, fontWeight: 800, fontSize: 14, cursor: used ? 'not-allowed' : 'pointer', opacity: used ? 0.6 : 1, textAlign: 'right', width: '100%' })
