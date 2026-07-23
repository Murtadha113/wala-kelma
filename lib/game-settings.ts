// إعدادات اللعب العامة (يتحكم فيها الأدمن فقط) — settings/gameplay
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export const GAMEPLAY_SETTINGS_DOC = 'settings/gameplay'

export interface GameplaySettings {
  questionsPerRound: number
}

const DEFAULT_GAMEPLAY: GameplaySettings = { questionsPerRound: 5 }

export async function getGameplaySettings(): Promise<GameplaySettings> {
  try {
    const snap = await getDoc(doc(db, GAMEPLAY_SETTINGS_DOC))
    return snap.exists() ? { ...DEFAULT_GAMEPLAY, ...snap.data() } as GameplaySettings : DEFAULT_GAMEPLAY
  } catch {
    return DEFAULT_GAMEPLAY
  }
}

export async function setGameplaySettings(data: Partial<GameplaySettings>): Promise<void> {
  await setDoc(doc(db, GAMEPLAY_SETTINGS_DOC), data, { merge: true })
}
