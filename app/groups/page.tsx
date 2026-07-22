'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange, getUserProfile, type UserProfile } from '@/lib/auth'
import { createGroup, joinGroupByCode, getUserGroups, type FriendGroup } from '@/lib/friend-groups'
import { WK_COLORS } from '@/lib/wala-kelma-content'

const C = WK_COLORS

export default function GroupsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [groups, setGroups] = useState<FriendGroup[]>([])
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    return onAuthChange(async (user) => {
      if (!user) { router.replace('/login?next=/groups'); return }
      const p = await getUserProfile(user.uid)
      setProfile(p)
      if (p) getUserGroups(p.id).then(setGroups)
    })
  }, [router])

  const create = async () => {
    if (!profile || !name.trim()) return
    setBusy(true)
    await createGroup(profile.id, profile.name, name.trim())
    setName(''); setGroups(await getUserGroups(profile.id))
    setBusy(false)
  }

  const join = async () => {
    if (!profile || !joinCode.trim()) return
    setErr(''); setBusy(true)
    const res = await joinGroupByCode(joinCode.trim(), profile.id, profile.name)
    setBusy(false)
    if (!res.success) { setErr(res.error); return }
    setJoinCode(''); setGroups(await getUserGroups(profile.id))
  }

  if (!profile) {
    return <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: `4px solid ${C.red}30`, borderTopColor: C.red, animation: 'wkspin .8s linear infinite' }} />
      <style>{`@keyframes wkspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '20px 16px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.red }}>لوحات الصدارة</div>
          <a href="/account" style={{ fontSize: 13, color: `${C.ink}88`, textDecoration: 'none' }}>← حسابي</a>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 12, border: `1px solid ${C.ink}12` }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم مجموعة جديدة" style={miniInput} />
            <button onClick={create} disabled={busy} style={miniBtn}>+ إنشاء</button>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 12, border: `1px solid ${C.ink}12` }}>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الدعوة" style={miniInput} />
            <button onClick={join} disabled={busy} style={miniBtn}>انضمام</button>
          </div>
        </div>
        {err && <p style={{ color: C.red, fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>{err}</p>}

        {groups.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 20, textAlign: 'center', border: `1px solid ${C.ink}12` }}>
            <p style={{ color: `${C.ink}88`, fontSize: 13 }}>ما انضممت لأي مجموعة بعد — سوّي وحدة أو انضم بكود صديق.</p>
          </div>
        )}

        {groups.map(g => (
          <div key={g.id} style={{ background: '#fff', borderRadius: 18, padding: 16, border: `1px solid ${C.ink}12`, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: `${C.ink}66`, background: C.cream, padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>كود: {g.inviteCode}</div>
            </div>
            {g.lastMonthChampion && (
              <div style={{ fontSize: 12, color: C.orange, fontWeight: 700, marginBottom: 8 }}>👑 بطل الشهر الماضي: {g.lastMonthChampion.name} ({g.lastMonthChampion.points} نقطة)</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...g.members].sort((a, b) => b.points - a.points).map((m, i) => (
                <div key={m.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: i === 0 ? `${C.orange}14` : C.cream, borderRadius: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{i === 0 ? '🥇 ' : `${i + 1}. `}{m.name}</span>
                  <span style={{ fontSize: 13, color: `${C.ink}77` }}>{m.points} نقطة · {m.wins} فوز · {m.gamesPlayed} مباراة</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const miniInput: React.CSSProperties = { width: '100%', padding: 9, borderRadius: 9, border: `1px solid ${C.ink}20`, background: C.cream, fontSize: 13, outline: 'none', marginBottom: 6 }
const miniBtn: React.CSSProperties = { width: '100%', padding: 9, borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 12, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, cursor: 'pointer' }
