// بنر الصفحة الرئيسية — صور يديرها الأدمن، تُخزّن ضمن settings/banners (نفس نمط lib/game-settings.ts سابقاً)
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export const BANNERS_DOC = 'settings/banners'

export interface BannerItem {
  id: string
  imageUrl: string
  linkUrl?: string
}

interface BannersData {
  images: BannerItem[]
}

export async function getBanners(): Promise<BannerItem[]> {
  try {
    const snap = await getDoc(doc(db, BANNERS_DOC))
    return snap.exists() ? ((snap.data() as BannersData).images || []) : []
  } catch {
    return []
  }
}

export async function setBanners(images: BannerItem[]): Promise<void> {
  await setDoc(doc(db, BANNERS_DOC), { images })
}
