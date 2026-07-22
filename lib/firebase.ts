// تهيئة Firebase لمشروع "ولا كلمة" المستقل — Firestore (المحتوى) + Realtime Database (تزامن الغرف)
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// كاش محلي (IndexedDB) للفئات/الأعمال — يخلي القراءات المتكررة فورية بدل انتظار رحلة الشبكة كل مرة
// (خادم Firestore بعيد جغرافياً عن مستخدمينا، فكل قراءة كانت تاخذ 400-1500ms)
function makeFirestore() {
  if (typeof window === 'undefined') return getFirestore(app)
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch {
    return getFirestore(app) // مُهيّأ مسبقاً (مثلاً بعد Fast Refresh) — نرجع لنفس النسخة
  }
}

export const db = makeFirestore()       // Firestore — الأعمال والفئات
export const rtdb = getDatabase(app)    // Realtime Database — غرف المباريات
export const auth = getAuth(app)
export default app
