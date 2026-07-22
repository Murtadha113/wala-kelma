// حسابات المستخدمين — Firebase Auth (إيميل/كلمة مرور) + وثيقة users/{uid}
import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut,
  sendPasswordResetEmail, onAuthStateChanged, updateProfile, type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'

export const USERS = 'users'

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  photoURL: string
  createdAt: number
  lastLoginAt: number
  gamesBalance: number
  freeGameUsed: boolean
  isBlocked: boolean
  totalGamesPlayed: number
  isAdmin?: boolean
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, USERS, user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await updateDoc(ref, { lastLoginAt: Date.now() })
    return { ...(snap.data() as UserProfile), id: user.uid, lastLoginAt: Date.now() }
  }
  const profile: UserProfile = {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'مستخدم',
    email: user.email || '',
    phone: '',
    photoURL: user.photoURL || '',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    gamesBalance: 0,
    freeGameUsed: false,
    isBlocked: false,
    totalGamesPlayed: 0,
  }
  await setDoc(ref, profile)
  return profile
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid))
  return snap.exists() ? ({ ...snap.data(), id: uid } as UserProfile) : null
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, USERS, uid), data as Record<string, never>)
}

// ── أدمن: كل المستخدمين + بحث ──
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, USERS))
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile)).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function signUp(name: string, email: string, password: string): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() })
  return ensureUserProfile(cred.user)
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return ensureUserProfile(cred.user)
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb)
}

export function authErrorMessage(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'هذا الإيميل مسجّل مسبقاً',
    'auth/invalid-email': 'صيغة الإيميل غير صحيحة',
    'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
    'auth/user-not-found': 'ما فيه حساب بهذا الإيميل',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-credential': 'الإيميل أو كلمة المرور غير صحيحة',
    'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
  }
  return map[code] || 'حدث خطأ، حاول مرة أخرى'
}

// حذف الحساب فعلياً (يُستخدم بصفحة /account)
export async function deleteAccount(uid: string): Promise<void> {
  await deleteDoc(doc(db, USERS, uid))
  const current = auth.currentUser
  if (current && current.uid === uid) {
    try { await current.delete() } catch { /* قد يتطلب إعادة تسجيل دخول حديثة — نتجاهل هنا */ }
  }
}
