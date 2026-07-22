'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { onAuthChange } from '@/lib/auth'
import { getPackage, type Package } from '@/lib/packages'
import { getPaymentSettings, submitOrder, type PaymentSettings } from '@/lib/payments'
import { findAndValidateCoupon, computeDiscount, type Coupon } from '@/lib/coupons'
import { WK_COLORS } from '@/lib/wala-kelma-content'

const C = WK_COLORS

function PayInner() {
  const router = useRouter()
  const params = useSearchParams()
  const packageId = params.get('packageId') || ''
  const [uid, setUid] = useState<string | null>(null)
  const [pkg, setPkg] = useState<Package | null>(null)
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [copied, setCopied] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [coupon, setCoupon] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponErr, setCouponErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ autoApproved: boolean } | null>(null)

  const discount = appliedCoupon ? computeDiscount(appliedCoupon, pkg?.price || 0) : 0
  const bonusGames = appliedCoupon?.type === 'free_games' ? appliedCoupon.value : 0
  const finalAmount = Math.max(0, (pkg?.price || 0) - discount)

  const checkCoupon = async () => {
    setCouponErr(''); setAppliedCoupon(null)
    if (!coupon.trim() || !uid || !pkg) return
    setCouponChecking(true)
    const res = await findAndValidateCoupon(coupon, uid, pkg.id)
    setCouponChecking(false)
    if (!res.valid) { setCouponErr(res.error); return }
    setAppliedCoupon(res.coupon)
  }
  const removeCoupon = () => { setAppliedCoupon(null); setCoupon(''); setCouponErr('') }

  useEffect(() => {
    return onAuthChange(user => {
      if (!user) { router.replace(`/login?next=/packages/pay?packageId=${packageId}`); return }
      setUid(user.uid)
    })
  }, [router, packageId])

  useEffect(() => {
    if (!packageId) return
    getPackage(packageId).then(setPkg)
    getPaymentSettings().then(setSettings)
  }, [packageId])

  const submit = async () => {
    setErr('')
    if (!uid || !pkg) return
    if (!file) { setErr('ارفع صورة الإيصال'); return }
    setBusy(true)
    const res = await submitOrder({ userId: uid, packageId: pkg.id, receiptFile: file, couponCode: appliedCoupon?.code })
    setBusy(false)
    if (!res.success) { setErr(res.error); return }
    setResult({ autoApproved: res.autoApproved })
  }

  if (!pkg || !settings) {
    return <Center><div style={{ width: 40, height: 40, borderRadius: '50%', border: `4px solid ${C.red}30`, borderTopColor: C.red, animation: 'wkspin .8s linear infinite' }} /><style>{`@keyframes wkspin{to{transform:rotate(360deg)}}`}</style></Center>
  }

  if (result) {
    return (
      <Center>
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          <div style={{ fontSize: 60 }}>{result.autoApproved ? '✅' : '⏳'}</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 10 }}>
            {result.autoApproved ? 'تفعّلت الباقة فوراً!' : 'استلمنا طلبك'}
          </div>
          <p style={{ fontSize: 14, color: `${C.ink}88`, marginTop: 8 }}>
            {result.autoApproved
              ? `أُضيف رصيد ${pkg.gamesCount} لعبة لحسابك — تقدر تلعب الحين.`
              : 'راح نراجع الإيصال ونفعّل رصيدك قريباً.'}
          </p>
          <a href="/account" style={{ display: 'block', marginTop: 18, padding: 13, borderRadius: 12, color: '#fff', fontWeight: 900, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, textDecoration: 'none' }}>
            حسابي
          </a>
        </div>
      </Center>
    )
  }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink }}>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '20px 16px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.red }}>الدفع</div>
          <a href="/packages" style={{ fontSize: 13, color: `${C.ink}88`, textDecoration: 'none' }}>← الباقات</a>
        </div>

        <Card>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{pkg.nameAr}</div>
          <div style={{ fontSize: 13, color: `${C.ink}88` }}>{pkg.gamesCount + bonusGames} لعبة{bonusGames > 0 && ` (${pkg.gamesCount} + ${bonusGames} هدية)`}</div>
          {discount > 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 15, color: `${C.ink}55`, textDecoration: 'line-through' }}>{pkg.price.toFixed(3)}</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#27AE78' }}>{finalAmount.toFixed(3)} <span style={{ fontSize: 13 }}>د.ب</span></span>
            </div>
          ) : (
            <div style={{ fontSize: 26, fontWeight: 900, color: C.red, marginTop: 6 }}>{pkg.price.toFixed(3)} <span style={{ fontSize: 13 }}>د.ب</span></div>
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: `${C.ink}88`, marginBottom: 8 }}>كود خصم (اختياري)</div>
          {appliedCoupon ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27AE7814', borderRadius: 10, padding: 10 }}>
              <span style={{ fontWeight: 800, color: '#27AE78', fontSize: 13 }}>✓ {appliedCoupon.code} مُطبّق</span>
              <button onClick={removeCoupon} style={{ background: 'none', border: 'none', color: C.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>إزالة</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} placeholder="مثلاً: RAMADAN25"
                onKeyDown={e => e.key === 'Enter' && checkCoupon()}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${C.ink}20`, background: C.cream, fontSize: 14, outline: 'none' }} />
              <button onClick={checkCoupon} disabled={!coupon.trim() || couponChecking}
                style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: C.violet, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: !coupon.trim() || couponChecking ? 0.5 : 1 }}>
                {couponChecking ? '…' : 'تحقّق'}
              </button>
            </div>
          )}
          {couponErr && <p style={{ color: C.red, fontSize: 12, fontWeight: 700, marginTop: 6 }}>{couponErr}</p>}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: `${C.ink}88`, marginBottom: 8 }}>حوّل المبلغ عبر بنفت</div>
          {settings.benefitNumber ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: `${C.ink}66` }}>المبلغ المطلوب تحويله</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: discount > 0 ? '#27AE78' : C.red }}>{finalAmount.toFixed(3)} د.ب</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.cream, borderRadius: 12, padding: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.05em' }}>{settings.benefitNumber}</div>
                  <div style={{ fontSize: 12, color: `${C.ink}88` }}>{settings.benefitName}</div>
                </div>
                <button onClick={() => { navigator.clipboard?.writeText(settings.benefitNumber); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${C.violet}55`, background: `${C.violet}12`, color: C.violet, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  {copied ? '✓ نُسخ' : 'نسخ'}
                </button>
              </div>
            </>
          ) : <p style={{ color: `${C.ink}66`, fontSize: 13 }}>رقم بنفت غير مضبوط بعد — تواصل مع الدعم.</p>}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: `${C.ink}88`, marginBottom: 8 }}>ارفع صورة الإيصال</div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, border: `1.5px dashed ${C.ink}30`, cursor: 'pointer', fontSize: 14, color: `${C.ink}88`, fontWeight: 700 }}>
            {file ? `📎 ${file.name}` : '📤 اختر صورة الإيصال'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </Card>

        {err && <p style={{ color: C.red, fontWeight: 700, fontSize: 13, textAlign: 'center', marginTop: 10 }}>{err}</p>}

        <button onClick={submit} disabled={busy || !file}
          style={{ width: '100%', marginTop: 16, padding: 15, borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 16, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, opacity: busy || !file ? 0.5 : 1, cursor: 'pointer' }}>
          {busy ? 'جاري الإرسال…' : 'أرسل الإيصال'}
        </button>
      </div>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 18, padding: 16, border: `1px solid ${C.ink}12`, ...style }}>{children}</div>
}
function Center({ children }: { children: React.ReactNode }) {
  return <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</div>
}

export default function PayPage() {
  return <Suspense fallback={null}><PayInner /></Suspense>
}
