'use client'

// مكونات مشتركة للعبة "ولا كلمة" — المؤقّت المتزامن + عناصر العرض
import { useEffect, useRef, useState } from 'react'
import {
  WalaKelmaRoom, TeamId, WKPhase,
  beginActing,
} from '@/lib/wala-kelma'
import { WK_COLORS, WK_READ_SECONDS, WK_QUICK_READ_SECONDS, WK_STEAL_SECONDS, WK_POWERUPS } from '@/lib/wala-kelma-content'
import { playCorrectSound, playWrongSound, playWinSound, playTickSound } from '@/lib/sound'

const C = WK_COLORS

// خلفية متدرجة بألوان الهوية (بقع ضبابية) — تُستخدم بكل صفحات التطبيق لهوية بصرية موحّدة
export function GradientBlobs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
      <div style={{ position: 'absolute', top: -140, right: -100, width: 380, height: 380, borderRadius: '50%', background: `${C.orange}22`, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', top: 200, left: -120, width: 320, height: 320, borderRadius: '50%', background: `${C.violet}1c`, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', bottom: -100, right: '30%', width: 260, height: 260, borderRadius: '50%', background: `${C.red}14`, filter: 'blur(60px)' }} />
    </div>
  )
}

// كارت بظل ناعم بلون الفريق/الحالة — بديل موحّد للكارت الأبيض المسطّح
export function glowCard(color: string = C.ink, opacity = '14'): React.CSSProperties {
  return { background: '#fff', borderRadius: 20, border: `1px solid ${color}22`, boxShadow: `0 10px 28px ${color}${opacity}` }
}

// العدّاد: يحسب المتبقي، والمقدم فقط يطلق التحولات (isHost)
export function useWalaKelmaCountdown(room: WalaKelmaRoom | null, isHost: boolean, muted = false) {
  const [timeLeft, setTimeLeft] = useState(0)
  const firedRef = useRef<string>('')
  const lastTickRef = useRef<number>(-1)

  useEffect(() => {
    if (!room) { setTimeLeft(0); return }
    const timed = room.phase === 'reading' || room.phase === 'acting' || room.phase === 'stealing'
    if (!timed) { setTimeLeft(0); return }

    const compute = () => {
      if (room.paused) return Math.ceil((room.pausedRemainingMs ?? 0) / 1000)
      if (room.phaseEndsAt == null) return 0
      return Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000))
    }

    const tick = () => {
      const left = compute()
      setTimeLeft(left)
      if (!muted && !room.paused && left <= 10 && left > 0 && left !== lastTickRef.current) {
        lastTickRef.current = left
        playTickSound()
      }
      // القراءة تنتقل تلقائياً لوقت التمثيل (ما فيها قرار يحتاج المقدم).
      // لكن نهاية وقت التمثيل/السرقة تحتاج قرار المقدم (صح/غلط/سرقة) — ما ننقل المرحلة تلقائياً،
      // فقط نجمّد العدّاد عند صفر وننتظر ضغطة المقدم على الزر المناسب.
      if (isHost && !room.paused && room.phaseEndsAt != null && left <= 0 && room.phase === 'reading') {
        const key = `${room.phase}_${room.phaseEndsAt}`
        if (firedRef.current !== key) {
          firedRef.current = key
          beginActing(room.code)
        }
      }
    }

    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [room?.code, room?.phase, room?.phaseEndsAt, room?.paused, room?.pausedRemainingMs, isHost, muted])

  return timeLeft
}

export function phaseTotal(room: WalaKelmaRoom): number {
  if (room.phase === 'reading') return room.mode === 'quick' ? WK_QUICK_READ_SECONDS : WK_READ_SECONDS
  if (room.phase === 'acting') return room.explainDuration
  if (room.phase === 'stealing') return WK_STEAL_SECONDS
  return 0
}

export const PHASE_LABEL: Record<WKPhase, string> = {
  idle: 'استعداد',
  reading: 'وقت القراءة',
  acting: 'وقت التمثيل',
  stealing: 'فرصة السرقة!',
  resolved: 'انتهى الدور',
  roundEnd: 'انتهت الجولة',
  finished: 'انتهت المباراة',
}

