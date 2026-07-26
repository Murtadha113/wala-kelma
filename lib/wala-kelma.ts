// محرّك "ولا كلمة" — Realtime Database على المسار: wala_kelma_rooms/{code}
// شاشتان: المقدم (يكتب) + العرض (قراءة فقط). المؤقّت مشتق من phaseEndsAt (timestamp).
import { ref, set, get, onValue, off, update, remove } from 'firebase/database'
import { doc, writeBatch, increment } from 'firebase/firestore'
import { rtdb, db, serverNow } from './firebase'
import { generateCode } from './code'
import { pickRandomWork, WalaKelmaWork } from './works'
import { pickRandomCustomWork, CUSTOM_CATEGORY_ID, type CustomWork } from './custom-works'
import { getUserProfile, updateUserProfile } from './auth'
import { recordGroupResult } from './friend-groups'
import {
  WK_READ_SECONDS, WK_QUICK_READ_SECONDS, WK_STEAL_SECONDS, WK_QUICK_EXPLAIN, WK_TEAMS_ONLY_QUESTIONS,
  type ExplainDuration, type PreTurnPowerUp,
  type JokerOutcome, drawJokerOutcome,
} from './wala-kelma-content'

const ROOMS = 'wala_kelma_rooms'

export type TeamId = 'A' | 'B'
export interface WKPlayer { id: string; name: string }
export interface WKTeam { name: string; score: number; players: WKPlayer[] }

export type WKPhase =
  | 'idle' | 'reading' | 'acting' | 'stealing' | 'resolved' | 'roundEnd' | 'finished'
export type WKStatus = 'setup' | 'draw' | 'playing' | 'finished'

export interface WKJokerState { outcome: JokerOutcome; ts: number }
export interface WKTurnSlot { team: TeamId; playerId: string; playerName: string }
export interface WKActivePowerUps { double: boolean; deduct: boolean; silence: boolean }
export interface WKPowerUpsUsed { double: boolean; deduct: boolean; silence: boolean; joker: boolean }

export interface WKCurrentWork {
  workId: string; title: string; posterUrl: string
  year: number | null; country: string | null; actors: string[]; extraInfo: string; categoryId: string
}

export interface WalaKelmaRoom {
  id: string
  code: string
  hostId: string
  hostName: string
  status: WKStatus
  createdAt: number
  hostLastSeen?: number

  matchName: string
  teams: Record<TeamId, WKTeam>
  categories: string[]
  explainDuration: ExplainDuration
  mode: 'full' | 'quick'
  playerNamesEnabled: boolean   // false = نمط "فرق فقط" بدون أسماء لاعبين فردية
  totalRounds: number
  currentRound: number
  questionsPerRound: number   // عدد الأسئلة/الأدوار بكل جولة — يُحسب تلقائياً (عدد اللاعبين المسجّلين، أو ثابت بنمط "فرق فقط")
  turnsThisRound: number      // عدّاد الأدوار اللي لعبت بالجولة الحالية

  roundStartingTeam: TeamId
  turnOrder: WKTurnSlot[]
  currentTurnIndex: number

  currentWork: WKCurrentWork | null
  phase: WKPhase
  phaseEndsAt: number | null
  paused: boolean
  pausedRemainingMs: number | null
  questionHidden: boolean
  categoryExhausted?: boolean   // نفدت الأعمال الجديدة بالفئات المختارة (نعرض للمقدم تنبيه)

  usedWorkIds: string[]
  activeTeam: TeamId
  activePowerUps: WKActivePowerUps
  silencedPlayerId: string | null
  powerUpsUsed: Record<TeamId, WKPowerUpsUsed>
  joker: WKJokerState | null

  isTiebreak: boolean
  lastResult: { team: TeamId | null; type: 'correct' | 'steal' | 'timeout' | 'joker'; points: number; ts: number } | null
  winner: TeamId | 'draw' | null
  finishedAt?: number

  deductedFromBalance: boolean   // خُصمت لعبة من رصيد المضيف (أو استُهلكت اللعبة المجانية)
  actorCorrectCounts: Record<string, number>   // playerId → عدد مرات نجح تمثيله (بدون سرقة) — لـ"أفضل ممثل"
}

