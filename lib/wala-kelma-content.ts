// إعداد ثابت للعبة "ولا كلمة" (تمثيل صامت) — المدد والخصائص والهوية
import { Copy, Minus, MicOff, Dices, type LucideIcon } from 'lucide-react'

// ── الهوية (لوحة ألوان "ولا كلمة") ──
export const WK_COLORS = {
  violet: '#582EF4',   // Neon Violet
  red: '#DA2342',      // Strong Red — أحمر مرجاني
  orange: '#F26B21',   // Warm Orange — برتقالي دافئ
  cream: '#FFFEE9',    // Cream White — أبيض كريمي
  ink: '#1A1420',      // نص داكن
} as const

// ── المدد (بالثواني) ──
export const WK_READ_SECONDS = 30
export const WK_QUICK_READ_SECONDS = 15
export const WK_STEAL_SECONDS = 10
export const WK_EXPLAIN_OPTIONS = [60, 90, 105] as const
export const WK_QUICK_EXPLAIN = 45
export type ExplainDuration = 60 | 90 | 105 | 45

export const WK_ROUND_OPTIONS = [2, 3, 4, 5] as const
export const WK_MIN_PLAYERS_PER_TEAM = 2
export const WK_MAX_PLAYERS_PER_TEAM = 8
export const WK_MAX_CATEGORIES = 5
// عدد الأسئلة الثابت لنمط "بدون أسماء لاعبين" (ما فيه لاعبين نحسب عددهم)
export const WK_TEAMS_ONLY_QUESTIONS = 4

// ── الخصائص (Power-Ups) ──
export type PreTurnPowerUp = 'double' | 'deduct' | 'silence'
export type PowerUpId = PreTurnPowerUp | 'joker'

export interface PowerUpDef {
  id: PowerUpId
  name: string
  icon: LucideIcon
  desc: string
  color: string
  preTurn: boolean
}

export const WK_POWERUPS: PowerUpDef[] = [
  { id: 'double',  name: 'مضاعفة النقطة', icon: Copy, desc: 'إذا خمّن فريقك صح تحصل نقطتين بدل نقطة', color: '#27AE78', preTurn: true },
  { id: 'deduct',  name: 'خصم نقطة',      icon: Minus, desc: 'إذا خمّن فريقك صح تُخصم نقطة من الخصم', color: WK_COLORS.red, preTurn: true },
  { id: 'silence', name: 'إسكات لاعب',    icon: MicOff, desc: 'تختار لاعب من الخصم يُمنع من التخمين هذا الدور', color: WK_COLORS.violet, preTurn: true },
  { id: 'joker',   name: 'الجوكر',        icon: Dices, desc: 'يُفعّل أي وقت خلال دور فريقك — نتيجة عشوائية', color: WK_COLORS.orange, preTurn: false },
]

// ── نتائج الجوكر العشوائية ──
export type JokerOutcome = 'addPoint' | 'redoWithNewWork' | 'deductPoint'
export const WK_JOKER_OUTCOMES: { id: JokerOutcome; label: string; emoji: string }[] = [
  { id: 'addPoint',        label: 'إضافة نقطة لفريقك',           emoji: '➕' },
  { id: 'redoWithNewWork', label: 'إعادة التمثيل مع عمل جديد',   emoji: '🔁' },
  { id: 'deductPoint',     label: 'خصم نقطة من فريقك',           emoji: '➖' },
]

export function drawJokerOutcome(): JokerOutcome {
  return WK_JOKER_OUTCOMES[Math.floor(Math.random() * WK_JOKER_OUTCOMES.length)].id
}

// ── الفئات الافتراضية (تُزرع أول مرة، ثم تُدار من الأدمن) ──
export const WK_DEFAULT_CATEGORY_NAMES = [
  'أفلام أجنبية',
  'أفلام عربية',
  'أفلام خليجية',
  'مسلسلات عربية',
  'مسلسلات خليجية',
  'مسرحيات',
  'أمثال شعبية',
] as const

// نوع العمل المشتق من اسم الفئة — يُعرض بكرت العمل بدل نبذة تفصيلية
export function typeLabelForCategory(categoryName: string): string {
  if (categoryName.includes('أفلام')) return 'فيلم'
  if (categoryName.includes('مسلسلات')) return 'مسلسل'
  if (categoryName.includes('مسرحيات')) return 'مسرحية'
  if (categoryName.includes('أمثال')) return 'مثل شعبي'
  return categoryName
}
