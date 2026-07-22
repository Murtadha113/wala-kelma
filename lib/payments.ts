// طبقة الدفع عبر بنفت — إعدادات + طلبات + اعتماد/رفض
// ⚠️ لا يوجد باك-إند (Cloud Functions) بهذا المشروع، فالتحقق والتفعيل التلقائي منطق عميل بالكامل.
// هذا أسرع للتطوير لكن أقل أماناً من نسخة مُتحقَّق منها على السيرفر — راجع خطة v2 قبل الإطلاق التجاري.
import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore'
import { getUserProfile, updateUserProfile } from './auth'
import { getPackage, type Package } from './packages'
import { findAndValidateCoupon, computeDiscount, redeemCoupon, type Coupon } from './coupons'
import { uploadImage } from './storage'

export const ORDERS = 'orders'
export const SETTINGS_DOC = 'settings/payment'
const DAILY_ORDER_LIMIT = 3

export type OrderStatus = 'pending_review' | 'auto_approved' | 'approved' | 'rejected' | 'revoked'

export interface Order {
  id: string
  userId: string
  userName: string
  userEmail: string
  packageId: string
  packageSnapshot: { nameAr: string; gamesCount: number; price: number }
  amount: number
  receiptURL: string
  receiptHash: string
  status: OrderStatus
  gamesGranted: number
  couponCode?: string
  discountAmount?: number
  createdAt: number
  reviewedAt?: number
  reviewedBy?: string
  rejectionReason?: string
}

export interface PaymentSettings {
  benefitNumber: string
  benefitName: string
  autoApproveEnabled: boolean
  freeGameEnabled: boolean
  maintenanceMode: boolean
}

const DEFAULT_SETTINGS: PaymentSettings = {
  benefitNumber: '', benefitName: '', autoApproveEnabled: true, freeGameEnabled: true, maintenanceMode: false,
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const snap = await getDoc(doc(db, SETTINGS_DOC))
    return snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } as PaymentSettings : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function setPaymentSettings(data: Partial<PaymentSettings>): Promise<void> {
  await setDoc(doc(db, SETTINGS_DOC), data, { merge: true })
}

// hash بسيط للصورة (SHA-256) — يمنع رفع نفس الإيصال مرتين
async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export type SubmitOrderResult =
  | { success: true; order: Order; autoApproved: boolean }
  | { success: false; error: string }