const EMPTY_POWERUPS: WKActivePowerUps = { double: false, deduct: false, silence: false }
const EMPTY_USED: WKPowerUpsUsed = { double: false, deduct: false, silence: false, joker: false }

async function uniqueCode(): Promise<string> {
  let code = generateCode()
  for (let i = 0; i < 100; i++) {
    const exists = await get(ref(rtdb, `${ROOMS}/${code}`))
    if (!exists.exists()) break
    code = generateCode()
  }
  return code
}

function baseRoom(hostId: string, hostName: string, code: string): Omit<WalaKelmaRoom, 'id'> {
  return {
    code, hostId, hostName,
    status: 'setup',
    createdAt: Date.now(),
    matchName: '',
    teams: {
      A: { name: 'الفريق الأول', score: 0, players: [] },
      B: { name: 'الفريق الثاني', score: 0, players: [] },
    },
    categories: [],
    explainDuration: 90,
    mode: 'full',
    playerNamesEnabled: true,
    totalRounds: 2,
    currentRound: 0,
    questionsPerRound: 5,
    turnsThisRound: 0,
    roundStartingTeam: 'A',
    turnOrder: [],
    currentTurnIndex: 0,
    currentWork: null,
    phase: 'idle',
    phaseEndsAt: null,
    paused: false,
    pausedRemainingMs: null,
    questionHidden: false,
    usedWorkIds: [],
    activeTeam: 'A',
    activePowerUps: { ...EMPTY_POWERUPS },
    silencedPlayerId: null,
    powerUpsUsed: { A: { ...EMPTY_USED }, B: { ...EMPTY_USED } },
    joker: null,
    isTiebreak: false,
    lastResult: null,
    winner: null,
    deductedFromBalance: false,
    actorCorrectCounts: {},
  }
}

export async function createWalaKelmaRoom(params: {
  hostId: string; hostName: string
}): Promise<{ success: true; code: string } | { success: false; error: string }> {
  try {
    const code = await uniqueCode()
    const room = baseRoom(params.hostId, params.hostName, code)
    await set(ref(rtdb, `${ROOMS}/${code}`), room)
    return { success: true, code }
  } catch (e) {
    console.error('createWalaKelmaRoom:', e)
    return { success: false, error: 'حدث خطأ، تأكد من إعداد Firebase' }
  }
}

export function subscribeToWalaKelmaRoom(code: string, cb: (room: WalaKelmaRoom | null) => void): () => void {
  const r = ref(rtdb, `${ROOMS}/${code.toUpperCase()}`)
  onValue(r, snap => cb(snap.exists() ? normalizeRoom(snap.val(), code.toUpperCase()) : null))
  return () => off(r)
}

// RTDB يحذف المصفوفات الفارغة — نضمن القيم الافتراضية
function normalizeRoom(raw: any, code: string): WalaKelmaRoom {
  const r = raw as Partial<WalaKelmaRoom>
  const fixTeam = (t?: Partial<WKTeam>): WKTeam => ({
    name: t?.name || '',
    score: t?.score ?? 0,
    players: Array.isArray(t?.players) ? t!.players! : [],
  })
  return {
    ...(raw as WalaKelmaRoom),
    id: code,
    teams: { A: fixTeam(r.teams?.A), B: fixTeam(r.teams?.B) },
    categories: Array.isArray(r.categories) ? r.categories : [],
    turnOrder: Array.isArray(r.turnOrder) ? r.turnOrder : [],
    usedWorkIds: Array.isArray(r.usedWorkIds) ? r.usedWorkIds : [],
    activePowerUps: { ...EMPTY_POWERUPS, ...(r.activePowerUps || {}) },
    powerUpsUsed: {
      A: { ...EMPTY_USED, ...(r.powerUpsUsed?.A || {}) },
      B: { ...EMPTY_USED, ...(r.powerUpsUsed?.B || {}) },
    },
    currentWork: r.currentWork ?? null,
    playerNamesEnabled: r.playerNamesEnabled ?? true,
    phaseEndsAt: r.phaseEndsAt ?? null,
    paused: r.paused ?? false,
    pausedRemainingMs: r.pausedRemainingMs ?? null,
    questionsPerRound: r.questionsPerRound || 5,
    turnsThisRound: r.turnsThisRound ?? 0,
    silencedPlayerId: r.silencedPlayerId ?? null,
    joker: r.joker ?? null,
    winner: r.winner ?? null,
    lastResult: r.lastResult ?? null,
    actorCorrectCounts: r.actorCorrectCounts ?? {},
  }
}

