'use client'

// تبويبات الأدمن التشغيلية: الطلبات، المستخدمون، الباقات، الكوبونات، الإعدادات
import { useEffect, useState } from 'react'
import { C, Card, SectionTitle, Muted, input, primaryBtn, ghostBtn } from '@/components/admin-ui'
import { getAllUsers, updateUserProfile, type UserProfile } from '@/lib/auth'
import { getAllOrders, approveOrder, rejectOrder, revokeOrder, type Order, type OrderStatus } from '@/lib/payments'
import { getAllPackages, addPackage, updatePackage, deletePackage, type Package, type NewPackage } from '@/lib/packages'
import { getAllCoupons, addCoupon, updateCoupon, deleteCoupon, type Coupon, type NewCoupon, type CouponType } from '@/lib/coupons'
import { getPaymentSettings, setPaymentSettings, type PaymentSettings } from '@/lib/payments'
import { getContactSettings, setContactSettings, type ContactSettings } from '@/lib/contact'
import { getCategories } from '@/lib/works'
import { Users, Gamepad2, Hourglass, Receipt, Wallet, Ban, Drama, Gift, Flame, Check } from 'lucide-react'

const ADMIN_ID = 'admin' // بوابة الأدمن الحالية بكلمة مرور بدون حسابات مصادقة منفصلة للأدمن

