// أعمال مخصصة لكل مستخدم — Firestore: customWorks/{uid}/works
// فئة "مخصصة" محلية (لا تُخزَّن بـ walaKelmaCategories)، تظهر بمنتقي الفئات لصاحبها فقط
import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore'
import type { Difficulty } from './works'

export const CUSTOM_WORKS = 'customWorks'
export const CUSTOM_CATEGORY_ID = 'custom'
export const CUSTOM_CATEGORY_NAME = '⭐ فئتي الخاصة'
export const FREE_CUSTOM_LIMIT = 50

export interface CustomWork {
  id: string
  title: string
  hint: string
  difficulty: Difficulty
  posterUrl: string
  createdAt: number
}

export type NewCustomWork = Omit<CustomWork, 'id' | 'createdAt'>

export async function getCustomWorks(uid: string): Promise<CustomWork[]> {
  try {
    const snap = await getDocs(collection(db, CUSTOM_WORKS, uid, 'works'))
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CustomWork)).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

// حد 50 لمن ما عنده رصيد نشط، بدون حد لمن عنده رصيد
export async function addCustomWork(uid: string, data: NewCustomWork, hasActiveBalance: boolean): Promise<{ success: true; id: string } | { success: false; error: string }> {
  if (!hasActiveBalance) {
    const existing = await getCustomWorks(uid)
    if (existing.length >= FREE_CUSTOM_LIMIT) {
      return { success: false, error: `وصلت الحد المجاني (${FREE_CUSTOM_LIMIT} عمل) — اشترِ باقة لإضافة أعمال بلا حد` }
    }
  }
  const ref = await addDoc(collection(db, CUSTOM_WORKS, uid, 'works'), { ...data, createdAt: Date.now() })
  await updateDoc(ref, { id: ref.id })
  return { success: true, id: ref.id }
}

export async function deleteCustomWork(uid: string, workId: string): Promise<void> {
  await deleteDoc(doc(db, CUSTOM_WORKS, uid, 'works', workId))
}

// اختيار عشوائي من الأعمال المخصصة (بدون منع تكرار عبر مباريات — قائمة المستخدم الخاصة صغيرة أصلاً)
export async function pickRandomCustomWork(uid: string, usedInMatch: Set<string>): Promise<CustomWork | null> {
  const all = await getCustomWorks(uid)
  const candidates = all.filter(w => !usedInMatch.has(w.id))
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export async function getCustomWorksCount(uid: string): Promise<number> {
  const snap = await getDocs(collection(db, CUSTOM_WORKS, uid, 'works'))
  return snap.size
}

// مشاركة الفئة المخصصة بكود (ينسخ كل الأعمال لحساب صديق)
export async function shareCustomWorksTo(fromUid: string, toUid: string): Promise<number> {
  const works = await getCustomWorks(fromUid)
  await Promise.all(works.map(w => {
    const { id, ...rest } = w
    void id
    return addDoc(collection(db, CUSTOM_WORKS, toUid, 'works'), { ...rest, createdAt: Date.now() })
  }))
  return works.length
}

export async function userExists(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists()
}