export async function updateWKHostHeartbeat(code: string): Promise<void> {
  try { await set(ref(rtdb, `${ROOMS}/${code}/hostLastSeen`), Date.now()) } catch { /* silent */ }
}

export async function deleteWalaKelmaRoom(code: string): Promise<void> {
  await remove(ref(rtdb, `${ROOMS}/${code}`))
}

// ── الإعداد ──
export async function updateMatchSetup(code: string, data: {
  matchName?: string
  teams?: Record<TeamId, WKTeam>
  categories?: string[]
  explainDuration?: ExplainDuration
  totalRounds?: number
  mode?: 'full' | 'quick'
  playerNamesEnabled?: boolean
}): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (data.matchName !== undefined) patch.matchName = data.matchName
  if (data.teams !== undefined) patch.teams = data.teams
  if (data.categories !== undefined) patch.categories = data.categories
  if (data.explainDuration !== undefined) patch.explainDuration = data.explainDuration
  if (data.totalRounds !== undefined) patch.totalRounds = data.totalRounds
  if (data.playerNamesEnabled !== undefined) patch.playerNamesEnabled = data.playerNamesEnabled
  if (data.mode !== undefined) {
    patch.mode = data.mode
    if (data.mode === 'quick') { patch.explainDuration = WK_QUICK_EXPLAIN; patch.totalRounds = 1 }
  }
  await update(ref(rtdb, `${ROOMS}/${code}`), patch)
}

function buildRoundOrder(teams: Record<TeamId, WKTeam>, startingTeam: TeamId): WKTurnSlot[] {
  const other: TeamId = startingTeam === 'A' ? 'B' : 'A'
  const a = teams[startingTeam].players
  const b = teams[other].players
  const order: WKTurnSlot[] = []
  const maxLen = Math.max(a.length, b.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < a.length) order.push({ team: startingTeam, playerId: a[i].id, playerName: a[i].name })
    if (i < b.length) order.push({ team: other, playerId: b[i].id, playerName: b[i].name })
  }
  return order
}

// نمط "فرق فقط" بدون أسماء لاعبين — دور واحد صناعي بكل فريق (بدون اسم لاعب)
function buildTeamsOnlyOrder(startingTeam: TeamId): WKTurnSlot[] {
  const other: TeamId = startingTeam === 'A' ? 'B' : 'A'
  return [
    { team: startingTeam, playerId: `team-${startingTeam}`, playerName: '' },
    { team: other, playerId: `team-${other}`, playerName: '' },
  ]
}

// خصم لعبة من رصيد المضيف (أو استهلاك اللعبة المجانية) — يُستدعى مرة واحدة عند بدء المباراة
async function deductGameFromHost(hostId: string): Promise<{ success: true } | { success: false; error: string }> {
  const profile = await getUserProfile(hostId)
  if (!profile) return { success: false, error: 'الحساب غير موجود' }
  if (profile.isBlocked) return { success: false, error: 'حسابك محظور — تواصل مع الدعم' }
  if (profile.gamesBalance >= 1) {
    await updateUserProfile(hostId, {
      gamesBalance: profile.gamesBalance - 1,
      totalGamesPlayed: (profile.totalGamesPlayed || 0) + 1,
    })
    return { success: true }
  }
  if (!profile.freeGameUsed) {
    await updateUserProfile(hostId, {
      freeGameUsed: true,
      totalGamesPlayed: (profile.totalGamesPlayed || 0) + 1,
    })
    return { success: true }
  }
  return { success: false, error: 'ما عندك رصيد كافٍ — اشترِ باقة عشان تكمل' }
}

