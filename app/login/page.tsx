'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, resetPassword, authErrorMessage, signOutUser } from '@/lib/auth'
import { WK_COLORS } from '@/lib/wala-kelma-content'
import { Logo } from '@/components/logo'

const C = WK_COLORS

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const submit = async () => {
    setErr('')
    if (!email.trim() || !password) { setErr('عبّي الإيميل وكلمة المرور'); return }
    setBusy(true)
    try {
      const profile = await signIn(email.trim(), password)
      if (profile.isBlocked) {
        await signOutUser()
        setErr('حسابك محظور — تواصل مع الدعم')
        setBusy(false)
        return
      }
      router.push(next || (profile.isAdmin ? '/itsadmin1' : '/account'))
    } catch (e) {
      setErr(authErrorMessage((e as { code?: string }).code || ''))
    }
    setBusy(false)
  }

  const submitReset = async () => {
    setErr('')
    if (!email.trim()) { setErr('اكتب إيميلك أول'); return }
    setBusy(true)
    try {
      await resetPassword(email.trim())
      setResetSent(true)
    } catch (e) {
      setErr(authErrorMessage((e as { code?: string }).code || ''))
    }
    setBusy(false)
  }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 22, padding: 28, border: `1px solid ${C.ink}12` }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={54} /></div>
          <div style={{ fontSize: 14, color: `${C.ink}88`, marginTop: 6 }}>{mode === 'login' ? 'تسجيل الدخول' : 'استرجاع كلمة المرور'}</div>
        </div>

        {mode === 'login' ? (
          <>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="الإيميل" type="email" style={input} />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" style={input}
              onKeyDown={e => e.key === 'Enter' && submit()} />
            {err && <p style={{ color: C.red, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{err}</p>}
            <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'دخول'}</button>

            <p style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setMode('reset'); setErr(''); setResetSent(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.violet, fontWeight: 700 }}>
                نسيت كلمة المرور؟
              </button>
            </p>
            <p style={{ textAlign: 'center', fontSize: 13, color: `${C.ink}88`, marginTop: 6 }}>
              ما عندك حساب؟ <a href={`/signup?next=${encodeURIComponent(next || '/account')}`} style={{ color: C.violet, fontWeight: 800 }}>سوّي حساب</a>
            </p>
          </>
        ) : (
          <>
            {resetSent ? (
              <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
                <div style={{ fontSize: 40 }}>📧</div>
                <p style={{ fontSize: 14, color: `${C.ink}99`, marginTop: 8, lineHeight: 1.7 }}>
                  أرسلنا رابط استرجاع كلمة المرور لـ<br /><strong>{email}</strong><br />افتح بريدك واتبع الرابط.
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: `${C.ink}88`, marginBottom: 12, lineHeight: 1.7 }}>اكتب إيميلك وبنرسل لك رابط لتعيين كلمة مرور جديدة.</p>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="الإيميل" type="email" style={input}
                  onKeyDown={e => e.key === 'Enter' && submitReset()} />
                {err && <p style={{ color: C.red, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{err}</p>}
                <button onClick={submitReset} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'أرسل رابط الاسترجاع'}</button>
              </>
            )}
            <p style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setMode('login'); setErr(''); setResetSent(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.violet, fontWeight: 700 }}>
                ← رجوع لتسجيل الدخول
              </button>
            </p>
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <a href="/" style={{ fontSize: 12, color: `${C.ink}66` }}>← الرئيسية</a>
        </p>
      </div>
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.ink}20`, fontSize: 15, color: C.ink, background: C.cream, outline: 'none', marginBottom: 10 }
const primaryBtn: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, cursor: 'pointer' }

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>
}
