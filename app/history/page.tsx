'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange, getUserProfile, type UserProfile } from '@/lib/auth'
import { getMatchHistory, replayFromHistory, type MatchHistoryEntry, type TeamId } from '@/lib/wala-kelma'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { Logo } from '@/components/logo'
import { GradientBlobs } from '@/components/shared'
import { BottomNav } from '@/components/bottom-nav'
import { History, RotateCcw } from 'lucide-react'

const C = WK_COLORS

export default function HistoryPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null | 'loading'>('loading')
  const [entries, setEntries] = useState<MatchHistoryEntry[] | 'loading'>('loading')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    return onAuthChange(async (user) => {
      if (!user) { router.replace('/login?next=/history'); return }
      setProfile(await getUserProfile(user.uid))
    })
  }, [router])

  useEffect(() => {
    if (profile === 'loading' || !profile) return
    getMatchHistory(profile.id).then(setEntries)
  }, [profile])

  const replay = async (entry: MatchHistoryEntry) => {
    if (profile === 'loading' || !profile) return
    setBusyId(entry.id)
    const res = await replayFromHistory(entry, profile.id, profile.name)
    if (res.success) router.push(`/host?resume=${res.code}`)
    else setBusyId(null)
  }

  if (profile === 'loading' || !profile) {
    return (
      <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `4px solid ${C.violet}30`, borderTopColor: C.violet, animation: 'wkspin 0.8s linear infinite' }} />
        <style>{`@keyframes wkspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', maxWidth: 440, margin: '0 auto', padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo height={30} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <History size={20} color={C.violet} />
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>سجل الألعاب</h1>
        </div>

        {entries === 'loading' && (
          <div style={{ textAlign: 'center', padding: 30, color: `${C.ink}66` }}>جاري التحميل…</div>
        )}

        {entries !== 'loading' && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 18, border: `1px solid ${C.ink}12` }}>
            <History size={36} color={`${C.ink}33`} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13, color: `${C.ink}77` }}>ما لعبت أي مباراة بعد — مبارياتك بتظهر هنا أول ما تخلص وحدة.</p>
          </div>
        )}

        {entries !== 'loading' && entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map(e => {
              const winnerName = e.winner === 'draw' ? 'تعادل' : `فاز ${e.teams[e.winner as TeamId].name}`
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: '#fff', borderRadius: 16, border: `1px solid ${C.ink}12`, boxShadow: `0 8px 22px ${C.ink}0a` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{e.matchName || 'مباراة ولا كلمة'}</div>
                    <div style={{ fontSize: 12, color: `${C.ink}88`, marginTop: 2 }}>
                      {e.teams.A.name} {e.teams.A.score} - {e.teams.B.score} {e.teams.B.name} · {winnerName}
                    </div>
                    <div style={{ fontSize: 11, color: `${C.ink}55`, marginTop: 3 }}>{new Date(e.finishedAt).toLocaleDateString('ar')}</div>
                  </div>
                  <button onClick={() => replay(e)} disabled={busyId === e.id}
                    style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${C.violet}55`, background: `${C.violet}0d`, color: C.violet, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', opacity: busyId === e.id ? 0.6 : 1 }}>
                    <RotateCcw size={14} /> {busyId === e.id ? '…' : 'إعادة'}
                  </button>
                </div>
              )
            })}
            <p style={{ fontSize: 11.5, color: `${C.ink}66`, textAlign: 'center', marginTop: 4, lineHeight: 1.6 }}>إعادة مباراة من السجل مجانية دايماً — بأسئلة جديدة (ما تتكرر).</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
