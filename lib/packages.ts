// طبقة بيانات الباقات — Firestore collection: packages
import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore'

export const PACKAGES = 'packages'

export interface Package {
  id: string
  nameAr: string
  descriptionAr: string
  gamesCount: number
  price: number          // بالدينار البحريني
  oldPrice: number | null
  isActive: boolean
  isFeatured: boolean
  order: number
  expiryDays: number | null   // null = بدون انتهاء
  createdAt: number
}

export type NewPackage = Omit<Package, 'id' | 'createdAt'>

export async function getActivePackages(): Promise<Package[]> {
  try {
    const snap = await getDocs(query(collection(db, PACKAGES), where('isActive', '==', true)))
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Package)).sort((a, b) => a.order - b.order)
  } catch {
    return []
  }
}

export async function getAllPackages(): Promise<Package[]> {
  try {
    const snap = await getDocs(query(collection(db, PACKAGES), orderBy('order', 'asc')))
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Package))
  } catch {
    return []
  }
}

export async function getPackage(id: string): Promise<Package | null> {
  const snap = await getDoc(doc(db, PACKAGES, id))
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Package) : null
}

export async function addPackage(data: NewPackage): Promise<string> {
  const ref = await addDoc(collection(db, PACKAGES), { ...data, createdAt: Date.now() })
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function updatePackage(id: string, data: Partial<Package>): Promise<void> {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  await updateDoc(doc(db, PACKAGES, id), clean as Record<string, never>)
}

export async function deletePackage(id: string): Promise<void> {
  await deleteDoc(doc(db, PACKAGES, id))
}
