'use client'

import { useEffect, useState } from 'react'
import { uploadImage } from '@/lib/storage'
import {
  getCategories, addCategory, updateCategory, deleteCategory, seedDefaultCategories,
  getAllWorks, addWork, updateWork, deleteWork,
  WKCategory, WalaKelmaWork, NewWork, Difficulty,
} from '@/lib/works'
import { C, Card, SectionTitle, Muted, input, primaryBtn, ghostBtn } from '@/components/admin-ui'
import { getBanners, setBanners, BannerItem } from '@/lib/banners'
import { DashboardTab, OrdersTab, UsersTab, PackagesAdminTab, CouponsTab, SettingsTab } from '@/app/itsadmin1/business-tabs'
import { Logo } from '@/components/logo'
import { onAuthChange, signIn, signOutUser, getUserProfile, authErrorMessage } from '@/lib/auth'
import { GradientBlobs } from '@/components/shared'
import { Ban, ArrowLeft, Drama, Upload, Link2, Eye, EyeOff, ClipboardList, X, Clapperboard, FileText } from 'lucide-react'

type GateState = 'checking' | 'signedOut' | 'denied' | 'granted'

export default function AdminPage() {
  const [gate, setGate] = useState<GateState>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'works' | 'categories' | 'banners' | 'import' | 'scrape' | 'orders' | 'users' | 'packages' | 'coupons' | 'settings'>('dashboard')

  useEffect(() => onAuthChange(async user => {
    if (!user) { setGate('signedOut'); return }
    const profile = await getUserProfile(user.uid)
    setGate(profile?.isAdmin ? 'granted' : 'denied')
  }), [])

  const submit = async () => {
    setErr('')
    if (!email.trim() || !password) { setErr('عبّي الإيميل وكلمة المرور'); return }
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      // onAuthChange يتكفّل بتحديث الحالة بعد نجاح الدخول
    } catch (e) {
      setErr(authErrorMessage((e as { code?: string }).code || ''))
    }
    setBusy(false)
  }

  if (gate === 'checking') return null

  if (gate === 'signedOut') {
    return <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 28, border: `1px solid ${C.ink}12`, boxShadow: `0 20px 50px ${C.ink}14`, width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={54} /></div>
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8, marginBottom: 16 }}>دخول لوحة الإدارة</div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="الإيميل" type="email"
          style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.ink}20`, fontSize: 15, outline: 'none', background: C.cream, marginBottom: 10 }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" type="password"
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.ink}20`, fontSize: 15, outline: 'none', background: C.cream }} />
        {err && <p style={{ color: C.red, fontSize: 13, fontWeight: 700, marginTop: 8 }}>{err}</p>}
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 12, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'دخول'}</button>
      </div>
    </div>
  }

  if (gate === 'denied') {
    return <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 28, border: `1px solid ${C.ink}12`, boxShadow: `0 20px 50px ${C.ink}14`, width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Ban size={36} color={C.red} /></div>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>حسابك ما عنده صلاحية دخول لوحة الإدارة</div>
        <button onClick={() => signOutUser()} style={ghostBtn}>تسجيل خروج</button>
      </div>
    </div>
  }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink, position: 'relative', overflow: 'hidden' }}>
      <GradientBlobs />
      <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', padding: '16px 14px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Logo height={28} />
            <span style={{ fontSize: 15, fontWeight: 800, color: `${C.ink}99` }}>· الإدارة</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => signOutUser()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: `${C.ink}88` }}>تسجيل خروج</button>
            <a href="/" style={{ fontSize: 13, color: `${C.ink}88`, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> الرئيسية</a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, background: '#fff', borderRadius: 16, padding: 6, border: `1px solid ${C.ink}12`, boxShadow: `0 8px 22px ${C.ink}0a`, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            ['dashboard', 'نظرة عامة'], ['works', 'الأعمال'], ['categories', 'الفئات'], ['banners', 'البنر'], ['import', 'استيراد CSV'], ['scrape', 'سحب أعمال'],
            ['orders', 'الطلبات'], ['users', 'المستخدمون'], ['packages', 'الباقات'], ['coupons', 'الكوبونات'], ['settings', 'الإعدادات'],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: '1 0 auto', padding: '9px 12px', borderRadius: 12, fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer',
              background: tab === k ? `linear-gradient(135deg, ${C.red}, ${C.orange})` : 'transparent',
              color: tab === k ? '#fff' : `${C.ink}88`,
            }}>{label}</button>
          ))}
        </div>

        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'works' && <WorksTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'banners' && <BannersTab />}
        {tab === 'import' && <ImportTab />}
        {tab === 'scrape' && <ScrapeTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'packages' && <PackagesAdminTab />}
        {tab === 'coupons' && <CouponsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}