export async function submitOrder(params: {
  userId: string; packageId: string; receiptFile: File; couponCode?: string
}): Promise<SubmitOrderResult> {
  try {
    const [profile, pkg, settings] = await Promise.all([
      getUserProfile(params.userId), getPackage(params.packageId), getPaymentSettings(),
    ])
    if (!profile) return { success: false, error: 'الحساب غير موجود' }
    if (profile.isBlocked) return { success: false, error: 'حسابك محظور' }
    if (!pkg || !pkg.isActive) return { success: false, error: 'الباقة غير متوفرة' }

    // حد يومي لعدد الطلبات
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const todaySnap = await getDocs(query(
      collection(db, ORDERS), where('userId', '==', params.userId),
    ))
    const todayCount = todaySnap.docs.filter(d => (d.data() as Order).createdAt >= startOfDay.getTime()).length
    if (todayCount >= DAILY_ORDER_LIMIT) return { success: false, error: `وصلت الحد الأقصى (${DAILY_ORDER_LIMIT} طلبات باليوم)، حاول بكرة` }

    // منع تكرار نفس صورة الإيصال
    const receiptHash = await hashFile(params.receiptFile)
    const dupSnap = await getDocs(query(collection(db, ORDERS), where('receiptHash', '==', receiptHash)))
    if (!dupSnap.empty) return { success: false, error: 'هذا الإيصال مرفوع مسبقاً' }

    // كوبون (اختياري)
    let coupon: Coupon | null = null
    let discountAmount = 0
    let bonusGames = 0
    if (params.couponCode?.trim()) {
      const check = await findAndValidateCoupon(params.couponCode, params.userId, params.packageId)
      if (!check.valid) return { success: false, error: check.error }
      coupon = check.coupon
      if (coupon.type === 'free_games') bonusGames = coupon.value
      else discountAmount = computeDiscount(coupon, pkg.price)
    }

    const receiptURL = await uploadImage(params.receiptFile, `receipts/${params.userId}`)
    const amount = Math.max(0, pkg.price - discountAmount)
    const gamesGranted = pkg.gamesCount + bonusGames
    const autoApprove = settings.autoApproveEnabled

    const orderData: Omit<Order, 'id'> = {
      userId: params.userId, userName: profile.name, userEmail: profile.email,
      packageId: pkg.id, packageSnapshot: { nameAr: pkg.nameAr, gamesCount: pkg.gamesCount, price: pkg.price },
      amount, receiptURL, receiptHash,
      status: autoApprove ? 'auto_approved' : 'pending_review',
      gamesGranted,
      ...(coupon ? { couponCode: coupon.code, discountAmount } : {}),
      createdAt: Date.now(),
    }
    const ref = await addDoc(collection(db, ORDERS), orderData)
    await updateDoc(ref, { id: ref.id })
    const order: Order = { ...orderData, id: ref.id }

    if (coupon) await redeemCoupon(coupon, params.userId, ref.id, discountAmount)

    if (autoApprove) {
      await updateUserProfile(params.userId, { gamesBalance: (profile.gamesBalance || 0) + gamesGranted })
    }

    await logEmail(profile.email, autoApprove ? 'purchase_success' : 'purchase_pending')

    return { success: true, order, autoApproved: autoApprove }
  } catch (e) {
    console.error('submitOrder:', e)
    return { success: false, error: 'حدث خطأ، حاول مرة أخرى' }
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    const snap = await getDocs(collection(db, ORDERS))
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function approveOrder(orderId: string, adminId: string): Promise<void> {
  const snap = await getDoc(doc(db, ORDERS, orderId))
  if (!snap.exists()) return
  const order = snap.data() as Order
  // لو كانت auto_approved الرصيد مُنح مسبقاً، لا نمنحه مرة ثانية — فقط نثبّت الاعتماد
  if (order.status === 'pending_review') {
    const profile = await getUserProfile(order.userId)
    if (profile) await updateUserProfile(order.userId, { gamesBalance: (profile.gamesBalance || 0) + order.gamesGranted })
  }
  await updateDoc(doc(db, ORDERS, orderId), { status: 'approved', reviewedAt: Date.now(), reviewedBy: adminId })
  await logAudit(adminId, 'approve_order', orderId)
}

export async function rejectOrder(orderId: string, adminId: string, reason: string): Promise<void> {
  const snap = await getDoc(doc(db, ORDERS, orderId))
  if (!snap.exists()) return
  const order = snap.data() as Order
  // لو كانت auto_approved، اسحب الرصيد اللي مُنح
  if (order.status === 'auto_approved') {
    const profile = await getUserProfile(order.userId)
    if (profile) await updateUserProfile(order.userId, { gamesBalance: Math.max(0, (profile.gamesBalance || 0) - order.gamesGranted) })
  }
  await updateDoc(doc(db, ORDERS, orderId), { status: 'rejected', reviewedAt: Date.now(), reviewedBy: adminId, rejectionReason: reason })
  await logAudit(adminId, 'reject_order', orderId)
  const profile = await getUserProfile(order.userId)
  if (profile) await logEmail(profile.email, 'purchase_rejected')
}

export async function revokeOrder(orderId: string, adminId: string, reason: string): Promise<void> {
  const snap = await getDoc(doc(db, ORDERS, orderId))
  if (!snap.exists()) return
  const order = snap.data() as Order
  const profile = await getUserProfile(order.userId)
  if (profile) await updateUserProfile(order.userId, { gamesBalance: Math.max(0, (profile.gamesBalance || 0) - order.gamesGranted) })
  await updateDoc(doc(db, ORDERS, orderId), { status: 'revoked', reviewedAt: Date.now(), reviewedBy: adminId, rejectionReason: reason })
  await logAudit(adminId, 'revoke_order', orderId)
}

// ── سجلات (بدون إرسال فعلي حالياً — بانتظار مفتاح Brevo) ──
async function logEmail(toEmail: string, template: string): Promise<void> {
  try {
    await addDoc(collection(db, 'emailLogs'), { toEmail, template, status: 'skipped_no_provider', createdAt: Date.now() })
  } catch { /* silent */ }
}

export async function logAudit(adminId: string, action: string, targetId: string, extra?: Record<string, unknown>): Promise<void> {
  try {
    await addDoc(collection(db, 'auditLogs'), { adminId, action, targetType: 'order', targetId, ...extra, timestamp: Date.now() })
  } catch { /* silent */ }
}
