'use client'

import { useEffect, useState } from 'react'
import { uploadImage } from '@/lib/storage'
import {
  getCategories, addCategory, updateCategory, deleteCategory, seedDefaultCategories,
  getAllWorks, addWork, updateWork, deleteWork,
  WKCategory, WalaKelmaWork, NewWork, Difficulty,
} from '@/lib/works'
import { C, Card, SectionTitle, Muted, input, primaryBtn, ghostBtn } from '@/components/admin-ui'
import { DashboardTab, OrdersTab, UsersTab, PackagesAdminTab, CouponsTab, SettingsTab } from '@/app/admin/business-tabs'
import { Logo } from '@/components/logo'

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [pass, setPass] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'works' | 'categories' | 'import' | 'orders' | 'users' | 'packages' | 'coupons' | 'settings'>('dashboard')

  useEffect(() => { if (sessionStorage.getItem('wk_admin') === '1') setUnlocked(true) }, [])

  const tryUnlock = () => {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || 'change-me'
    if (pass === expected) { sessionStorage.setItem('wk_admin', '1'); setUnlocked(true) }
    else alert('كلمة المرور غير صحيحة')
  }

  if (!unlocked) {
    return <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, border: `1px solid ${C.ink}12`, width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Logo height={54} /></div>
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8, marginBottom: 16 }}>لوحة إدارة المحتوى</div>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="كلمة المرور"
          onKeyDown={e => e.key === 'Enter' && tryUnlock()}
          style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.ink}20`, fontSize: 15, textAlign: 'center', outline: 'none', background: C.cream }} />
        <button onClick={tryUnlock} style={{ ...primaryBtn, marginTop: 12 }}>دخول</button>
      </div>
    </div>
  }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: C.cream, color: C.ink }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 14px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Logo height={28} />
            <span style={{ fontSize: 15, fontWeight: 800, color: `${C.ink}99` }}>· الإدارة</span>
          </div>
          <a href="/" style={{ fontSize: 13, color: `${C.ink}88`, textDecoration: 'none' }}>← الرئيسية</a>
        </div>

        <div style={{ display: 'flex', gap: 6, background: '#fff', borderRadius: 16, padding: 6, border: `1px solid ${C.ink}12`, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            ['dashboard', 'نظرة عامة'], ['works', 'الأعمال'], ['categories', 'الفئات'], ['import', 'استيراد CSV'],
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
        {tab === 'import' && <ImportTab />}
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
              : <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.ink}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎭</div>}
            <span style={{ flex: 1, fontWeight: 800 }}>{c.name}</span>
            <label style={{ ...ghostBtn, cursor: 'pointer' }}>
              {uploadingId === c.id ? '…' : c.imageUrl ? 'تغيير' : '📤 صورة'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadCategoryImage(c.id, f) }} />
            </label>
            <button onClick={() => { setUrlEditId(urlEditId === c.id ? null : c.id); setUrlValue(c.imageUrl || '') }} style={ghostBtn}>🔗</button>
            <button onClick={async () => { setErr(''); try { await updateCategory(c.id, { isActive: !c.isActive }); reload() } catch (e) { setErr('فشل التحديث: ' + (e as Error).message) } }}
              style={{ ...ghostBtn, color: c.isActive ? '#27AE78' : C.red }}>{c.isActive ? '👁 ظاهرة' : '🙈 مخفية'}</button>
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
        <button onClick={openQuickAdd} style={{ ...ghostBtn, width: 'auto', padding: '11px 14px', whiteSpace: 'nowrap' }}>📋 إضافة سريعة</button>
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
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ ...ghostBtn, display: 'block', textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}>
            📤 اختر الصور (يمكن تحديد أكثر من صورة)
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
                  <button onClick={() => removeQuickItem(i)} style={{ ...ghostBtn, color: C.red, padding: '8px 10px', alignSelf: 'flex-start' }}>✕</button>
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

      {(showForm || editing) && <WorkForm cats={cats} initial={editing} onClose={() => { setShowForm(false); setEditing(null) }} onSaved={() => { setShowForm(false); setEditing(null); reload() }} />}

      {filtered.length === 0 && <Card><Muted>لا توجد أعمال. أضف أعمالاً بصورها أو استخدم الإضافة السريعة بالصور أو استيراد CSV.</Muted></Card>}
      {filtered.map((w, i) => (
        <Card key={w.id}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 22, textAlign: 'center', fontWeight: 900, color: `${C.ink}55`, fontSize: 13 }}>{i + 1}</div>
            {w.posterUrl ? <img src={w.posterUrl} alt="" width={40} height={54} style={{ borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 40, height: 54, borderRadius: 8, background: `${C.ink}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎬</div>}
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

function WorkForm({ cats, initial, onClose, onSaved }: { cats: WKCategory[]; initial: WalaKelmaWork | null; onClose: () => void; onSaved: () => void }) {
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
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <SectionTitle style={{ margin: 0 }}>{initial ? 'تعديل عمل' : 'عمل جديد'}</SectionTitle>
        <button onClick={onClose} style={ghostBtn}>إغلاق</button>
      </div>
      <input value={f.title} onChange={e => set('title', e.target.value)} placeholder="اسم العمل *" style={input} />
      <select value={f.categoryId} onChange={e => set('categoryId', e.target.value)} style={input}>
        <option value="">اختر الفئة *</option>
        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        <label style={{ ...ghostBtn, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {uploading ? '…' : '📤 رفع'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {f.posterUrl && <img src={f.posterUrl} alt="" style={{ width: 60, borderRadius: 8, marginTop: 8 }} />}
      <button onClick={save} disabled={busy} style={{ ...primaryBtn, marginTop: 10 }}>{busy ? '…' : 'حفظ'}</button>
    </Card>
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
          <label style={{ ...ghostBtn, cursor: 'pointer' }}>📁 ملف CSV<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={async e => { const file = e.target.files?.[0]; if (file) setText(await file.text()) }} /></label>
          <button onClick={() => setText(template)} style={ghostBtn}>قالب</button>
          <button onClick={run} disabled={busy} style={{ ...primaryBtn, flex: 1 }}>{busy ? 'جاري الاستيراد…' : 'استيراد'}</button>
        </div>
        {log && <div style={{ marginTop: 10, fontWeight: 800, color: C.violet }}>{log}</div>}
      </Card>
    </div>
  )
}

