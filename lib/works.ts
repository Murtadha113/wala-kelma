// طبقة بيانات Firestore لـ "ولا كلمة": الفئات + الأعمال
import { db } from './firebase'
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs,
  query, where, writeBatch,
} from 'firebase/firestore'
import { WK_DEFAULT_CATEGORY_NAMES } from './wala-kelma-content'

export const CATEGORIES = 'walaKelmaCategories'
export const WORKS = 'walaKelmaWorks'

export type Difficulty = 'easy' | 'medium' | 'hard'

// ── الفئات ──
export interface WKCategory {
  id: string
  name: string
  order: number
  isActive: boolean
  imageUrl?: string
}

export async function getCategories(activeOnly = false): Promise<WKCategory[]> {
  try {
    const snap = await getDocs(collection(db, CATEGORIES))
    let cats = snap.docs.map(d => ({ ...d.data(), id: d.id } as WKCategory))
    if (activeOnly) cats = cats.filter(c => c.isActive !== false)
    return cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  } catch {
    return []
  }
}

export async function addCategory(name: string, order: number): Promise<string> {
  const ref = await addDoc(collection(db, CATEGORIES), { name, order, isActive: true })
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function updateCategory(id: string, data: Partial<WKCategory>): Promise<void> {
  await updateDoc(doc(db, CATEGORIES, id), data as Record<string, never>)
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, CATEGORIES, id))
}

// يزرع الفئات الافتراضية إن كانت المجموعة فارغة
export async function seedDefaultCategories(): Promise<number> {
  const existing = await getCategories()
  if (existing.length > 0) return existing.length
  await Promise.all(WK_DEFAULT_CATEGORY_NAMES.map((name, i) =>
    setDoc(doc(collection(db, CATEGORIES)), { name, order: i, isActive: true })
  ))
  return WK_DEFAULT_CATEGORY_NAMES.length
}

// ── الأعمال ──
export interface WalaKelmaWork {
  id: string
  title: string
  categoryId: string
  posterUrl: string
  year: number | null
  country: string | null
  actors: string[]
  extraInfo: string
  difficulty: Difficulty
  isActive: boolean
  random: number
  usageCount: number
  createdAt: number
}

export type NewWork = Omit<WalaKelmaWork, 'id' | 'random' | 'usageCount' | 'createdAt'>

export async function addWork(data: NewWork): Promise<string> {
  const ref = await addDoc(collection(db, WORKS), {
    ...data,
    random: Math.random(),
    usageCount: 0,
    createdAt: Date.now(),
  })
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function updateWork(id: string, data: Partial<WalaKelmaWork>): Promise<void> {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  await updateDoc(doc(db, WORKS, id), clean as Record<string, never>)
}

export async function deleteWork(id: string): Promise<void> {
  await deleteDoc(doc(db, WORKS, id))
}

export async function getWorksByCategory(categoryId: string): Promise<WalaKelmaWork[]> {
  const snap = await getDocs(query(collection(db, WORKS), where('categoryId', '==', categoryId)))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as WalaKelmaWork))
}

export async function getAllWorks(): Promise<WalaKelmaWork[]> {
  try {
    const snap = await getDocs(collection(db, WORKS))
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as WalaKelmaWork))
  } catch {
    return []
  }
}

// ── منع تكرار المحتوى (3 مستويات) ──
// مستوى 1: داخل نفس المباراة (usedInMatch — يمرره المتصل من room.usedWorkIds)
// مستوى 2: عبر كل مباريات المستخدم (seenWorks/{uid}/works) — يُستبعد هنا تلقائياً
// مستوى 3: لو نفدت كل الأعمال الجديدة، نعيد الأقدم مشاهدة (cooldown) بدل ما نوقف اللعبة
export const SEEN_WORKS = 'seenWorks'

export async function getSeenWorkIds(uid: string): Promise<Map<string, number>> {
  try {
    const snap = await getDocs(collection(db, SEEN_WORKS, uid, 'works'))
    return new Map(snap.docs.map(d => [d.id, (d.data().seenAt as number) ?? 0]))
  } catch {
    return new Map()
  }
}

export async function markWorkSeen(uid: string, workId: string, categoryId: string): Promise<void> {
  try {
    await setDoc(doc(db, SEEN_WORKS, uid, 'works', workId), { seenAt: Date.now(), categoryId })
  } catch { /* silent — لا نوقف اللعبة لو فشل التسجيل */ }
}

// يمسح سجل "شاهدته" بالكامل — زر "نسيت الأعمال" بصفحة الحساب
export async function clearSeenWorks(uid: string): Promise<void> {
  const snap = await getDocs(collection(db, SEEN_WORKS, uid, 'works'))
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

export interface PickResult {
  work: WalaKelmaWork
  exhausted: boolean   // true = نفدت الأعمال الجديدة بهذي الفئة، رجعنا لأقدم عمل مشاهد
}

// استعلام مساواة بسيط (in + ==) بدون orderBy/range — يشتغل بفهرسة Firestore التلقائية
// بدون الحاجة لإنشاء composite index يدوياً؛ الاختيار العشوائي يصير محلياً بعد الجلب
export async function pickRandomWork(
  categoryIds: string[],
  usedInMatch: Set<string>,
  uid?: string,
): Promise<PickResult | null> {
  if (categoryIds.length === 0) return null
  const cats = categoryIds.slice(0, 10)

  try {
    const snap = await getDocs(query(
      collection(db, WORKS),
      where('categoryId', 'in', cats),
      where('isActive', '==', true),
    ))
    const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as WalaKelmaWork))

    // مستوى 1: استبعاد أعمال هذي المباراة
    const notUsedThisMatch = all.filter(w => !usedInMatch.has(w.id))
    if (notUsedThisMatch.length === 0) return null

    const seenMap = uid ? await getSeenWorkIds(uid) : new Map<string, number>()

    // مستوى 2: من بين الباقي، فضّل الأعمال اللي المستخدم ما شافها أبداً
    const neverSeen = notUsedThisMatch.filter(w => !seenMap.has(w.id))
    if (neverSeen.length > 0) {
      const work = neverSeen[Math.floor(Math.random() * neverSeen.length)]
      if (uid) await markWorkSeen(uid, work.id, work.categoryId)
      return { work, exhausted: false }
    }

    // مستوى 3: نفدت الأعمال الجديدة — رجّع الأقدم مشاهدة (cooldown)
    const oldest = [...notUsedThisMatch].sort((a, b) => (seenMap.get(a.id) ?? 0) - (seenMap.get(b.id) ?? 0))[0]
    if (uid) await markWorkSeen(uid, oldest.id, oldest.categoryId)
    return { work: oldest, exhausted: true }
  } catch (e) {
    console.error('pickRandomWork query failed:', e)
    return null
  }
}