// ═══════════════ نظرة عامة ═══════════════
export function DashboardTab() {
  const [stats, setStats] = useState<{
    users: number; subscribers: number; blocked: number
    pendingOrders: number; revenue: number; totalOrders: number
    categories: number; activeCategories: number
  } | null>(null)

  useEffect(() => {
    Promise.all([getAllUsers(), getAllOrders(), getCategories()]).then(([users, orders, cats]) => {
      const subscribers = users.filter(u => (u.gamesBalance || 0) > 0 || (u.totalGamesPlayed || 0) > 0).length
      const blocked = users.filter(u => u.isBlocked).length
      const pendingOrders = orders.filter(o => o.status === 'pending_review').length
      const revenue = orders.filter(o => o.status === 'approved' || o.status === 'auto_approved').reduce((s, o) => s + (o.amount || 0), 0)
      setStats({
        users: users.length, subscribers, blocked,
        pendingOrders, revenue, totalOrders: orders.length,
        categories: cats.length, activeCategories: cats.filter(c => c.isActive).length,
      })
    })
  }, [])

  if (!stats) return <Card><Muted>جاري التحميل…</Muted></Card>

  const tiles = [
    { label: 'المستخدمون', value: stats.users, color: C.violet, Icon: Users },
    { label: 'المشتركون', value: stats.subscribers, color: '#27AE78', Icon: Gamepad2 },
    { label: 'طلبات بانتظار المراجعة', value: stats.pendingOrders, color: C.orange, Icon: Hourglass },
    { label: 'إجمالي الطلبات', value: stats.totalOrders, color: C.violet, Icon: Receipt },
    { label: 'الإيرادات (د.ب)', value: stats.revenue.toFixed(3), color: '#27AE78', Icon: Wallet },
    { label: 'حسابات محظورة', value: stats.blocked, color: C.red, Icon: Ban },
    { label: 'الفئات الظاهرة', value: `${stats.activeCategories}/${stats.categories}`, color: C.violet, Icon: Drama },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
      {tiles.map(t => (
        <Card key={t.label}>
          <t.Icon size={20} color={t.color} />
          <div style={{ fontSize: 24, fontWeight: 900, color: t.color, marginTop: 4 }}>{t.value}</div>
          <div style={{ fontSize: 12, color: `${C.ink}88`, fontWeight: 700, marginTop: 2 }}>{t.label}</div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════ الطلبات ═══════════════
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_review: 'بانتظار المراجعة', auto_approved: 'اعتماد تلقائي', approved: 'معتمد', rejected: 'مرفوض', revoked: 'مسحوب',
}
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_review: C.orange, auto_approved: '#27AE78', approved: '#27AE78', rejected: C.red, revoked: C.red,
}

export function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [zoomed, setZoomed] = useState<string | null>(null)
  const reload = () => getAllOrders().then(setOrders)
  useEffect(() => { reload() }, [])

  const pendingCount = orders.filter(o => o.status === 'pending_review').length
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const reject = async (id: string) => {
    const reason = prompt('سبب الرفض؟') || 'غير محدد'
    await rejectOrder(id, ADMIN_ID, reason)
    reload()
  }
  const revoke = async (id: string) => {
    const reason = prompt('سبب سحب التفعيل؟') || 'غير محدد'
    await revokeOrder(id, ADMIN_ID, reason)
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'pending_review', 'auto_approved', 'approved', 'rejected', 'revoked'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: `1.5px solid ${filter === s ? C.violet : C.ink + '22'}`,
            background: filter === s ? `${C.violet}14` : 'transparent', color: filter === s ? C.violet : `${C.ink}88`,
          }}>
            {s === 'all' ? `الكل (${orders.length})` : `${STATUS_LABEL[s]}${s === 'pending_review' && pendingCount ? ` (${pendingCount})` : ''}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <Card><Muted>لا توجد طلبات بهذا الفلتر.</Muted></Card>}
      {filtered.map(o => (
        <Card key={o.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{o.userName} <span style={{ fontWeight: 400, color: `${C.ink}77`, fontSize: 12 }}>({o.userEmail})</span></div>
              <div style={{ fontSize: 13, color: `${C.ink}88`, marginTop: 2 }}>{o.packageSnapshot.nameAr} — {o.gamesGranted} لعبة — {o.amount.toFixed(3)} د.ب</div>
              {o.couponCode && <div style={{ fontSize: 12, color: C.violet }}>كوبون: {o.couponCode} (خصم {(o.discountAmount || 0).toFixed(3)})</div>}
              <div style={{ fontSize: 11, color: `${C.ink}66`, marginTop: 2 }}>{new Date(o.createdAt).toLocaleString('ar')}</div>
              {o.rejectionReason && <div style={{ fontSize: 12, color: C.red, marginTop: 2 }}>السبب: {o.rejectionReason}</div>}
            </div>
            <img src={o.receiptURL} alt="إيصال" width={54} height={54} style={{ borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} onClick={() => setZoomed(o.receiptURL)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: STATUS_COLOR[o.status] }}>● {STATUS_LABEL[o.status]}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(o.status === 'pending_review') && (
                <>
                  <button onClick={() => approveOrder(o.id, ADMIN_ID).then(reload)} style={{ ...ghostBtn, color: '#27AE78', borderColor: '#27AE7855' }}>اعتماد</button>
                  <button onClick={() => reject(o.id)} style={{ ...ghostBtn, color: C.red, borderColor: `${C.red}55` }}>رفض</button>
                </>
              )}
              {(o.status === 'auto_approved' || o.status === 'approved') && (
                <button onClick={() => revoke(o.id)} style={{ ...ghostBtn, color: C.red, borderColor: `${C.red}55` }}>سحب التفعيل</button>
              )}
            </div>
          </div>
        </Card>
      ))}

      {zoomed && (
        <div onClick={() => setZoomed(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, cursor: 'zoom-out' }}>
          <img src={zoomed} alt="إيصال مكبّر" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}

// ═══════════════ المستخدمون ═══════════════
export function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'subscribers'>('all')
  const [grantAmount, setGrantAmount] = useState<Record<string, string>>({})
  const reload = () => getAllUsers().then(setUsers)
  useEffect(() => { reload() }, [])

  const isSubscriber = (u: UserProfile) => (u.gamesBalance || 0) > 0 || (u.totalGamesPlayed || 0) > 0

  const filtered = users
    .filter(u => filter === 'all' || isSubscriber(u))
    .filter(u => !search.trim() || (u.name || '').includes(search) || (u.email || '').includes(search))

  const subscriberCount = users.filter(isSubscriber).length

  const adjustBalance = async (u: UserProfile, delta: number) => {
    await updateUserProfile(u.id, { gamesBalance: Math.max(0, (u.gamesBalance || 0) + delta) })
    reload()
  }
  const grantExact = async (u: UserProfile) => {
    const n = Number(grantAmount[u.id])
    if (!Number.isFinite(n) || n <= 0) return
    await updateUserProfile(u.id, { gamesBalance: (u.gamesBalance || 0) + n })
    setGrantAmount(prev => ({ ...prev, [u.id]: '' }))
    reload()
  }
  const toggleBlock = async (u: UserProfile) => {
    await updateUserProfile(u.id, { isBlocked: !u.isBlocked })
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setFilter('all')} style={{
          padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
          border: `1.5px solid ${filter === 'all' ? C.violet : C.ink + '22'}`,
          background: filter === 'all' ? `${C.violet}14` : 'transparent', color: filter === 'all' ? C.violet : `${C.ink}88`,
        }}>الكل ({users.length})</button>
        <button onClick={() => setFilter('subscribers')} style={{
          padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
          border: `1.5px solid ${filter === 'subscribers' ? C.violet : C.ink + '22'}`,
          background: filter === 'subscribers' ? `${C.violet}14` : 'transparent', color: filter === 'subscribers' ? C.violet : `${C.ink}88`,
        }}>المشتركين ({subscriberCount})</button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الإيميل" style={input} />
      {filtered.length === 0 && <Card><Muted>لا يوجد مستخدمون.</Muted></Card>}
      {filtered.map(u => (
        <Card key={u.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800 }}>{u.name} {u.isBlocked && <span style={{ color: C.red, fontSize: 12 }}>(محظور)</span>}</div>
              <div style={{ fontSize: 12, color: `${C.ink}88` }}>{u.email}</div>
              <div style={{ fontSize: 12, color: `${C.ink}88` }}>مباريات: {u.totalGamesPlayed || 0}</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.violet }}>{u.gamesBalance}</div>
              <div style={{ fontSize: 11, color: `${C.ink}66` }}>رصيد</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
            <button onClick={() => adjustBalance(u, -1)} style={ghostBtn}>−1</button>
            <input type="number" value={grantAmount[u.id] || ''} onChange={e => setGrantAmount(prev => ({ ...prev, [u.id]: e.target.value }))}
              placeholder="عدد الألعاب" style={{ ...input, marginBottom: 0, width: 90, padding: '9px 10px' }} />
            <button onClick={() => grantExact(u)} style={{ ...ghostBtn, color: '#27AE78', borderColor: '#27AE7855', display: 'flex', alignItems: 'center', gap: 4 }}><Gift size={13} /> امنح</button>
            <button onClick={() => toggleBlock(u)} style={{ ...ghostBtn, color: u.isBlocked ? '#27AE78' : C.red, marginRight: 'auto' }}>
              {u.isBlocked ? 'فك الحظر' : 'حظر'}
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════ الباقات ═══════════════
const EMPTY_PKG: NewPackage = { nameAr: '', descriptionAr: '', gamesCount: 5, price: 1, oldPrice: null, isActive: true, isFeatured: false, order: 0, expiryDays: null }

export function PackagesAdminTab() {
  const [pkgs, setPkgs] = useState<Package[]>([])
  const [form, setForm] = useState<NewPackage | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const reload = () => getAllPackages().then(setPkgs)
  useEffect(() => { reload() }, [])

  const save = async () => {
    if (!form) return
    if (editingId) await updatePackage(editingId, form)
    else await addPackage({ ...form, order: pkgs.length })
    setForm(null); setEditingId(null); reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!form && <button onClick={() => setForm({ ...EMPTY_PKG })} style={primaryBtn}>+ باقة جديدة</button>}
      {form && (
        <Card>
          <SectionTitle>{editingId ? 'تعديل باقة' : 'باقة جديدة'}</SectionTitle>
          <input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} placeholder="اسم الباقة" style={input} />
          <input value={form.descriptionAr} onChange={e => setForm({ ...form, descriptionAr: e.target.value })} placeholder="وصف مختصر" style={input} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={form.gamesCount} onChange={e => setForm({ ...form, gamesCount: Number(e.target.value) })} placeholder="عدد الألعاب" style={input} />
            <input type="number" step="0.001" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} placeholder="السعر (د.ب)" style={input} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" step="0.001" value={form.oldPrice ?? ''} onChange={e => setForm({ ...form, oldPrice: e.target.value ? Number(e.target.value) : null })} placeholder="سعر قديم (اختياري)" style={input} />
            <input type="number" value={form.expiryDays ?? ''} onChange={e => setForm({ ...form, expiryDays: e.target.value ? Number(e.target.value) : null })} placeholder="مدة الصلاحية (يوم)" style={input} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 13 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> مفعّلة</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={form.isFeatured} onChange={e => setForm({ ...form, isFeatured: e.target.checked })} /> الأكثر مبيعاً</label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setForm(null); setEditingId(null) }} style={{ ...ghostBtn, flex: 1 }}>إلغاء</button>
            <button onClick={save} style={{ ...primaryBtn, flex: 2 }}>حفظ</button>
          </div>
        </Card>
      )}
      {pkgs.map(p => (
        <Card key={p.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>{p.nameAr} {p.isFeatured && <Flame size={14} color={C.orange} />} {!p.isActive && <span style={{ color: C.red, fontSize: 12 }}>(موقوفة)</span>}</div>
              <div style={{ fontSize: 12, color: `${C.ink}88` }}>{p.gamesCount} لعبة — {p.price.toFixed(3)} د.ب</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setForm(p); setEditingId(p.id) }} style={ghostBtn}>تعديل</button>
              <button onClick={async () => { if (confirm('حذف الباقة؟')) { await deletePackage(p.id); reload() } }} style={{ ...ghostBtn, color: C.red }}>حذف</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════ الكوبونات ═══════════════
const EMPTY_COUPON: NewCoupon = { code: '', type: 'percent', value: 10, appliesTo: 'all', maxUses: null, maxUsesPerUser: 1, startsAt: null, expiresAt: null, isActive: true }

export function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [form, setForm] = useState<NewCoupon | null>(null)
  const reload = () => getAllCoupons().then(setCoupons)
  useEffect(() => { reload() }, [])

  const save = async () => {
    if (!form || !form.code.trim()) return
    await addCoupon(form)
    setForm(null); reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!form && <button onClick={() => setForm({ ...EMPTY_COUPON })} style={primaryBtn}>+ كوبون جديد</button>}
      {form && (
        <Card>
          <SectionTitle>كوبون جديد</SectionTitle>
          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="الكود (مثلاً RAMADAN25)" style={input} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as CouponType })} style={{ ...input, flex: 1 }}>
              <option value="percent">نسبة %</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="free_games">ألعاب مجانية</option>
            </select>
            <input type="number" value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} placeholder="القيمة" style={{ ...input, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={form.maxUses ?? ''} onChange={e => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : null })} placeholder="حد الاستخدام (فارغ = بلا حد)" style={input} />
            <input type="number" value={form.maxUsesPerUser} onChange={e => setForm({ ...form, maxUsesPerUser: Number(e.target.value) })} placeholder="لكل مستخدم" style={input} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setForm(null)} style={{ ...ghostBtn, flex: 1 }}>إلغاء</button>
            <button onClick={save} style={{ ...primaryBtn, flex: 2 }}>حفظ</button>
          </div>
        </Card>
      )}
      {coupons.map(c => (
        <Card key={c.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 900, letterSpacing: '0.05em' }}>{c.code}</div>
              <div style={{ fontSize: 12, color: `${C.ink}88` }}>
                {c.type === 'percent' ? `${c.value}%` : c.type === 'fixed' ? `${c.value} د.ب` : `${c.value} لعبة مجانية`} — استُخدم {c.usedCount}{c.maxUses ? `/${c.maxUses}` : ''}
              </div>
            </div>
            <button onClick={async () => { await updateCoupon(c.id, { isActive: !c.isActive }); reload() }}
              style={{ ...ghostBtn, color: c.isActive ? '#27AE78' : `${C.ink}66` }}>{c.isActive ? 'مفعّل' : 'موقوف'}</button>
            <button onClick={async () => { if (confirm('حذف الكوبون؟')) { await deleteCoupon(c.id); reload() } }} style={{ ...ghostBtn, color: C.red }}>حذف</button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════ الإعدادات ═══════════════
export function SettingsTab() {
  const [s, setS] = useState<PaymentSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { getPaymentSettings().then(setS) }, [])

  if (!s) return <Card><Muted>جاري التحميل…</Muted></Card>

  const save = async () => {
    setErr('')
    try {
      await setPaymentSettings(s)
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      console.error('setPaymentSettings failed:', e)
      setErr('فشل الحفظ: ' + (e as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionTitle>إعدادات الدفع</SectionTitle>
        <input value={s.benefitNumber} onChange={e => setS({ ...s, benefitNumber: e.target.value })} placeholder="رقم بنفت" style={input} />
        <input value={s.benefitName} onChange={e => setS({ ...s, benefitName: e.target.value })} placeholder="الاسم على الحساب" style={input} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, marginBottom: 14 }}>
          <Toggle label="تفعيل تلقائي للطلبات" checked={s.autoApproveEnabled} onChange={v => setS({ ...s, autoApproveEnabled: v })} />
          <Toggle label="لعبة مجانية للمستخدم الجديد" checked={s.freeGameEnabled} onChange={v => setS({ ...s, freeGameEnabled: v })} />
          <Toggle label="وضع الصيانة" checked={s.maintenanceMode} onChange={v => setS({ ...s, maintenanceMode: v })} />
        </div>
        {err && <p style={{ color: C.red, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{err}</p>}
        <button onClick={save} style={primaryBtn}>{saved ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={14} /> تم الحفظ</span> : 'حفظ الإعدادات'}</button>
      </Card>
      <ContactSettingsCard />
    </div>
  )
}

function ContactSettingsCard() {
  const [c, setC] = useState<ContactSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { getContactSettings().then(setC) }, [])

  if (!c) return <Card><Muted>جاري التحميل…</Muted></Card>

  const set = (k: keyof ContactSettings, v: string) => setC({ ...c, [k]: v })

  const save = async () => {
    setErr('')
    try {
      await setContactSettings(c)
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      console.error('setContactSettings failed:', e)
      setErr('فشل الحفظ: ' + (e as Error).message)
    }
  }

  return (
    <Card>
      <SectionTitle>صفحة "تواصل معنا"</SectionTitle>
      <Muted>هذي البيانات تظهر بصفحة /contact العامة — اترك أي حقل فاضي عشان يختفي من الصفحة.</Muted>
      <textarea value={c.intro} onChange={e => set('intro', e.target.value)} placeholder="جملة ترحيبية بأعلى الصفحة" style={{ ...input, minHeight: 60, resize: 'vertical' }} />
      <input value={c.phone} onChange={e => set('phone', e.target.value)} placeholder="رقم الهاتف (مثال: +973XXXXXXXX)" style={input} />
      <input value={c.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="رقم واتساب (مثال: +973XXXXXXXX)" style={input} />
      <input value={c.email} onChange={e => set('email', e.target.value)} placeholder="الإيميل" style={input} />
      <input value={c.instagram} onChange={e => set('instagram', e.target.value)} placeholder="معرّف إنستغرام (بدون @ اختياري)" style={input} />
      <input value={c.twitter} onChange={e => set('twitter', e.target.value)} placeholder="معرّف X / تويتر" style={input} />
      <input value={c.snapchat} onChange={e => set('snapchat', e.target.value)} placeholder="معرّف سناب شات" style={input} />
      {err && <p style={{ color: C.red, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{err}</p>}
      <button onClick={save} style={primaryBtn}>{saved ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={14} /> تم الحفظ</span> : 'حفظ بيانات التواصل'}</button>
    </Card>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
      <button onClick={() => onChange(!checked)} style={{
        width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
        background: checked ? C.orange : `${C.ink}22`,
      }}>
        <span style={{ position: 'absolute', top: 3, right: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'right 0.2s' }} />
      </button>
    </div>
  )
}