export async function startMatch(code: string): Promise<{ success: true } | { success: false; error: string }> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return { success: false, error: 'الغرفة غير موجودة' }
  const room = snap.val() as WalaKelmaRoom
  if (room.playerNamesEnabled !== false && ((room.teams.A.players?.length || 0) < 1 || (room.teams.B.players?.length || 0) < 1))
    return { success: false, error: 'أضف لاعبين للفريقين' }
  if ((room.categories?.length || 0) < 1) return { success: false, error: 'اختر فئة واحدة على الأقل' }

  // الخصم يصير هنا (لحظة الضغط على "ابدأ المباراة") مو عند إنشاء الغرفة —
  // لو الغرفة خُصمت مسبقاً (مثلاً المضيف رجع بعد انقطاع) ما نخصم ثانية
  if (!room.deductedFromBalance) {
    const deduct = await deductGameFromHost(room.hostId)
    if (!deduct.success) return deduct
    await update(ref(rtdb, `${ROOMS}/${code}`), { deductedFromBalance: true })
  }

  const startingTeam: TeamId = Math.random() < 0.5 ? 'A' : 'B'
  const order = room.playerNamesEnabled === false ? buildTeamsOnlyOrder(startingTeam) : buildRoundOrder(room.teams, startingTeam)
  const questionsPerRound = room.playerNamesEnabled === false ? WK_TEAMS_ONLY_QUESTIONS : order.length
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    status: 'draw',
    currentRound: 1,
    roundStartingTeam: startingTeam,
    turnOrder: order,
    currentTurnIndex: 0,
    activeTeam: order[0]?.team ?? startingTeam,
    phase: 'idle',
    questionsPerRound,
  })
  return { success: true }
}

export async function beginPlaying(code: string): Promise<void> {
  await update(ref(rtdb, `${ROOMS}/${code}`), { status: 'playing', phase: 'idle' })
}

// ── الخصائص قبل الدور ──
export async function activatePowerUp(code: string, teamId: TeamId, powerUp: PreTurnPowerUp, silencedPlayerId?: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.phase !== 'idle' || room.activeTeam !== teamId) return
  if (room.powerUpsUsed?.[teamId]?.[powerUp]) return
  if (room.mode === 'quick') return   // الوضع السريع: الجوكر فقط، بدون خصائص ما قبل الدور
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    [`activePowerUps/${powerUp}`]: true,
    [`powerUpsUsed/${teamId}/${powerUp}`]: true,
    ...(powerUp === 'silence' && silencedPlayerId ? { silencedPlayerId } : {}),
  })
}

// تراجع عن خاصية فُعّلت بالغلط قبل بدء الدور — يعيدها متاحة للاختيار من جديد
export async function deactivatePowerUp(code: string, teamId: TeamId, powerUp: PreTurnPowerUp): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.phase !== 'idle' || room.activeTeam !== teamId) return
  if (!room.activePowerUps?.[powerUp]) return
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    [`activePowerUps/${powerUp}`]: false,
    [`powerUpsUsed/${teamId}/${powerUp}`]: false,
    ...(powerUp === 'silence' ? { silencedPlayerId: null } : {}),
  })
}

// ── محرّك الدور ──
function workToCurrent(w: WalaKelmaWork): WKCurrentWork {
  return {
    workId: w.id, title: w.title, posterUrl: w.posterUrl || '',
    year: w.year ?? null, country: w.country ?? null,
    actors: Array.isArray(w.actors) ? w.actors : [], extraInfo: w.extraInfo || '',
    categoryId: w.categoryId,
  }
}

function customWorkToCurrent(w: CustomWork): WKCurrentWork {
  return {
    workId: w.id, title: w.title, posterUrl: w.posterUrl || '',
    year: null, country: null, actors: [], extraInfo: w.hint || '',
    categoryId: CUSTOM_CATEGORY_ID,
  }
}