// ═══════════════ CATEGORIES ═══════════════
function CategoriesTab() {
  const [cats, setCats] = useState<WKCategory[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [urlEditId, setUrlEditId] = useState<string | null>(null)
  const [urlValue, setUrlValue] = useState('')
  const reload = () => getCategories().then(setCats)
  useEffect(() => { reload() }, [])

  const seed = async () => {
    setBusy(true); setErr('')
    try { await seedDefaultCategories(); await reload() }
    catch (e) { setErr('فشل الزرع: ' + (e as Error).message) }
    setBusy(false)
  }
  const add = async () => {
    if (!name.trim()) return
    setBusy(true); setErr('')
    try { await addCategory(name.trim(), cats.length); setName(''); await reload() }
    catch (e) { setErr('فشل الإضافة: ' + (e as Error).message) }
    setBusy(false)
  }
  const uploadCategoryImage = async (catId: string, file: File) => {
    setUploadingId(catId); setErr('')
    try {
      const url = await uploadImage(file, 'categories')
      await updateCategory(catId, { imageUrl: url })
      await reload()
    } catch (e) {
      setErr('فشل رفع الصورة: ' + (e as Error).message)
    }
    setUploadingId(null)
  }
  const saveUrl = async (catId: string) => {
    setErr('')
    try {
      await updateCategory(catId, { imageUrl: urlValue.trim() })
      setUrlEditId(null); setUrlValue(''); await reload()
    } catch (e) {
      console.error('saveUrl failed:', e)
      setErr('فشل الحفظ: ' + (e as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err && <Card><p style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>{err}</p></Card>}
      {cats.length === 0 && (
        <Card><Muted>ما فيه فئات بعد.</Muted><button onClick={seed} disabled={busy} style={{ ...primaryBtn, marginTop: 10 }}>زرع الفئات الثماني الافتراضية</button></Card>
      )}
      <Card>
        <SectionTitle>إضافة فئة</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الفئة" style={input} onKeyDown={e => e.key === 'Enter' && add()} />
          <button onClick={add} disabled={busy} style={{ ...primaryBtn, width: 'auto', padding: '11px 20px' }}>إضافة</button>
        </div>
      </Card>
      {cats.map(c => (
        <Card key={c.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {c.imageUrl
              ? <img src={c.imageUrl} alt={c.name} width={44} height={44} style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.ink}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Drama size={18} color={`${C.ink}66`} /></div>}
            <span style={{ flex: 1, fontWeight: 800 }}>{c.name}</span>
            <label style={{ ...ghostBtn, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              {uploadingId === c.id ? '…' : c.imageUrl ? 'تغيير' : <><Upload size={13} /> صورة</>}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadCategoryImage(c.id, f) }} />
            </label>
            <button onClick={() => { setUrlEditId(urlEditId === c.id ? null : c.id); setUrlValue(c.imageUrl || '') }} title="رابط الصورة" style={{ ...ghostBtn, display: 'flex', alignItems: 'center' }}><Link2 size={14} /></button>
            <button onClick={async () => { setErr(''); try { await updateCategory(c.id, { isActive: !c.isActive }); reload() } catch (e) { setErr('فشل التحديث: ' + (e as Error).message) } }}
              title={c.isActive ? 'ظاهرة' : 'مخفية'} style={{ ...ghostBtn, color: c.isActive ? '#27AE78' : C.red, display: 'flex', alignItems: 'center' }}>{c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}</button>
            <button onClick={async () => { if (!confirm('حذف الفئة؟')) return; setErr(''); try { await deleteCategory(c.id); reload() } catch (e) { setErr('فشل الحذف: ' + (e as Error).message) } }} style={{ ...ghostBtn, color: C.red }}>حذف</button>
          </div>
          {urlEditId === c.id && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input value={urlValue} onChange={e => setUrlValue(e.target.value)} placeholder="رابط الصورة (https://...)"
                style={{ ...input, marginBottom: 0, flex: 1 }} onKeyDown={e => e.key === 'Enter' && saveUrl(c.id)} />
              <button onClick={() => saveUrl(c.id)} style={{ ...ghostBtn, color: '#27AE78' }}>حفظ</button>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

// ═══════════════ البنر ═══════════════
function BannersTab() {
  const [items, setItems] = useState<BannerItem[]>([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const reload = () => getBanners().then(setItems)
  useEffect(() => { reload() }, [])

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true); setErr('')
    try {
      const newItems: BannerItem[] = []
      for (const file of Array.from(files)) {
        const url = await uploadImage(file, 'banners')
        newItems.push({ id: crypto.randomUUID(), imageUrl: url })
      }
      const next = [...items, ...newItems]
      await setBanners(next)
      setItems(next)
    } catch (e) {
      setErr('فشل رفع الصورة: ' + (e as Error).message)
    }
    setUploading(false)
  }

  const remove = async (id: string) => {
    setBusy(true); setErr('')
    try {
      const next = items.filter(b => b.id !== id)
      await setBanners(next)
      setItems(next)
    } catch (e) {
      setErr('فشل الحذف: ' + (e as Error).message)
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err && <Card><p style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>{err}</p></Card>}
      <Card>
        <SectionTitle>صور البنر بالصفحة الرئيسية</SectionTitle>
        <Muted>ارفع صورة أو أكثر تظهر كبنر بأعلى الصفحة الرئيسية (فوق زر "ابدأ اللعبة"). لو رفعت أكثر من صورة تتبدّل تلقائياً. لو ما فيه صور، ما يظهر بنر.</Muted>
        <label style={{ ...ghostBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
          <Upload size={14} /> {uploading ? 'جاري الرفع…' : 'إضافة صورة/صور'}
          <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={uploading}
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </label>
      </Card>
      {items.length === 0 && <Card><Muted>ما فيه صور بنر حالياً — ما يظهر بنر بالصفحة الرئيسية.</Muted></Card>}
      {items.map(b => (
        <Card key={b.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={b.imageUrl} alt="" style={{ width: 90, height: 50, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: `${C.ink}66`, wordBreak: 'break-all' }}>{b.imageUrl}</span>
            <button onClick={() => remove(b.id)} disabled={busy} style={{ ...ghostBtn, color: C.red }}>حذف</button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════ WORKS ═══════════════
const EMPTY_FORM: NewWork = { title: '', categoryId: '', posterUrl: '', year: null, country: null, actors: [], extraInfo: '', difficulty: 'medium', isActive: true }

function WorksTab() {
  const [cats, setCats] = useState<WKCategory[]>([])
  const [works, setWorks] = useState<WalaKelmaWork[]>([])
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<WalaKelmaWork | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickCat, setQuickCat] = useState('')
  const [quickItems, setQuickItems] = useState<{ file: File; preview: string; title: string; description: string; country: string }[]>([])
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickProgress, setQuickProgress] = useState(0)
  const [quickLog, setQuickLog] = useState('')

  const reload = async () => { setCats(await getCategories()); setWorks(await getAllWorks()) }
  useEffect(() => { reload() }, [])

  const catName = (id: string) => cats.find(c => c.id === id)?.name || '—'
  const filtered = filter ? works.filter(w => w.categoryId === filter) : works

  const titleFromFilename = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim()

  const openQuickAdd = () => { setQuickCat(filter || cats[0]?.id || ''); setQuickItems([]); setQuickLog(''); setShowQuickAdd(true) }

  const addQuickFiles = (files: FileList | null) => {
    if (!files) return
    const items = Array.from(files).map(file => ({ file, preview: URL.createObjectURL(file), title: titleFromFilename(file.name), description: '', country: '' }))
    setQuickItems(prev => [...prev, ...items])
  }

  const setQuickField = (i: number, field: 'title' | 'description' | 'country', value: string) =>
    setQuickItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  const removeQuickItem = (i: number) => setQuickItems(prev => prev.filter((_, idx) => idx !== i))

  const runQuickAdd = async () => {
    if (!quickCat || quickItems.length === 0) { alert('اختر الفئة وارفع صورة وحدة عالأقل'); return }
    if (quickItems.some(it => !it.title.trim())) { alert('كل صورة لازم يكون لها اسم'); return }
    setQuickBusy(true)
    setQuickProgress(0)
    let ok = 0
    for (const it of quickItems) {
      try {
        const posterUrl = await uploadImage(it.file, 'works')
        await addWork({
          title: it.title.trim(), categoryId: quickCat, posterUrl,
          year: null, country: it.country.trim() || null, actors: [],
          extraInfo: it.description.trim(), difficulty: 'medium', isActive: true,
        })
        ok++
      } catch { /* تجاهل الفشل واستمر بالباقي */ }
      setQuickProgress(p => p + 1)
    }
    setQuickLog(`تمت إضافة ${ok} من ${quickItems.length}.`)
    quickItems.forEach(it => URL.revokeObjectURL(it.preview))
    setQuickItems([])
    setQuickBusy(false)
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...input, flex: 1 }}>
          <option value="">كل الفئات ({works.length})</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name} ({works.filter(w => w.categoryId === c.id).length})</option>)}
        </select>
        <button onClick={openQuickAdd} style={{ ...ghostBtn, width: 'auto', padding: '11px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}><ClipboardList size={14} /> إضافة سريعة</button>
        <button onClick={() => { setEditing(null); setShowForm(true) }} style={{ ...primaryBtn, width: 'auto', padding: '11px 18px', whiteSpace: 'nowrap' }}>+ عمل</button>
      </div>

      {showQuickAdd && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionTitle style={{ margin: 0 }}>إضافة سريعة بالصور</SectionTitle>
            <button onClick={() => setShowQuickAdd(false)} style={ghostBtn}>إغلاق</button>
          </div>
          <Muted>اختر الفئة، وارفع صور كل الأعمال دفعة وحدة (مثلاً 100 بوستر فيلم) — كل صورة تصير عمل جديد فيه اسمه ووصف بسيط عنه (البلد ولمحة تساعد اللاعب يمثّله). الاسم يتعبّى تلقائياً من اسم الملف وتقدر تعدّله.</Muted>
          <select value={quickCat} onChange={e => setQuickCat(e.target.value)} style={input}>
            <option value="">اختر الفئة *</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name} ({works.filter(w => w.categoryId === c.id).length})</option>)}
          </select>
          <label style={{ ...ghostBtn, display: 'block', textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}>
            <Upload size={14} /> اختر الصور (يمكن تحديد أكثر من صورة)
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { addQuickFiles(e.target.files); e.target.value = '' }} />
          </label>

          {quickItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
              {quickItems.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: 8, borderRadius: 12, background: `${C.ink}06` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 12, color: `${C.ink}55`, fontWeight: 800 }}>{i + 1}</div>
                    <img src={it.preview} alt="" width={40} height={54} style={{ borderRadius: 6, objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={it.title} onChange={e => setQuickField(i, 'title', e.target.value)} placeholder="اسم العمل *" style={{ ...input, marginBottom: 0 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={it.country} onChange={e => setQuickField(i, 'country', e.target.value)} placeholder="البلد" style={{ ...input, marginBottom: 0, flex: 1 }} />
                      <input value={it.description} onChange={e => setQuickField(i, 'description', e.target.value)} placeholder="وصف بسيط يساعد على التمثيل" style={{ ...input, marginBottom: 0, flex: 2 }} />
                    </div>
                  </div>
                  <button onClick={() => removeQuickItem(i)} style={{ ...ghostBtn, color: C.red, padding: '8px 10px', alignSelf: 'flex-start', display: 'flex' }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, color: `${C.ink}66`, marginBottom: 8 }}>
            {quickItems.length} صورة جاهزة للإضافة{quickBusy ? ` — جاري رفع ${quickProgress}/${quickItems.length}` : ''}
          </div>
          <button onClick={runQuickAdd} disabled={quickBusy || quickItems.length === 0} style={{ ...primaryBtn }}>{quickBusy ? 'جاري الإضافة…' : 'إضافة الكل'}</button>
          {quickLog && <div style={{ marginTop: 10, fontWeight: 800, color: C.violet }}>{quickLog}</div>}
        </Card>
      )}

      {(showForm || editing) && <WorkForm cats={cats} works={works} initial={editing} onClose={() => { setShowForm(false); setEditing(null) }} onSaved={() => { setShowForm(false); setEditing(null); reload() }} />}

      {filtered.length === 0 && <Card><Muted>لا توجد أعمال. أضف أعمالاً بصورها أو استخدم الإضافة السريعة بالصور أو استيراد CSV.</Muted></Card>}
      {filtered.map((w, i) => (
        <Card key={w.id}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 22, textAlign: 'center', fontWeight: 900, color: `${C.ink}55`, fontSize: 13 }}>{i + 1}</div>
            {w.posterUrl ? <img src={w.posterUrl} alt="" width={40} height={54} style={{ borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 40, height: 54, borderRadius: 8, background: `${C.ink}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clapperboard size={18} color={`${C.ink}55`} /></div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{w.title}</div>
              <div style={{ fontSize: 12, color: `${C.ink}88` }}>{catName(w.categoryId)} · {[w.year, w.country].filter(Boolean).join(' · ')}</div>
            </div>
            {!w.isActive && <span style={{ fontSize: 11, color: C.red }}>موقوف</span>}
            <button onClick={() => setEditing(w)} style={ghostBtn}>تعديل</button>
            <button onClick={async () => { if (confirm('حذف العمل؟')) { await deleteWork(w.id); reload() } }} style={{ ...ghostBtn, color: C.red }}>حذف</button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function WorkForm({ cats, works, initial, onClose, onSaved }: { cats: WKCategory[]; works: WalaKelmaWork[]; initial: WalaKelmaWork | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<NewWork>(initial ? { ...initial } : { ...EMPTY_FORM, categoryId: cats[0]?.id || '' })
  const [actorsStr, setActorsStr] = useState((initial?.actors || []).join('، '))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof NewWork, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

  const upload = async (file: File) => {
    setUploading(true)
    try { set('posterUrl', await uploadImage(file, 'works')) } catch (e) { alert((e as Error).message) }
    setUploading(false)
  }

  const save = async () => {
    if (!f.title.trim() || !f.categoryId) { alert('العنوان والفئة مطلوبان'); return }
    setBusy(true)
    const data: NewWork = { ...f, actors: actorsStr.split(/[،,]/).map(s => s.trim()).filter(Boolean) }
    if (initial) await updateWork(initial.id, data)
    else await addWork(data)
    setBusy(false); onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,32,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 90, padding: '5vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionTitle style={{ margin: 0 }}>{initial ? 'تعديل عمل' : 'عمل جديد'}</SectionTitle>
            <button onClick={onClose} style={ghostBtn}>إغلاق</button>
          </div>
          <input value={f.title} onChange={e => set('title', e.target.value)}
            placeholder={cats.find(c => c.id === f.categoryId)?.name.includes('أجنبية') ? 'اسم العمل (إنجليزي) *' : 'اسم العمل *'} style={input} />
          <select value={f.categoryId} onChange={e => set('categoryId', e.target.value)} style={input}>
            <option value="">اختر الفئة *</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name} ({works.filter(w => w.categoryId === c.id).length})</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={f.year ?? ''} onChange={e => set('year', e.target.value ? Number(e.target.value) : null)} placeholder="السنة" style={input} type="number" />
            <input value={f.country ?? ''} onChange={e => set('country', e.target.value || null)} placeholder="البلد" style={input} />
          </div>
          <input value={actorsStr} onChange={e => setActorsStr(e.target.value)} placeholder="الممثلون (افصل بفاصلة)" style={input} />
          <textarea value={f.extraInfo} onChange={e => set('extraInfo', e.target.value)} placeholder="معلومات إضافية تساعد على التمثيل" style={{ ...input, minHeight: 60, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={f.difficulty} onChange={e => set('difficulty', e.target.value as Difficulty)} style={{ ...input, flex: 1 }}>
              <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={f.isActive} onChange={e => set('isActive', e.target.checked)} /> مفعّل
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <input value={f.posterUrl} onChange={e => set('posterUrl', e.target.value)} placeholder="رابط البوستر (أو ارفع)" style={{ ...input, flex: 1 }} />
            <label style={{ ...ghostBtn, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
              {uploading ? '…' : <><Upload size={13} /> رفع</>}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          {f.posterUrl && <img src={f.posterUrl} alt="" style={{ width: 60, borderRadius: 8, marginTop: 8 }} />}
          <button onClick={save} disabled={busy} style={{ ...primaryBtn, marginTop: 10 }}>{busy ? '…' : 'حفظ'}</button>
        </Card>
      </div>
    </div>
  )
}

// ═══════════════ CSV IMPORT ═══════════════
function ImportTab() {
  const [cats, setCats] = useState<WKCategory[]>([])
  const [text, setText] = useState('')
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { getCategories().then(setCats) }, [])

  const parseCSV = (raw: string): string[][] => {
    const rows: string[][] = []
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      const cells: string[] = []; let cur = ''; let q = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
        else if (ch === ',' && !q) { cells.push(cur); cur = '' }
        else cur += ch
      }
      cells.push(cur)
      rows.push(cells.map(c => c.trim()))
    }
    return rows
  }

  const run = async () => {
    setBusy(true); setLog('')
    const rows = parseCSV(text)
    if (rows.length < 2) { setLog('لا توجد بيانات — أضف صف عناوين وصفوف بيانات'); setBusy(false); return }
    const header = rows[0].map(h => h.toLowerCase())
    const idx = (names: string[]) => header.findIndex(h => names.includes(h))
    const iTitle = idx(['title', 'العنوان', 'الاسم'])
    const iCat = idx(['category', 'categoryid', 'الفئة'])
    const iPoster = idx(['poster', 'posterurl', 'البوستر'])
    const iYear = idx(['year', 'السنة'])
    const iCountry = idx(['country', 'البلد'])
    const iActors = idx(['actors', 'الممثلون'])
    const iInfo = idx(['info', 'extrainfo', 'معلومات'])
    const iDiff = idx(['difficulty', 'الصعوبة'])
    if (iTitle < 0 || iCat < 0) { setLog('العناوين يجب أن تحتوي على: title و category على الأقل'); setBusy(false); return }

    const catByName = new Map(cats.map(c => [c.name.trim(), c.id]))
    const catById = new Set(cats.map(c => c.id))
    let ok = 0, fail = 0
    for (const row of rows.slice(1)) {
      const title = row[iTitle]?.trim()
      const catRaw = row[iCat]?.trim()
      if (!title || !catRaw) { fail++; continue }
      const categoryId = catById.has(catRaw) ? catRaw : catByName.get(catRaw)
      if (!categoryId) { fail++; continue }
      const diffRaw = (iDiff >= 0 ? row[iDiff] : '').trim().toLowerCase()
      const difficulty: Difficulty = diffRaw === 'easy' || diffRaw === 'سهل' ? 'easy' : diffRaw === 'hard' || diffRaw === 'صعب' ? 'hard' : 'medium'
      try {
        await addWork({
          title, categoryId,
          posterUrl: iPoster >= 0 ? (row[iPoster] || '') : '',
          year: iYear >= 0 && row[iYear] ? Number(row[iYear]) || null : null,
          country: iCountry >= 0 ? (row[iCountry] || null) : null,
          actors: iActors >= 0 && row[iActors] ? row[iActors].split(/[،;|]/).map(s => s.trim()).filter(Boolean) : [],
          extraInfo: iInfo >= 0 ? (row[iInfo] || '') : '',
          difficulty, isActive: true,
        })
        ok++
      } catch { fail++ }
    }
    setLog(`تم استيراد ${ok} عمل${fail ? ` — فشل ${fail}` : ''}.`)
    setBusy(false)
  }

  const template = 'title,category,poster,year,country,actors,info,difficulty\nالأسد الملك,أفلام أجنبية,,1994,أمريكا,,رسوم متحركة,easy'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionTitle>استيراد أعمال دفعة واحدة (CSV)</SectionTitle>
        <Muted>الأعمدة: title و category (اسم الفئة كما هو مسجّل، أو معرّفها) إلزامية. الباقي اختياري: poster, year, country, actors (افصل بـ ؛), info, difficulty.</Muted>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={template} style={{ ...input, minHeight: 160, resize: 'vertical', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ ...ghostBtn, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><FileText size={14} /> ملف CSV<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={async e => { const file = e.target.files?.[0]; if (file) setText(await file.text()) }} /></label>
          <button onClick={() => setText(template)} style={ghostBtn}>قالب</button>
          <button onClick={run} disabled={busy} style={{ ...primaryBtn, flex: 1 }}>{busy ? 'جاري الاستيراد…' : 'استيراد'}</button>
        </div>
        {log && <div style={{ marginTop: 10, fontWeight: 800, color: C.violet }}>{log}</div>}
      </Card>
    </div>
  )
}

// ═══════════════ سحب الأعمال من موقع ═══════════════
interface ScrapedItem { name: string; type: string; url: string | null; page?: number; selected: boolean; posterUrl?: string }

function ScrapeTab() {
  const [cats, setCats] = useState<WKCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [urlPattern, setUrlPattern] = useState('')
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(1)
  const [scraping, setScraping] = useState(false)
  const [items, setItems] = useState<ScrapedItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [enriching, setEnriching] = useState(false)
  const [enrichDone, setEnrichDone] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(0)
  const [log, setLog] = useState('')

  useEffect(() => { getCategories().then(cs => { setCats(cs); setCategoryId(cs[0]?.id || '') }) }, [])

  const selectedCount = items.filter(it => it.selected).length

  // يبني روابط الصفحات المطلوبة — نفس منطق التعويض والحد الأقصى اللي بسيرفر wk-scrape
  const buildPageUrls = (): string[] => {
    const hasPlaceholder = urlPattern.includes('{page}')
    const start = startPage || 1
    const end = hasPlaceholder ? Math.min(startPage + 49, endPage || start) : start
    const urls: string[] = []
    for (let p = start; p <= end; p++) {
      urls.push(hasPlaceholder ? urlPattern.replace('{page}', String(p)) : urlPattern)
      if (!hasPlaceholder) break
    }
    return urls
  }

  const runScrape = async () => {
    setScraping(true); setErrors([]); setItems([]); setLog('')

    // محاولة 1: نجيب الصفحات من متصفحك مباشرة (يشتغل بس لو الموقع الهدف يسمح كروس-أورجن) —
    // بعض المواقع تحظر IP سيرفرنا (Vercel) بينما تسمح بطلب من متصفح حقيقي عادي زي متصفحك
    try {
      const pages: { html: string; pageUrl: string; page: number }[] = []
      const pageUrls = buildPageUrls()
      for (let i = 0; i < pageUrls.length; i++) {
        const resp = await fetch(pageUrls[i])
        if (!resp.ok) throw new Error(String(resp.status))
        pages.push({ html: await resp.text(), pageUrl: pageUrls[i], page: i + 1 })
      }
      const resp = await fetch('/api/wk-parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'خطأ غير معروف')
      setItems((data.items || []).map((it: Omit<ScrapedItem, 'selected'>) => ({ ...it, selected: true })))
      setErrors(data.errors || [])
      setScraping(false)
      return
    } catch {
      // الموقع ما يسمح بطلب مباشر من المتصفح (CORS مقفول) أو صار خطأ شبكة — نرجع للطريقة
      // العادية عبر سيرفرنا (تشتغل مع أغلب المواقع، إلا لو الموقع يحظر IP الاستضافة السحابية تحديداً)
    }

    try {
      const resp = await fetch('/api/wk-scrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlPattern, startPage, endPage }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'خطأ غير معروف')
      setItems((data.items || []).map((it: Omit<ScrapedItem, 'selected'>) => ({ ...it, selected: true })))
      setErrors(data.errors || [])
    } catch (e) {
      setErrors([(e as Error).message])
    }
    setScraping(false)
  }

  const toggleSelect = (i: number) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it))
  const setName = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, name: v } : it))
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const runEnrich = async () => {
    const targets = items.filter(it => it.selected && it.url && !it.posterUrl)
    if (targets.length === 0) return
    setEnriching(true); setEnrichDone(0)

    // محاولة 1: نجيب صفحة كل عمل من متصفحك مباشرة (نفس فكرة runScrape) — يتجاوز حظر IP سيرفرنا
    // لو الموقع يسمح كروس-أورجن. نجمع كل الصفحات أول (بدون حد)، وبعدين نرسلها للتحليل
    // بدفعات (حد أقصى 25 بالطلب الواحد لـ wk-parse-image — لو عدد الأعمال المحددة أكبر)
    const fetchedRows: { name: string; url: string; html: string }[] = []
    let fetchOk = true
    for (const t of targets) {
      if (!t.url) continue
      try {
        const resp = await fetch(t.url)
        if (!resp.ok) throw new Error(String(resp.status))
        fetchedRows.push({ name: t.name, url: t.url, html: await resp.text() })
      } catch { fetchOk = false; break }
      setEnrichDone(d => d + 1)
    }

    if (fetchOk && fetchedRows.length === targets.length) {
      const PARSE_BATCH = 20
      const batchErrors: string[] = []
      for (let i = 0; i < fetchedRows.length; i += PARSE_BATCH) {
        const chunk = fetchedRows.slice(i, i + PARSE_BATCH)
        try {
          const resp = await fetch('/api/wk-parse-image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: chunk }),
          })
          const data = await resp.json()
          if (resp.ok) {
            const byUrl = new Map<string, string>((data.items || []).map((it: { url: string; image: string }) => [it.url, it.image]))
            setItems(prev => prev.map(it => (it.url && byUrl.has(it.url)) ? { ...it, posterUrl: byUrl.get(it.url) || '' } : it))
          } else {
            batchErrors.push(`دفعة ${chunk.length}: ${data.error || resp.status}`)
          }
        } catch (e) {
          batchErrors.push(`دفعة ${chunk.length}: ${(e as Error).message}`)
        }
      }
      if (batchErrors.length) setErrors(batchErrors)
      setEnriching(false)
      return
    }
    // فشل الجلب المباشر (CORS مقفول أو خطأ شبكة بمنتصف الطريق) — نرجع للطريقة العادية عبر سيرفرنا

    setEnrichDone(0)
    const BATCH = 20
    for (let i = 0; i < targets.length; i += BATCH) {
      const chunk = targets.slice(i, i + BATCH)
      try {
        const resp = await fetch('/api/wk-enrich', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk.map(c => ({ name: c.name, url: c.url })) }),
        })
        const data = await resp.json()
        if (resp.ok) {
          const byUrl = new Map<string, string>((data.items || []).map((it: { url: string; image: string }) => [it.url, it.image]))
          setItems(prev => prev.map(it => (it.url && byUrl.has(it.url)) ? { ...it, posterUrl: byUrl.get(it.url) || '' } : it))
        }
      } catch { /* تجاهل الدفعة الفاشلة واستمر بالباقي */ }
      setEnrichDone(d => d + chunk.length)
    }
    setEnriching(false)
  }

  const runImport = async () => {
    if (!categoryId) { alert('اختر الفئة'); return }
    const targets = items.filter(it => it.selected && it.name.trim())
    if (targets.length === 0) return
    setImporting(true); setImportDone(0)
    let ok = 0
    for (const it of targets) {
      try {
        await addWork({
          title: it.name.trim(), categoryId, posterUrl: it.posterUrl || '',
          year: null, country: null, actors: [], extraInfo: '', difficulty: 'medium', isActive: true,
        })
        ok++
      } catch { /* تجاهل الفشل واستمر بالباقي */ }
      setImportDone(d => d + 1)
    }
    setLog(`تمت إضافة ${ok} من ${targets.length} للفئة "${cats.find(c => c.id === categoryId)?.name || ''}".`)
    setItems(prev => prev.filter(it => !it.selected))
    setImporting(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionTitle>سحب أعمال من موقع</SectionTitle>
        <Muted>يسحب أسماء الأعمال (وتخمين نوعها) من موقع، ثم تقدر تستخرج صورها وتضيفها كلها مباشرة لفئة تختارها — بدون ملفات Excel.</Muted>
        <input value={urlPattern} onChange={e => setUrlPattern(e.target.value)} placeholder="https://example.com/movies/page/{page}/" style={{ ...input, direction: 'ltr', textAlign: 'left' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" min={1} value={startPage} onChange={e => setStartPage(Number(e.target.value) || 1)} placeholder="من صفحة" style={input} />
          <input type="number" min={1} value={endPage} onChange={e => setEndPage(Number(e.target.value) || 1)} placeholder="إلى صفحة" style={input} />
        </div>
        <Muted>لو ما في ترقيم صفحات، اترك الرابط بدون {'{page}'} وبيسحب صفحة وحدة. الحد الأقصى 50 صفحة بالطلب الواحد.</Muted>
        <button onClick={runScrape} disabled={scraping || !urlPattern.trim()} style={{ ...primaryBtn, marginTop: 8, opacity: scraping || !urlPattern.trim() ? 0.6 : 1 }}>{scraping ? 'جارِ السحب…' : 'ابدأ السحب'}</button>
        {errors.length > 0 && <p style={{ color: C.red, fontWeight: 700, fontSize: 12, marginTop: 8 }}>{errors.join(' | ')}</p>}
      </Card>

      {items.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SectionTitle style={{ margin: 0 }}>{selectedCount} من {items.length} محدد</SectionTitle>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...input, width: 'auto', marginBottom: 0 }}>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={runEnrich} disabled={enriching} style={{ ...ghostBtn, flex: 1 }}>
              {enriching ? `جارِ استخراج الصور… (${enrichDone}/${items.filter(i => i.selected && i.url).length})` : 'استخرج الصور'}
            </button>
            <button onClick={runImport} disabled={importing || !categoryId || selectedCount === 0} style={{ ...primaryBtn, flex: 1 }}>
              {importing ? `جارِ الإضافة… (${importDone}/${selectedCount})` : `أضف ${selectedCount} للفئة`}
            </button>
          </div>
          {log && <div style={{ marginTop: 10, fontWeight: 800, color: C.violet }}>{log}</div>}
          {errors.length > 0 && <p style={{ color: C.red, fontWeight: 700, fontSize: 12, marginTop: 10 }}>{errors.join(' | ')}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, maxHeight: 440, overflowY: 'auto' }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderRadius: 10, background: `${C.ink}06` }}>
                <input type="checkbox" checked={it.selected} onChange={() => toggleSelect(i)} />
                {it.posterUrl ? <img src={it.posterUrl} alt="" width={30} height={42} style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 30, height: 42, borderRadius: 4, background: `${C.ink}14`, flexShrink: 0 }} />}
                <input value={it.name} onChange={e => setName(i, e.target.value)} style={{ ...input, marginBottom: 0, flex: 1 }} />
                <span style={{ fontSize: 11, color: `${C.ink}66`, whiteSpace: 'nowrap' }}>{it.type}</span>
                <button onClick={() => removeItem(i)} style={{ ...ghostBtn, padding: '4px 9px' }}>×</button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

