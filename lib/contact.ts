// إعدادات صفحة "تواصل معنا" — يعدّلها الأدمن، تُعرض بصفحة عامة /contact
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export const CONTACT_SETTINGS_DOC = 'settings/contact'

export interface ContactSettings {
  intro: string
  phone: string
  whatsapp: string
  email: string
  instagram: string
  twitter: string
  snapchat: string
}

const DEFAULT_CONTACT: ContactSettings = {
  intro: 'عندك سؤال أو اقتراح؟ تواصل معنا من أي وسيلة تناسبك.',
  phone: '', whatsapp: '', email: '', instagram: '', twitter: '', snapchat: '',
}

export async function getContactSettings(): Promise<ContactSettings> {
  try {
    const snap = await getDoc(doc(db, CONTACT_SETTINGS_DOC))
    return snap.exists() ? { ...DEFAULT_CONTACT, ...snap.data() } as ContactSettings : DEFAULT_CONTACT
  } catch {
    return DEFAULT_CONTACT
  }
}

export async function setContactSettings(data: Partial<ContactSettings>): Promise<void> {
  await setDoc(doc(db, CONTACT_SETTINGS_DOC), data, { merge: true })
}