// يسحب عمل من مزيج الفئات المختارة (الحقيقية + المخصصة لو مختارة) — 50/50 بين المصدرين لو الاثنين مختارين،
// مع fallback للمصدر الثاني لو الأول نفد
async function drawWorkForCategories(
  categories: string[], usedInMatch: Set<string>, uid: string,
): Promise<{ current: WKCurrentWork; exhausted: boolean } | null> {
  const realCats = categories.filter(id => id !== CUSTOM_CATEGORY_ID)
  const includeCustom = categories.includes(CUSTOM_CATEGORY_ID)

  const tryReal = async () => realCats.length > 0 ? pickRandomWork(realCats, usedInMatch, uid) : null
  const tryCustom = async () => includeCustom ? pickRandomCustomWork(uid, usedInMatch) : null

  const preferReal = realCats.length > 0 && (!includeCustom || Math.random() < 0.5)
  if (preferReal) {
    const r = await tryReal()
    if (r) return { current: workToCurrent(r.work), exhausted: r.exhausted }
    const c = await tryCustom()
    if (c) return { current: customWorkToCurrent(c), exhausted: false }
    return null
  }
  const c = await tryCustom()
  if (c) return { current: customWorkToCurrent(c), exhausted: false }
  const r = await tryReal()
  if (r) return { current: workToCurrent(r.work), exhausted: r.exhausted }
  return null
}

export async function startTurn(code: string, uid: string, categoryId?: string): Promise<{ success: true; exhausted: boolean } | { success: false; error: string }> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return { success: false, error: 'الغرفة غير موجودة' }
  const room = snap.val() as WalaKelmaRoom
  const drawFrom = categoryId && room.categories.includes(categoryId) ? [categoryId] : (room.categories || [])
  const picked = await drawWorkForCategories(drawFrom, new Set(room.usedWorkIds || []), uid)
  if (!picked) return { success: false, error: 'خلصت كل الأعمال بالفئات المختارة — جرّبوا تختارون فئة ثانية بمباراة جديدة، أو أنهوا المباراة الحين' }
  const { current, exhausted } = picked

  const readSeconds = room.mode === 'quick' ? WK_QUICK_READ_SECONDS : WK_READ_SECONDS
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    currentWork: current,
    usedWorkIds: [...(room.usedWorkIds || []), current.workId],
    phase: 'reading',
    phaseEndsAt: serverNow() + readSeconds * 1000,
    paused: false,
    pausedRemainingMs: null,
    questionHidden: false,
    joker: null,
    categoryExhausted: exhausted,
  })
  return { success: true, exhausted }
}

export async function beginActing(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.phase !== 'reading') return
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    phase: 'acting',
    phaseEndsAt: serverNow() + room.explainDuration * 1000,
  })
}

export async function onActingTimeUp(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.phase !== 'acting') return
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    phase: 'stealing',
    phaseEndsAt: serverNow() + WK_STEAL_SECONDS * 1000,
    'activePowerUps/double': false,
  })
}

export async function onStealTimeUp(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.phase !== 'stealing') return
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    phase: 'resolved',
    phaseEndsAt: null,
    lastResult: { team: null, type: 'timeout', points: 0, ts: Date.now() },
  })
}

export async function markCorrect(code: string, scoringTeam: TeamId): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.phase !== 'acting' && room.phase !== 'stealing') return

  const isSteal = room.phase === 'stealing' || scoringTeam !== room.activeTeam
  const other: TeamId = scoringTeam === 'A' ? 'B' : 'A'
  let points = 1
  if (!isSteal && room.activePowerUps?.double) points = 2

  const patch: Record<string, unknown> = {
    [`teams/${scoringTeam}/score`]: (room.teams[scoringTeam].score || 0) + points,
    phase: 'resolved',
    phaseEndsAt: null,
    lastResult: { team: scoringTeam, type: isSteal ? 'steal' : 'correct', points, ts: Date.now() },
  }
  if (!isSteal && room.activePowerUps?.deduct) {
    patch[`teams/${other}/score`] = Math.max(0, (room.teams[other].score || 0) - 1)
  }
  // نجاح تمثيل حقيقي (بدون سرقة) — يُحسب لصاحب الدور الحالي لـ"أفضل ممثل"
  if (!isSteal) {
    const actorId = room.turnOrder[room.currentTurnIndex]?.playerId
    if (actorId) patch[`actorCorrectCounts/${actorId}`] = (room.actorCorrectCounts?.[actorId] || 0) + 1
  }
  await update(ref(rtdb, `${ROOMS}/${code}`), patch)
}

