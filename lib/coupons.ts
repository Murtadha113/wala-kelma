// طبقة بيانات الكوبونات — Firestore: coupons + couponRedemptions
// التحقق والحساب يصير على العميل (لا يوجد باك-إند/Cloud Functions بهذا المشروع)
import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where } from 'firebase/firestore'

export const COUPONS = 'coupons'
export const COUPON_REDEMPTIONS = 'couponRedemptions'

export type CouponType = 'percent' | 'fixed' | 'free_games'

export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number
  appliesTo: string[] | 'all'
  maxUses: number | null
  usedCount: number
  maxUsesPerUser: number
  startsAt: number | null
  expiresAt: number | null
  isActive: boolean
  createdAt: number
}

export type NewCoupon = Omit<Coupon, 'id' | 'usedCount' | 'createdAt'>

export async function getAllCoupons(): Promise<Coupon[]> {
  try {
    const snap = await getDocs(collection(db, COUPONS))
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Coupon)).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function addCoupon(data: NewCoupon): Promise<string> {
  const ref = await addDoc(collection(db, COUPONS), {
    ...data, code: data.code.toUpperCase().trim(), usedCount: 0, createdAt: Date.now(),
  })
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function updateCoupon(id: string, data: Partial<Coupon>): Promise<void> {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  await updateDoc(doc(db, COUPONS, id), clean as Record<string, never>)
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db, COUPONS, id))
}

export type CouponCheck =
  | { valid: true; coupon: Coupon }
  | { valid: false; error: string }

export async function findAndValidateCoupon(code: string, userId: string, packageId: string): Promise<CouponCheck> {
  const snap = await getDocs(query(collection(db, COUPONS), where('code', '==', code.toUpperCase().trim())))
  if (snap.empty) return { valid: false, error: 'الكود غير صحيح' }
  const coupon = { ...snap.docs[0].data(), id: snap.docs[0].id } as Coupon

  if (!coupon.isActive) return { valid: false, error: 'هذا الكود غير فعّال' }
  const now = Date.now()
  if (coupon.startsAt && now < coupon.startsAt) return { valid: false, error: 'الكود ما بدأ بعد' }
  if (coupon.expiresAt && now > coupon.expiresAt) return { valid: false, error: 'انتهت صلاحية الكود' }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return { valid: false, error: 'تم استنفاد هذا الكود' }
  if (coupon.appliesTo !== 'all' && !coupon.appliesTo.includes(packageId)) return { valid: false, error: 'الكود لا ينطبق على هذي الباقة' }

  const usedByMeSnap = await getDocs(query(
    collection(db, COUPON_REDEMPTIONS),
    where('couponId', '==', coupon.id),
    where('userId', '==', userId),
  ))
  if (usedByMeSnap.size >= coupon.maxUsesPerUser) return { valid: false, error: 'استخدمت هذا الكود مسبقاً' }

  return { valid: true, coupon }
}

export function computeDiscount(coupon: Coupon, price: number): number {
  if (coupon.type === 'percent') return Math.round(price * (coupon.value / 100) * 1000) / 1000
  if (coupon.type === 'fixed') return Math.min(coupon.value, price)
  return 0 // free_games يُعالج بشكل منفصل (لا يخصم من السعر، يمنح ألعاب زيادة)
}

export async function redeemCoupon(coupon: Coupon, userId: string, orderId: string, discountAmount: number): Promise<void> {
  await addDoc(collection(db, COUPON_REDEMPTIONS), { couponId: coupon.id, userId, orderId, discountAmount, createdAt: Date.now() })
  await updateDoc(doc(db, COUPONS, coupon.id), { usedCount: coupon.usedCount + 1 })
}
