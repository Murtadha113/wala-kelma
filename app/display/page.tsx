'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { subscribeToWalaKelmaRoom, WalaKelmaRoom, TeamId, getBestActor } from '@/lib/wala-kelma'
import { getCategories, type WKCategory } from '@/lib/works'
import { CUSTOM_CATEGORY_ID, CUSTOM_CATEGORY_NAME } from '@/lib/custom-works'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { serverNow } from '@/lib/firebase'
import {
  useWalaKelmaCountdown, useResultSounds, phaseTotal, PHASE_LABEL,
  TimerRing, ScoreBoard, PowerUpsGrid, useWakeLock, toggleFullscreen, GradientBlobs, Confetti,
} from '@/components/shared'
import { playDrumRollSound, playWinSound } from '@/lib/sound'
import { Logo } from '@/components/logo'
import { Volume2, VolumeX, Maximize, Tv, Trophy, Zap, MicOff, Pause, Dices, Drama } from 'lucide-react'

const C = WK_COLORS

function DisplayInner() {
  const params = useSearchParams()
  const router = useRouter()
  const code = (params.get('code') || '').toUpperCase()
  const [room, setRoom] = useState<WalaKelmaRoom | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cats, setCats] = useState<WKCategory[]>([])
  const [hostAway, setHostAway] = useState(false)
  const [tiebreakBanner, setTiebreakBanner] = useState(false)
  const wasTiebreak = useRef(false)

  useEffect(() => {
    if (!code) { router.replace('/'); return }
    let got = false
    const unsub = subscribeToWalaKelmaRoom(code, r => {
      if (r) { got = true; setRoom(r) }
      else if (!got) setNotFound(true)
    })
    return () => unsub()
  }, [code])

  useEffect(() => { getCategories().then(setCats) }, [])

  const timeLeft = useWalaKelmaCountdown(room, false, muted)
  useResultSounds(room, muted)
  useWakeLock(!!room && room.status !== 'finished')

  // انقطاع المقدّم — لو آخر نبضة قلب تجاوزت 15 ثانية نعرض تنبيه بدل ما نتجمّد بصمت
  useEffect(() => {
    if (!room || room.status !== 'playing') { setHostAway(false); return }
    const check = () => setHostAway(!!room.hostLastSeen && serverNow() - room.hostLastSeen > 15000)
    check()
    const t = setInterval(check, 3000)
    return () => clearInterval(t)
  }, [room?.hostLastSeen, room?.status])

  // دخول الجولة الفاصلة — إعلان مرئي مؤقت بدل تبديل نص هادئ
  useEffect(() => {
    if (!room?.isTiebreak) { wasTiebreak.current = false; return }
    // ملاحظة: ما نوقف الجدولة بحارس wasTiebreak — بس نمنع تكرار الصوت/الإعلان وقت الإعادة المزدوجة بوضع React Strict
    if (!wasTiebreak.current) {
      wasTiebreak.current = true
      setTiebreakBanner(true)
      if (!muted) playWinSound()
    }
    const t = setTimeout(() => setTiebreakBanner(false), 2600)
    return () => clearTimeout(t)
  }, [room?.isTiebreak, muted])

  if (notFound) {
    return <Center><div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Tv size={56} color={`${C.ink}55`} /></div>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: C.ink }}>الكود غير صحيح</h2>
      <p style={{ color: `${C.ink}88`, marginTop: 8 }}>تأكد من كود المباراة عند المقدّم</p>
    </div></Center>
  }
  if (!room) {
    return <Center><div style={{ textAlign: 'center' }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', border: `4px solid ${C.violet}30`, borderTopColor: C.violet, margin: '0 auto', animation: 'wkspin 0.8s linear infinite' }} />
      <p style={{ marginTop: 16, color: `${C.ink}aa`, fontWeight: 700 }}>جاري الاتصال بالمباراة…</p>
      <style>{`@keyframes wkspin{to{transform:rotate(360deg)}}`}</style>
    </div></Center>
  }

  if (room.status === 'setup') {
    return <Center><div className="wk-pop-in" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={140} priority /></div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span>جاري إعداد المباراة</span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <span key={i} className="wk-dot-bounce" style={{ width: 6, height: 6, borderRadius: '50%', background: C.violet, animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </div>
      <div style={{ marginTop: 24, display: 'inline-flex', gap: 10, alignItems: 'center', background: '#fff', padding: '12px 22px', borderRadius: 999, border: `1px solid ${C.ink}14` }}>
        <span style={{ color: `${C.ink}88`, fontWeight: 700 }}>كود المباراة</span>
        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.3em', color: C.violet }}>{room.code}</span>
      </div>
    </div></Center>
  }

  if (room.status === 'draw') {
    return <DisplayDrawScreen room={room} cats={cats} />
  }

  if (room.status === 'finished') {
    const win = room.winner
    const bestActor = getBestActor(room)
    return <Center>
      <Confetti count={90} active={win !== 'draw'} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(18px, 2.2vw, 30px)', fontWeight: 800, color: `${C.ink}aa` }}>انتهت المباراة</div>
        <div className="wk-float" style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}><Trophy size={72} color={C.orange} style={{ width: 'clamp(50px, 7vw, 100px)', height: 'clamp(50px, 7vw, 100px)' }} /></div>
        <div className="wk-pop-in" style={{ fontSize: 'clamp(30px, 5vw, 72px)', fontWeight: 900, marginTop: 8, color: win === 'A' ? C.violet : win === 'B' ? C.red : C.ink }}>
          {win === 'draw' ? 'تعادل!' : `فاز ${room.teams[win as TeamId].name}`}
        </div>
        <div style={{ marginTop: 28, width: 'clamp(360px, 40vw, 640px)', maxWidth: '86vw' }}><ScoreBoard room={room} size="lg" /></div>
        {room.playerNamesEnabled !== false && bestActor && (
          <div style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8, background: `${C.orange}14`, borderRadius: 14, padding: '10px 24px', border: `1px solid ${C.orange}22`, boxShadow: `0 10px 26px ${C.orange}1c` }}>
            <Drama size={18} color={C.orange} />
            <span style={{ fontSize: 15, color: `${C.ink}88`, fontWeight: 700 }}>أفضل ممثل: </span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.orange }}>{bestActor.playerName}</span>
          </div>
        )}
      </div>
    </Center>
  }

  const slot = room.turnOrder[room.currentTurnIndex]
  const nextSlot = room.turnOrder.length > 1 ? room.turnOrder[(room.currentTurnIndex + 1) % room.turnOrder.length] : null
  const activeColor = room.activeTeam === 'A' ? C.violet : C.red
  const timed = room.phase === 'reading' || room.phase === 'acting' || room.phase === 'stealing'
  const stealing = room.phase === 'stealing'
  const silencedName = room.silencedPlayerId
    ? [...room.teams.A.players, ...room.teams.B.players].find(p => p.id === room.silencedPlayerId)?.name
    : null

  return (
    <div dir="rtl" style={{
      minHeight: '100dvh', background: stealing ? `linear-gradient(${C.cream}, ${C.red}0d)` : C.cream,
      display: 'flex', flexDirection: 'column', padding: '24px clamp(16px,4vw,48px)', position: 'relative', overflow: 'hidden',
      transition: 'background 0.4s',
    }}>
      <GradientBlobs />
      {hostAway && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,32,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', border: `4px solid ${C.orange}55`, borderTopColor: C.orange, animation: 'wkspin 0.8s linear infinite' }} />
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>بانتظار المقدّم...</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>يبدو إن اتصال المقدّم انقطع</div>
        </div>
      )}
      {tiebreakBanner && (
        <div style={{ position: 'fixed', inset: 0, background: `linear-gradient(135deg, ${C.violet}, ${C.red})`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 95 }}>
          <div className="wk-pop-in" style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Zap size={72} style={{ width: 'clamp(46px, 6vw, 90px)', height: 'clamp(46px, 6vw, 90px)' }} /></div>
            <div style={{ fontSize: 'clamp(30px, 5vw, 66px)', fontWeight: 900, marginTop: 10 }}>الجولة الفاصلة!</div>
          </div>
        </div>
      )}
      {room.paused && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,32,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, flexDirection: 'column', gap: 8 }}>
          <Pause size={56} color="#fff" />
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>إيقاف مؤقت</div>
        </div>
      )}
      <div style={{ position: 'fixed', top: 10, left: 10, display: 'flex', gap: 6, zIndex: 30 }}>
        <button onClick={() => setMuted(m => !m)} title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.ink}18`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button onClick={toggleFullscreen} title="ملء الشاشة"
          style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.ink}18`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Maximize size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo height={30} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{room.matchName || 'مباراة'}</div>
          <div style={{ fontSize: 13, color: `${C.ink}88` }}>
            {room.isTiebreak ? 'الجولة الفاصلة' : `الجولة ${room.currentRound} من ${room.totalRounds} — سؤال ${Math.min((room.turnsThisRound || 0) + 1, room.questionsPerRound || 1)} من ${room.questionsPerRound}`}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: `${C.ink}66`, letterSpacing: '0.2em' }}>{room.code}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        {stealing && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'absolute', top: -20, width: 140, height: 140, borderRadius: '50%', animation: 'wkStealPulse 1s ease-out infinite' }} />
            <div style={{ fontSize: 'clamp(22px, 3.4vw, 46px)', fontWeight: 900, color: C.red, animation: 'wkflash 0.6s infinite', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={32} /> فرصة سرقة — {room.teams[room.activeTeam === 'A' ? 'B' : 'A'].name}!
            </div>
          </div>
        )}
        {!stealing && <>
          <div style={{ fontSize: 'clamp(15px, 2vw, 26px)', color: `${C.ink}99` }}>{PHASE_LABEL[room.phase]}</div>
          <div style={{ fontSize: 'clamp(28px, 4.6vw, 68px)', fontWeight: 900, color: activeColor, textAlign: 'center' }}>{room.teams[room.activeTeam].name}</div>
          {room.playerNamesEnabled !== false && slot && <div style={{ fontSize: 'clamp(17px, 2.4vw, 32px)', fontWeight: 700, color: C.ink, textAlign: 'center' }}>يمثّل الآن: {slot.playerName}</div>}
          {room.playerNamesEnabled !== false && nextSlot && (room.phase === 'idle' || room.phase === 'reading' || room.phase === 'acting') && (
            <div style={{ fontSize: 'clamp(12px, 1.3vw, 17px)', color: `${C.ink}66`, fontWeight: 700 }}>التالي: {nextSlot.playerName}</div>
          )}
        </>}
        {silencedName && (room.phase === 'acting' || room.phase === 'stealing') && (
          <div style={{ fontSize: 'clamp(13px, 1.8vw, 22px)', fontWeight: 800, color: C.violet, background: `${C.violet}14`, padding: '6px 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MicOff size={16} /> {silencedName} مُسكت هذا الدور
          </div>
        )}

        {timed && <TimerRing timeLeft={timeLeft} total={phaseTotal(room)} danger={room.phase === 'stealing'} />}

        {room.phase === 'resolved' && room.lastResult && (
          <>
            <Confetti key={room.lastResult.ts} count={14} active={room.lastResult.points > 0} />
            <div key={room.lastResult.ts} className="wk-pop-in" style={{ fontSize: 'clamp(20px, 3.2vw, 46px)', fontWeight: 900, color: room.lastResult.points > 0 ? '#27AE78' : `${C.ink}88`, textAlign: 'center' }}>
              {room.lastResult.type === 'correct' && `✅ نقطة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult.type === 'steal' && `🥷 سرقة! نقطة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult.type === 'timeout' && '⏱ انتهى الوقت — ولا نقطة'}
            </div>
            {room.currentWork && (
              <div className="wk-slide-up" style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 18, padding: 14, border: `1px solid ${C.ink}12`, boxShadow: `0 12px 30px ${C.ink}12` }}>
                {room.currentWork.posterUrl && <img src={room.currentWork.posterUrl} alt="" width={64} style={{ borderRadius: 10, objectFit: 'cover' }} />}
                <div>
                  <div style={{ fontSize: 'clamp(11px, 1.2vw, 15px)', color: `${C.ink}77`, fontWeight: 700 }}>الإجابة الصحيحة</div>
                  <div style={{ fontSize: 'clamp(17px, 2.4vw, 30px)', fontWeight: 900, color: C.ink }}>{room.currentWork.title}</div>
                </div>
              </div>
            )}
          </>
        )}
        {room.phase === 'roundEnd' && <DisplayRoundEndSummary room={room} />}

        {room.joker && (room.phase === 'acting' || room.phase === 'reading') && (
          <div style={{ fontSize: 'clamp(15px, 2vw, 26px)', fontWeight: 800, color: C.orange, background: `${C.orange}18`, padding: '8px 16px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dices size={20} /> الجوكر: {room.joker.outcome === 'addPoint' ? 'إضافة نقطة' : room.joker.outcome === 'deductPoint' ? 'خصم نقطة' : 'إعادة تمثيل بعمل جديد'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ScoreBoard room={room} size="md" />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}><PowerUpsGrid room={room} teamId="A" /></div>
          <div style={{ flex: 1 }}><PowerUpsGrid room={room} teamId="B" /></div>
        </div>
      </div>
      <style>{`
        @keyframes wkflash{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes wkspin{to{transform:rotate(360deg)}}
        @keyframes wkStealPulse{0%{box-shadow:0 0 0 0 ${C.red}55}100%{box-shadow:0 0 0 60px transparent}}
      `}</style>
    </div>
  )
}

function DisplayRoundEndSummary({ room }: { room: WalaKelmaRoom }) {
  const a = room.teams.A.score || 0
  const b = room.teams.B.score || 0
  const diff = Math.abs(a - b)
  const leading = a === b ? null : a > b ? room.teams.A.name : room.teams.B.name
  return (
    <div className="wk-pop-in" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 'clamp(22px, 3.2vw, 44px)', fontWeight: 900, color: C.orange }}>انتهت الجولة {room.currentRound} 🎬</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {(['A', 'B'] as TeamId[]).map(id => (
          <div key={id} style={{ minWidth: 140, textAlign: 'center', padding: '14px 18px', borderRadius: 16, background: `${(id === 'A' ? C.violet : C.red)}0d`, border: `1px solid ${(id === 'A' ? C.violet : C.red)}22` }}>
            <div style={{ fontSize: 'clamp(13px, 1.5vw, 19px)', fontWeight: 800, color: `${C.ink}99` }}>{room.teams[id].name}</div>
            <div style={{ fontSize: 'clamp(28px, 4vw, 56px)', fontWeight: 900, color: id === 'A' ? C.violet : C.red }}>{room.teams[id].score}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 'clamp(14px, 1.8vw, 24px)', fontWeight: 800, color: `${C.ink}88`, marginTop: 14 }}>
        {leading ? `${leading} متقدّم بـ ${diff} ${diff === 1 ? 'نقطة' : 'نقاط'} 🔥` : 'تعادل حتى الآن 🤝'}
      </div>
    </div>
  )
}

function DisplayDrawScreen({ room, cats }: { room: WalaKelmaRoom; cats: WKCategory[] }) {
  const slot = room.turnOrder[room.currentTurnIndex]
  const catInfo = (id: string) => id === CUSTOM_CATEGORY_ID
    ? { name: CUSTOM_CATEGORY_NAME, imageUrl: undefined as string | undefined }
    : { name: cats.find(c => c.id === id)?.name || id, imageUrl: cats.find(c => c.id === id)?.imageUrl }

  const drawColor = room.activeTeam === 'A' ? C.violet : C.red
  const [revealed, setRevealed] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    // ملاحظة: ما نوقف الجدولة بحارس firedRef — بس نمنع تكرار الصوت وقت الإعادة المزدوجة بوضع React Strict
    if (!firedRef.current) { firedRef.current = true; playDrumRollSound() }
    const t = setTimeout(() => setRevealed(true), 1300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -140, right: -100, width: 380, height: 380, borderRadius: '50%', background: `${C.orange}22`, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', top: 200, left: -120, width: 320, height: 320, borderRadius: '50%', background: `${C.violet}1c`, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', bottom: -100, right: '30%', width: 260, height: 260, borderRadius: '50%', background: `${C.red}14`, filter: 'blur(60px)' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(20px,4vw,48px)', gap: 24 }}>
        <Logo height={64} priority />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.ink }}>{room.matchName || 'مباراة'}</div>
          <div style={{ fontSize: 13, color: `${C.ink}66`, letterSpacing: '0.2em', marginTop: 2, background: '#fff', display: 'inline-block', padding: '3px 12px', borderRadius: 999, border: `1px solid ${C.ink}12` }}>{room.code}</div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 720 }}>
          {(['A', 'B'] as TeamId[]).map((id, i) => {
            const tc = id === 'A' ? C.violet : C.red
            return (
              <div key={id} className="wk-slide-up" style={{
                flex: '1 1 260px', background: '#fff', borderRadius: 22, padding: 22,
                border: `2px solid ${tc}2a`, boxShadow: `0 10px 30px ${tc}14`,
                animationDelay: `${i * 150}ms`, animationFillMode: 'backwards',
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: tc, textAlign: 'center', marginBottom: 12 }}>{room.teams[id].name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {room.teams[id].players.map(p => (
                    <div key={p.id} style={{ fontSize: 15, fontWeight: 700, color: C.ink, textAlign: 'center', background: `${tc}0d`, borderRadius: 10, padding: '8px 10px' }}>{p.name}</div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ width: '100%', maxWidth: 720 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: `${C.ink}77`, textAlign: 'center', marginBottom: 10 }}>الفئات المختارة</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {room.categories.map(id => {
              const info = catInfo(id)
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 16, padding: '8px 16px 8px 8px', border: `1px solid ${C.ink}12`, boxShadow: `0 4px 14px ${C.ink}0a` }}>
                  {info.imageUrl
                    ? <img src={info.imageUrl} alt={info.name} width={44} height={44} style={{ borderRadius: 10, objectFit: 'cover' }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.violet}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Drama size={20} color={C.violet} /></div>}
                  <span style={{ fontSize: 14, fontWeight: 800, color: `${C.ink}cc` }}>{info.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {!revealed ? (
          <div style={{
            marginTop: 8, width: '100%', maxWidth: 420, height: 120, borderRadius: 24,
            background: `linear-gradient(135deg, ${C.ink}, ${C.ink}dd)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'wkDrawShake 0.25s ease-in-out infinite',
          }}>
            <Dices size={40} color="#fff" />
          </div>
        ) : (
          <div className="wk-pop-in" style={{
            marginTop: 8, textAlign: 'center', width: '100%', maxWidth: 420, borderRadius: 24, padding: '22px 24px',
            background: `linear-gradient(135deg, ${drawColor}, ${room.activeTeam === 'A' ? '#4726c9' : C.orange})`,
            color: '#fff', boxShadow: `0 14px 36px ${drawColor}33`,
          }}>
            <div style={{ fontSize: 15, opacity: 0.9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Dices size={16} /> القرعة — الفريق البادئ</div>
            <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4 }}>{room.teams[room.activeTeam].name}</div>
            {room.playerNamesEnabled !== false && slot && <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, opacity: 0.95 }}>أول لاعب: {slot.playerName}</div>}
          </div>
        )}
      </div>
      <style>{`@keyframes wkDrawShake{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}`}</style>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

export default function DisplayPage() {
  return <Suspense fallback={<Center><div style={{ color: `${C.ink}88` }}>جاري التحميل…</div></Center>}><DisplayInner /></Suspense>
}