export async function markWrong(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.phase !== 'acting') return
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    phase: 'stealing',
    phaseEndsAt: serverNow() + WK_STEAL_SECONDS * 1000,
    'activePowerUps/double': false,
  })
}

// ── الجوكر ──
export async function useJoker(code: string): Promise<JokerOutcome | null> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return null
  const room = snap.val() as WalaKelmaRoom
  if (room.powerUpsUsed?.[room.activeTeam]?.joker) return null
  if (room.phase !== 'acting' && room.phase !== 'reading' && room.phase !== 'idle') return null

  const outcome = drawJokerOutcome()
  const team = room.activeTeam
  const patch: Record<string, unknown> = {
    [`powerUpsUsed/${team}/joker`]: true,
    joker: { outcome, ts: Date.now() },
  }
  if (outcome === 'addPoint') patch[`teams/${team}/score`] = (room.teams[team].score || 0) + 1
  else if (outcome === 'deductPoint') patch[`teams/${team}/score`] = Math.max(0, (room.teams[team].score || 0) - 1)
  await update(ref(rtdb, `${ROOMS}/${code}`), patch)
  return outcome
}

// تراجع عن نتيجة الجوكر (لو اتفعّل بالغلط) — يرجّع النقاط ويسمح باستخدامه من جديد
export async function undoJoker(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (!room.joker) return
  const team = room.activeTeam
  const patch: Record<string, unknown> = {
    [`powerUpsUsed/${team}/joker`]: false,
    joker: null,
  }
  if (room.joker.outcome === 'addPoint') patch[`teams/${team}/score`] = Math.max(0, (room.teams[team].score || 0) - 1)
  else if (room.joker.outcome === 'deductPoint') patch[`teams/${team}/score`] = (room.teams[team].score || 0) + 1
  await update(ref(rtdb, `${ROOMS}/${code}`), patch)
}

// ── الانتقال بين الأدوار والجولات ──
export async function nextTurn(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  const resetTurn = {
    currentWork: null,
    phase: 'idle' as WKPhase,
    phaseEndsAt: null,
    paused: false,
    pausedRemainingMs: null,
    questionHidden: false,
    activePowerUps: { ...EMPTY_POWERUPS },
    silencedPlayerId: null,
    joker: null,
  }

  // الفاصلة (تعادل): تنتهي بمجرد ما يلعب ممثّل الفريقين مرة وحدة — بدون علاقة بعدد الأسئلة بالجولة
  if (room.isTiebreak) {
    const nextIndex = room.currentTurnIndex + 1
    if (nextIndex < room.turnOrder.length) {
      await update(ref(rtdb, `${ROOMS}/${code}`), {
        ...resetTurn, currentTurnIndex: nextIndex, activeTeam: room.turnOrder[nextIndex].team,
      })
      return
    }
    await endRoundOrMatch(code, room, resetTurn)
    return
  }

  // الجولة العادية: تستمر حتى يوصل عدد الأسئلة الملعوبة لعدد الأسئلة بالجولة (يضبطه الأدمن)،
  // واللاعبون يتناوبون بالدور (تكرار المرور على القائمة لو لزم) بدل التوقف عند آخر لاعب
  const turnsThisRound = (room.turnsThisRound || 0) + 1
  const questionsPerRound = room.questionsPerRound > 0 ? room.questionsPerRound : room.turnOrder.length
  if (turnsThisRound < questionsPerRound && room.turnOrder.length > 0) {
    const nextIndex = (room.currentTurnIndex + 1) % room.turnOrder.length
    await update(ref(rtdb, `${ROOMS}/${code}`), {
      ...resetTurn,
      currentTurnIndex: nextIndex,
      activeTeam: room.turnOrder[nextIndex].team,
      turnsThisRound,
    })
    return
  }
  await endRoundOrMatch(code, room, resetTurn)
}

