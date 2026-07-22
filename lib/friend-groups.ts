// لوحة الصدارة بين الأصدقاء — Firestore: friendGroups/{id}
// كل مباراة ينهيها المضيف تُضيف نقاط لعضويته بأي مجموعة منضم لها (فوز=3، تعادل=1، خسارة=0)
import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, getDoc, getDocs, query, where } from 'firebase/firestore'

export const FRIEND_GROUPS = 'friendGroups'

export interface GroupMember {
  uid: string
  name: string
  points: number
  wins: number
  gamesPlayed: number
}

export interface FriendGroup {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  members: GroupMember[]
  memberUids: string[]           // نسخة مسطّحة من members[].uid — للاستعلام بـ array-contains
  lastResetMonth: string         // "YYYY-MM"
  lastMonthChampion: { name: string; points: number } | null
  createdAt: number
}

function genInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// تصفير شهري كسول — يُطبَّق أول ما تُقرأ المجموعة بعد بداية شهر جديد
function applyMonthlyResetIfNeeded(g: FriendGroup): FriendGroup {
  const month = currentMonthKey()
  if (g.lastResetMonth === month) return g
  const champion = [...g.members].sort((a, b) => b.points - a.points)[0]
  return {
    ...g,
    lastResetMonth: month,
    lastMonthChampion: champion && champion.points > 0 ? { name: champion.name, points: champion.points } : g.lastMonthChampion,
    members: g.members.map(m => ({ ...m, points: 0, wins: 0, gamesPlayed: 0 })),
  }
}

async function persistIfReset(g: FriendGroup, original: FriendGroup): Promise<FriendGroup> {
  if (g.lastResetMonth !== original.lastResetMonth) {
    await updateDoc(doc(db, FRIEND_GROUPS, g.id), {
      lastResetMonth: g.lastResetMonth, lastMonthChampion: g.lastMonthChampion, members: g.members,
    })
  }
  return g
}

export async function createGroup(ownerId: string, ownerName: string, name: string): Promise<string> {
  const member: GroupMember = { uid: ownerId, name: ownerName, points: 0, wins: 0, gamesPlayed: 0 }
  const ref = await addDoc(collection(db, FRIEND_GROUPS), {
    name, ownerId, inviteCode: genInviteCode(), members: [member], memberUids: [ownerId],
    lastResetMonth: currentMonthKey(), lastMonthChampion: null, createdAt: Date.now(),
  })
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function joinGroupByCode(inviteCode: string, uid: string, name: string): Promise<{ success: true; groupId: string } | { success: false; error: string }> {
  const snap = await getDocs(query(collection(db, FRIEND_GROUPS), where('inviteCode', '==', inviteCode.toUpperCase().trim())))
  if (snap.empty) return { success: false, error: 'الكود غير صحيح' }
  const g = { ...snap.docs[0].data(), id: snap.docs[0].id } as FriendGroup
  if (g.memberUids.includes(uid)) return { success: true, groupId: g.id }
  const member: GroupMember = { uid, name, points: 0, wins: 0, gamesPlayed: 0 }
  await updateDoc(doc(db, FRIEND_GROUPS, g.id), {
    members: [...g.members, member], memberUids: [...g.memberUids, uid],
  })
  return { success: true, groupId: g.id }
}

export async function getUserGroups(uid: string): Promise<FriendGroup[]> {
  try {
    const snap = await getDocs(query(collection(db, FRIEND_GROUPS), where('memberUids', 'array-contains', uid)))
    const groups = snap.docs.map(d => ({ ...d.data(), id: d.id } as FriendGroup))
    const resolved = await Promise.all(groups.map(async g => {
      const reset = applyMonthlyResetIfNeeded(g)
      return persistIfReset(reset, g)
    }))
    return resolved
  } catch {
    return []
  }
}

export async function getGroup(id: string): Promise<FriendGroup | null> {
  const snap = await getDoc(doc(db, FRIEND_GROUPS, id))
  if (!snap.exists()) return null
  const g = { ...snap.data(), id: snap.id } as FriendGroup
  const reset = applyMonthlyResetIfNeeded(g)
  return persistIfReset(reset, g)
}

// يُستدعى عند انتهاء أي مباراة — يحدّث نقاط المضيف بكل مجموعاته
export async function recordGroupResult(hostId: string, result: 'win' | 'draw' | 'loss'): Promise<void> {
  try {
    const groups = await getUserGroups(hostId)
    const points = result === 'win' ? 3 : result === 'draw' ? 1 : 0
    await Promise.all(groups.map(g => {
      const members = g.members.map(m => m.uid === hostId
        ? { ...m, points: m.points + points, wins: m.wins + (result === 'win' ? 1 : 0), gamesPlayed: m.gamesPlayed + 1 }
        : m)
      return updateDoc(doc(db, FRIEND_GROUPS, g.id), { members })
    }))
  } catch (e) {
    console.error('recordGroupResult:', e)
  }
}
