'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { subscribeToWalaKelmaRoom, WalaKelmaRoom, TeamId, getBestActor } from '@/lib/wala-kelma'
import { getCategories, type WKCategory } from '@/lib/works'
import { CUSTOM_CATEGORY_ID, CUSTOM_CATEGORY_NAME } from '@/lib/custom-works'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import {
  useWalaKelmaCountdown, useResultSounds, phaseTotal, PHASE_LABEL,
  TimerRing, ScoreBoard, PowerUpsGrid, useWakeLock, toggleFullscreen, GradientBlobs,
} from '@/components/shared'
import { Logo } from '@/components/logo'

const C = WK_COLORS

function DisplayInner() {
  const params = useSearchParams()
  const router = useRouter()
  const code = (params.get('code') || '').toUpperCase()
  const [room, setRoom] = useState<WalaKelmaRoom | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cats, setCats] = useState<WKCategory[]>([])

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

  if (notFound) {
    return <Center><div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 60 }}>📺</div>
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
    return <Center><div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={140} priority /></div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginTop: 20 }}>جاري إعداد المباراة…</div>
      <div style={{ marginTop: 24, display: 'inline-flex', gap: 10, alignItems: 'center', background: '#fff', padding: '12px 22px', borderRadius: 999, border: `1px solid ${C.ink}14` }}>
        <span style={{ color: `${C.ink}88`, fontWeight: 700 }}>كود المباراة</span>
        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.3em', color: C.violet }}>{room.code}</span>
      </div>
    </div></Center>
  }

  if (room.status === 'draw') {
    const slot = room.turnOrder[room.currentTurnIndex]
    const catInfo = (id: string) => id === CUSTOM_CATEGORY_ID
      ? { name: CUSTOM_CATEGORY_NAME, imageUrl: undefined as string | undefined }
      : { name: cats.find(c => c.id === id)?.name || id, imageUrl: cats.find(c => c.id === id)?.imageUrl }

    const drawColor = room.activeTeam === 'A' ? C.violet : C.red

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
            {(['A', 'B'] as TeamId[]).map(id => {
              const tc = id === 'A' ? C.violet : C.red
              return (
                <div key={id} style={{
                  flex: '1 1 260px', background: '#fff', borderRadius: 22, padding: 22,
                  border: `2px solid ${tc}2a`, boxShadow: `0 10px 30px ${tc}14`,
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
                      : <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.violet}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎭</div>}
                    <span style={{ fontSize: 14, fontWeight: 800, color: `${C.ink}cc` }}>{info.name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{
            marginTop: 8, textAlign: 'center', width: '100%', maxWidth: 420, borderRadius: 24, padding: '22px 24px',
            background: `linear-gradient(135deg, ${drawColor}, ${room.activeTeam === 'A' ? '#4726c9' : C.orange})`,
            color: '#fff', boxShadow: `0 14px 36px ${drawColor}33`,
          }}>
            <div style={{ fontSize: 15, opacity: 0.9, fontWeight: 700 }}>القرعة 🎲 — الفريق البادئ</div>
            <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4 }}>{room.teams[room.activeTeam].name}</div>
            {slot && <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, opacity: 0.95 }}>أول لاعب: {slot.playerName}</div>}
          </div>
        </div>
      </div>
    )
  }

  if (room.status === 'finished') {
    const win = room.winner
    const bestActor = getBestActor(room)
    return <Center><div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: `${C.ink}aa` }}>انتهت المباراة</div>
      <div style={{ fontSize: 72, marginTop: 8 }}>🏆</div>
      <div style={{ fontSize: 44, fontWeight: 900, marginTop: 8, color: win === 'A' ? C.violet : win === 'B' ? C.red : C.ink }}>
        {win === 'draw' ? 'تعادل!' : `فاز ${room.teams[win as TeamId].name}`}
      </div>
      <div style={{ marginTop: 28, width: 360, maxWidth: '86vw' }}><ScoreBoard room={room} size="lg" /></div>
      {bestActor && (
        <div style={{ marginTop: 20, display: 'inline-block', background: `${C.orange}14`, borderRadius: 14, padding: '10px 24px', border: `1px solid ${C.orange}22`, boxShadow: `0 10px 26px ${C.orange}1c` }}>
          <span style={{ fontSize: 15, color: `${C.ink}88`, fontWeight: 700 }}>🎭 أفضل ممثل: </span>
          <span style={{ fontSize: 20, fontWeight: 900, color: C.orange }}>{bestActor.playerName}</span>
        </div>
      )}
    </div></Center>
  }

  const slot = room.turnOrder[room.currentTurnIndex]
  const activeColor = room.activeTeam === 'A' ? C.violet : C.red
  const timed = room.phase === 'reading' || room.phase === 'acting' || room.phase === 'stealing'
  const stealing = room.phase === 'stealing'

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', flexDirection: 'column', padding: '24px clamp(16px,4vw,48px)', position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'fixed', top: 10, left: 10, display: 'flex', gap: 6, zIndex: 30 }}>
        <button onClick={() => setMuted(m => !m)} title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.ink}18`, background: '#fff', cursor: 'pointer', fontSize: 15 }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button onClick={toggleFullscreen} title="ملء الشاشة"
          style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.ink}18`, background: '#fff', cursor: 'pointer', fontSize: 15 }}>
          ⛶
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
        {stealing && <div style={{ fontSize: 30, fontWeight: 900, color: C.red, animation: 'wkflash 0.6s infinite' }}>⚡ فرصة سرقة — {room.teams[room.activeTeam === 'A' ? 'B' : 'A'].name}!</div>}
        {!stealing && <>
          <div style={{ fontSize: 20, color: `${C.ink}99` }}>{PHASE_LABEL[room.phase]}</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: activeColor }}>{room.teams[room.activeTeam].name}</div>
          {slot && <div style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>يمثّل الآن: {slot.playerName}</div>}
        </>}
        {room.silencedPlayerId && (room.phase === 'acting' || room.phase === 'stealing') && (
          <div style={{ fontSize: 16, fontWeight: 800, color: C.violet, background: `${C.violet}14`, padding: '6px 14px', borderRadius: 999 }}>🤫 لاعب مُسكت هذا الدور</div>
        )}

        {timed && <TimerRing timeLeft={timeLeft} total={phaseTotal(room)} danger={room.phase === 'stealing'} />}
        {room.paused && <div style={{ fontSize: 18, fontWeight: 800, color: C.orange }}>⏸ إيقاف مؤقت</div>}

        {room.phase === 'resolved' && room.lastResult && (
          <>
            <div style={{ fontSize: 30, fontWeight: 900, color: room.lastResult.points > 0 ? '#27AE78' : `${C.ink}88` }}>
              {room.lastResult.type === 'correct' && `✅ نقطة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult.type === 'steal' && `🥷 سرقة! نقطة لـ ${room.teams[room.lastResult.team as TeamId].name}`}
              {room.lastResult.type === 'timeout' && '⏱ انتهى الوقت — ولا نقطة'}
            </div>
            {room.currentWork && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 18, padding: 14, border: `1px solid ${C.ink}12`, boxShadow: `0 12px 30px ${C.ink}12` }}>
                {room.currentWork.posterUrl && <img src={room.currentWork.posterUrl} alt="" width={64} style={{ borderRadius: 10, objectFit: 'cover' }} />}
                <div>
                  <div style={{ fontSize: 12, color: `${C.ink}77`, fontWeight: 700 }}>الإجابة الصحيحة</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.ink }}>{room.currentWork.title}</div>
                </div>
              </div>
            )}
          </>
        )}
        {room.phase === 'roundEnd' && <div style={{ fontSize: 30, fontWeight: 900, color: C.orange }}>انتهت الجولة 🎬</div>}

        {room.joker && (room.phase === 'acting' || room.phase === 'reading') && (
          <div style={{ fontSize: 20, fontWeight: 800, color: C.orange, background: `${C.orange}18`, padding: '8px 16px', borderRadius: 999 }}>
            🃏 الجوكر: {room.joker.outcome === 'addPoint' ? 'إضافة نقطة' : room.joker.outcome === 'deductPoint' ? 'خصم نقطة' : 'إعادة تمثيل بعمل جديد'}
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
      <style>{`@keyframes wkflash{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
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