async function endRoundOrMatch(code: string, room: WalaKelmaRoom, resetTurn: Record<string, unknown>): Promise<void> {
  const scoreA = room.teams.A.score || 0
  const scoreB = room.teams.B.score || 0

  if (room.isTiebreak) {
    if (scoreA !== scoreB) return finishMatch(code, scoreA > scoreB ? 'A' : 'B')
    const startingTeam: TeamId = room.roundStartingTeam === 'A' ? 'B' : 'A'
    const order = buildTiebreakOrder(room.teams, startingTeam)
    await update(ref(rtdb, `${ROOMS}/${code}`), {
      ...resetTurn, roundStartingTeam: startingTeam, turnOrder: order,
      currentTurnIndex: 0, activeTeam: order[0].team, phase: 'idle',
    })
    return
  }

  if (room.currentRound >= room.totalRounds) {
    if (scoreA === scoreB) {
      const startingTeam: TeamId = room.roundStartingTeam === 'A' ? 'B' : 'A'
      const order = buildTiebreakOrder(room.teams, startingTeam)
      await update(ref(rtdb, `${ROOMS}/${code}`), {
        ...resetTurn, isTiebreak: true, roundStartingTeam: startingTeam, turnOrder: order,
        currentTurnIndex: 0, activeTeam: order[0].team, phase: 'idle',
      })
      return
    }
    return finishMatch(code, scoreA > scoreB ? 'A' : 'B')
  }

  const startingTeam: TeamId = room.roundStartingTeam === 'A' ? 'B' : 'A'
  const order = room.playerNamesEnabled === false ? buildTeamsOnlyOrder(startingTeam) : buildRoundOrder(room.teams, startingTeam)
  const questionsPerRound = room.playerNamesEnabled === false ? WK_TEAMS_ONLY_QUESTIONS : order.length
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    ...resetTurn,
    currentRound: room.currentRound + 1,
    roundStartingTeam: startingTeam,
    turnOrder: order,
    currentTurnIndex: 0,
    activeTeam: order[0].team,
    phase: 'roundEnd',
    turnsThisRound: 0,
    questionsPerRound,
  })
}

function buildTiebreakOrder(teams: Record<TeamId, WKTeam>, startingTeam: TeamId): WKTurnSlot[] {
  const other: TeamId = startingTeam === 'A' ? 'B' : 'A'
  const pick = (t: TeamId): WKTurnSlot => {
    const p = teams[t].players[0]
    return { team: t, playerId: p?.id || t, playerName: p?.name || teams[t].name }
  }
  return [pick(startingTeam), pick(other)]
}

export async function continueAfterRound(code: string): Promise<void> {
  await update(ref(rtdb, `${ROOMS}/${code}`), { phase: 'idle' })
}

export async function finishMatch(code: string, winner: TeamId | 'draw'): Promise<void> {
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    status: 'finished', phase: 'finished', phaseEndsAt: null, winner, finishedAt: Date.now(),
  })
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  await recordPlayerStats(room, winner)
  // المضيف ما ينتمي فعلياً لفريق معيّن بهذا التصميم (يدير المباراة فقط) — نعتمد اصطلاحاً
  // إن نتيجة الفريق الأول (A) تمثّل نتيجة المضيف بلوحات الصدارة، لحين إضافة اختيار فريق المضيف صراحة
  await recordGroupResult(room.hostId, winner === 'draw' ? 'draw' : winner === 'A' ? 'win' : 'loss')
}

// يكتب إحصائيات كل لاعب على حساب المضيف — users/{hostUid}/players/{playerName}
// اللاعبون بدون حسابات (أسماء فقط)، فنربطهم بالاسم داخل حساب صاحب المباراة
async function recordPlayerStats(room: WalaKelmaRoom, winner: TeamId | 'draw'): Promise<void> {
  try {
    const batch = writeBatch(db)
    const counts = room.actorCorrectCounts || {}
    ;(['A', 'B'] as TeamId[]).forEach(team => {
      const won = winner === team
      for (const p of room.teams[team].players || []) {
        const correct = counts[p.id] || 0
        const ref = doc(db, 'users', room.hostId, 'players', p.name)
        batch.set(ref, {
          timesPlayed: increment(1),
          wins: increment(won ? 1 : 0),
          correctWhenActing: increment(correct),
          lastPlayedAt: Date.now(),
        }, { merge: true })
      }
    })
    await batch.commit()
  } catch (e) {
    console.error('recordPlayerStats:', e)
  }
}