export function TimerRing({ timeLeft, total, danger }: { timeLeft: number; total: number; danger?: boolean }) {
  const pct = total > 0 ? timeLeft / total : 0
  const R = 84, CIRC = 2 * Math.PI * R
  const critical = timeLeft <= 10
  const color = critical ? C.red : danger ? C.orange : C.violet
  const mm = Math.floor(timeLeft / 60)
  const ss = timeLeft % 60
  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      <svg width={200} height={200} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={100} cy={100} r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={14} />
        <circle cx={100} cy={100} r={R} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.4s linear, stroke 0.3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 44, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums',
        animation: critical ? 'wkPulse 0.7s infinite' : undefined }}>
        {mm > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : ss}
      </div>
      <style>{`@keyframes wkPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
    </div>
  )
}

export function ScoreBoard({ room, size = 'md' }: { room: WalaKelmaRoom; size?: 'sm' | 'md' | 'lg' }) {
  const font = size === 'lg' ? 56 : size === 'sm' ? 26 : 40
  const label = size === 'lg' ? 20 : 14
  const cell = (id: TeamId, color: string) => {
    const active = room.activeTeam === id && room.status === 'playing'
    return (
      <div style={{
        flex: 1, textAlign: 'center', padding: size === 'lg' ? '18px 12px' : '12px 8px',
        borderRadius: 20, border: `2px solid ${active ? color : 'rgba(0,0,0,0.08)'}`,
        background: active ? `${color}18` : 'rgba(255,255,255,0.6)', transition: 'all 0.3s',
        boxShadow: active ? `0 10px 26px ${color}22` : 'none',
      }}>
        <div style={{ fontSize: label, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{room.teams[id].name}</div>
        <div style={{ fontSize: font, fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{room.teams[id].score}</div>
      </div>
    )
  }
  return <div style={{ display: 'flex', gap: 10, direction: 'rtl' }}>{cell('A', C.violet)}{cell('B', C.red)}</div>
}

export function PowerUpsGrid({ room, teamId }: { room: WalaKelmaRoom; teamId: TeamId }) {
  const used = room.powerUpsUsed[teamId]
  const visible = room.mode === 'quick' ? WK_POWERUPS.filter(p => !p.preTurn) : WK_POWERUPS
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {visible.map(p => {
        const isUsed = used[p.id]
        return (
          <div key={p.id} title={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999,
            fontSize: 12, fontWeight: 800,
            border: `1.5px solid ${isUsed ? 'rgba(0,0,0,0.12)' : p.color}`,
            background: isUsed ? 'rgba(0,0,0,0.05)' : `${p.color}18`,
            color: isUsed ? 'rgba(0,0,0,0.35)' : p.color,
            opacity: isUsed ? 0.55 : 1, textDecoration: isUsed ? 'line-through' : 'none',
          }}>
            <span>{p.icon}</span><span>{p.name}</span>
          </div>
        )
      })}
    </div>
  )
}

export function useResultSounds(room: WalaKelmaRoom | null, muted = false) {
  const lastRef = useRef<number>(0)
  const finRef = useRef(false)
  useEffect(() => {
    if (!room) return
    if (room.lastResult && room.lastResult.ts !== lastRef.current) {
      lastRef.current = room.lastResult.ts
      if (!muted) {
        if (room.lastResult.type === 'correct' || room.lastResult.type === 'steal') playCorrectSound()
        else if (room.lastResult.type === 'timeout') playWrongSound()
      }
    }
    if (room.status === 'finished' && !finRef.current) { finRef.current = true; if (!muted) playWinSound() }
  }, [room?.lastResult?.ts, room?.status, muted])
}

// يمنع إطفاء الشاشة (مفيد لشاشة العرض على تلفاز/لابتوب أثناء المباراة) — يعيد الطلب تلقائياً لو رجعت الصفحة للواجهة
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let sentinel: { release: () => Promise<void> } | null = null
    const request = async () => {
      try { sentinel = await (navigator as any).wakeLock.request('screen') } catch { /* غير مدعوم أو رُفض */ }
    }
    request()
    const onVisible = () => { if (document.visibilityState === 'visible') request() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
    }
  }, [enabled])
}

export function toggleFullscreen() {
  if (typeof document === 'undefined') return
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
  else document.exitFullscreen?.().catch(() => {})
}
