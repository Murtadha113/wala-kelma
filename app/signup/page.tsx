'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signUp, authErrorMessage } from '@/lib/auth'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { Logo } from '@/components/logo'
import { GradientBlobs } from '@/components/shared'

const C = WK_COLORS

function SignupInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/account'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!name.trim()) { setErr('اكتب اسمك'); return }
    if (!email.trim() || !password) { setErr('عبّي الإيميل وكلمة المرور'); return }
    if (password.length < 6) { setErr('كلمة المرور لازم 6 أحرف على الأقل'); return }
    setBusy(true)
    try {
      await signUp(name.trim(), email.trim(), password)
      router.push(next)
    } catch (e) {
      console.error('signUp failed:', e)
      setErr(authErrorMessage((e as { code?: string }).code || ''))
    }
    setBusy(false)
  }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, background: '#fff', borderRadius: 22, padding: 28, border: `1px solid ${C.ink}12`, boxShadow: `0 20px 50px ${C.ink}14` }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={54} /></div>
          <div style={{ fontSize: 14, color: `${C.ink}88`, marginTop: 6 }}>حساب جديد — لعبة مجانية أول تسجيل 🎁</div>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم" style={input} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="الإيميل" type="email" style={input} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" style={input}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <p style={{ color: C.red, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{err}</p>}
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'سوّي حساب'}</button>
        <p style={{ textAlign: 'center', fontSize: 13, color: `${C.ink}88`, marginTop: 14 }}>
          عندك حساب؟ <a href={`/login?next=${encodeURIComponent(next)}`} style={{ color: C.violet, fontWeight: 800 }}>سجّل دخول</a>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <a href="/" style={{ fontSize: 12, color: `${C.ink}66` }}>← الرئيسية</a>
        </p>
      </div>
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.ink}20`, fontSize: 15, color: C.ink, background: C.cream, outline: 'none', marginBottom: 10 }
const primaryBtn: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, cursor: 'pointer', boxShadow: `0 10px 24px ${C.red}33` }

export default function SignupPage() {
  return <Suspense fallback={null}><SignupInner /></Suspense>
}