// أفضل ممثل بالمباراة (أعلى actorCorrectCounts) — للعرض بشاشة النهاية
export function getBestActor(room: WalaKelmaRoom): { playerName: string; correctCount: number } | null {
  const counts = room.actorCorrectCounts || {}
  const entries = Object.entries(counts).filter(([, c]) => c > 0)
  if (entries.length === 0) return null
  const [bestId, bestCount] = entries.sort((a, b) => b[1] - a[1])[0]
  const allPlayers = [...(room.teams.A.players || []), ...(room.teams.B.players || [])]
  const player = allPlayers.find(p => p.id === bestId)
  return player ? { playerName: player.name, correctCount: bestCount } : null
}

// ── أدوات المقدم ──
export async function togglePause(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  if (room.paused) {
    const remaining = room.pausedRemainingMs ?? 0
    await update(ref(rtdb, `${ROOMS}/${code}`), { paused: false, pausedRemainingMs: null, phaseEndsAt: serverNow() + remaining })
  } else {
    if (room.phaseEndsAt == null) return
    const remaining = Math.max(0, room.phaseEndsAt - serverNow())
    await update(ref(rtdb, `${ROOMS}/${code}`), { paused: true, pausedRemainingMs: remaining })
  }
}

// يعيد مؤقّت المرحلة الحالية (قراءة/تمثيل/سرقة) لمدّته الكاملة من جديد — زر "إعادة الوقت"
export async function resetPhaseTimer(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  let seconds = 0
  if (room.phase === 'reading') seconds = room.mode === 'quick' ? WK_QUICK_READ_SECONDS : WK_READ_SECONDS
  else if (room.phase === 'acting') seconds = room.explainDuration
  else if (room.phase === 'stealing') seconds = WK_STEAL_SECONDS
  else return
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    phaseEndsAt: serverNow() + seconds * 1000,
    paused: false,
    pausedRemainingMs: null,
  })
}

export async function toggleQuestionHidden(code: string, hidden: boolean): Promise<void> {
  await update(ref(rtdb, `${ROOMS}/${code}`), { questionHidden: hidden })
}

export async function adjustScore(code: string, teamId: TeamId, delta: number): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  await update(ref(rtdb, `${ROOMS}/${code}/teams/${teamId}`), { score: Math.max(0, (room.teams[teamId].score || 0) + delta) })
}

export async function skipTurn(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  // تخطّي قبل سحب أي عمل (بمرحلة idle) — ينتقل للاعب التالي مباشرة بدون احتساب سؤال من الجولة
  if (room.phase === 'idle') {
    if (room.turnOrder.length === 0) return
    const nextIndex = (room.currentTurnIndex + 1) % room.turnOrder.length
    await update(ref(rtdb, `${ROOMS}/${code}`), {
      currentTurnIndex: nextIndex,
      activeTeam: room.turnOrder[nextIndex].team,
      activePowerUps: { ...EMPTY_POWERUPS },
      silencedPlayerId: null,
    })
    return
  }
  await update(ref(rtdb, `${ROOMS}/${code}`), {
    phase: 'resolved', phaseEndsAt: null,
    lastResult: { team: null, type: 'timeout', points: 0, ts: Date.now() },
  })
}

export async function cancelMatch(code: string): Promise<void> {
  const snap = await get(ref(rtdb, `${ROOMS}/${code}`))
  if (!snap.exists()) return
  const room = snap.val() as WalaKelmaRoom
  const scoreA = room.teams.A.score || 0
  const scoreB = room.teams.B.score || 0
  await finishMatch(code, scoreA === scoreB ? 'draw' : scoreA > scoreB ? 'A' : 'B')
}
