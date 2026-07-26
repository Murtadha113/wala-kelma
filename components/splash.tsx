'use client'

import { useEffect, useState } from 'react'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { Logo } from '@/components/logo'

const C = WK_COLORS

export function Splash() {
  const [phase, setPhase] = useState<'show' | 'fade' | 'done'>('show')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fade'), 650)
    const t2 = setTimeout(() => setPhase('done'), 950)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (phase === 'done') return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: C.cream,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: phase === 'fade' ? 0 : 1, transition: 'opacity 0.3s ease',
      pointerEvents: phase === 'fade' ? 'none' : 'auto',
    }}>
      <div className="wk-pop-in"><Logo height={96} priority /></div>
    </div>
  )
}
