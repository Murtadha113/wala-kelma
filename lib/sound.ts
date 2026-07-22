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
export function playTickSound() { tone(880, 0, 0.05, 'square', 0.08) }
