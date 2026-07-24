// أصوات مولّدة بالكود (Web Audio API) — بدون ملفات خارجية
'use client'

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, startDelay: number, duration: number, type: OscillatorType = 'sine', volume = 0.16) {
  const audio = getCtx()
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = audio.currentTime + startDelay
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export function playCorrectSound() { tone(659, 0, 0.12, 'sine'); tone(988, 0.09, 0.18, 'sine') }
export function playWrongSound() { tone(180, 0, 0.22, 'square', 0.12) }
export function playWinSound() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, 'triangle')) }
export function playStealSound() { tone(440, 0, 0.09, 'sawtooth', 0.14); tone(740, 0.07, 0.1, 'sawtooth', 0.14); tone(1180, 0.14, 0.2, 'triangle', 0.16) }
// كل ما اقتربنا من الصفر بآخر 3 ثواني، الصوت يعلى شوي (urgency)
export function playTickSound(intensity: 0 | 1 | 2 | 3 = 0) {
  tone(880 + intensity * 90, 0, 0.05, 'square', 0.08 + intensity * 0.03)
}
export function playDrumRollSound() {
  for (let i = 0; i < 14; i++) tone(90 + (i % 2) * 20, i * 0.09, 0.07, 'square', 0.1)
}
