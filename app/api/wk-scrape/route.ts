// ═══════════════════════════════════════════════════════════════════════
// سحب أعمال (أفلام/مسلسلات/مسرحيات...) من موقع خارجي — الخطوة 1 من أداة "سحب أعمال" بالإدارة
//
// ليش سيرفر (API route) مو المتصفح مباشرة؟
// المتصفح ممنوع يقرأ محتوى موقع ثاني مباشرة (سياسة CORS الأمنية بالمتصفحات).
// الحل: المتصفح يطلب من هذا الراوت (اللي يشتغل على سيرفرنا)، وهو يطلب الموقع الخارجي
// وين ما فيه قيود، ثم يرجّع النتيجة جاهزة للمتصفح كـ JSON.
//
// طريقة الشغل:
// 1) نستقبل رابط الموقع + نطاق الصفحات من الواجهة (ScrapeTab بلوحة الإدارة).
// 2) لكل صفحة: نجيب الـ HTML الخام (fetch عادي، بدون متصفح حقيقي — أخف وأسرع).
// 3) نحلّل الـ HTML بمكتبة cheerio (نفس طريقة jQuery لكن على السيرفر) ونستخرج
//    اسم كل عمل ورابطه ونوعه المتوقّع.
// 4) نرجّع القائمة كاملة + أي أخطاء صارت بصفحات معيّنة (موقع بطيء، صفحة مو موجودة...).
// ═══════════════════════════════════════════════════════════════════════
import * as cheerio from 'cheerio'

// runtime: 'nodejs' لازم عشان cheerio يحتاج بيئة Node كاملة (مو بيئة Edge المحدودة)
export const runtime = 'nodejs'

// نخمّن نوع العمل من الكلمات اللي حوالين اسمه بالصفحة (عنوان القسم، وسم، فقرة...) —
// أول كلمة مفتاحية تتطابق تحدد النوع؛ لو ما لقينا شي نرجّع "غير محدد" والمشرف يعدّله يدوياً
const TYPE_KEYWORDS: { type: string; words: string[] }[] = [
  { type: 'مسلسل', words: ['مسلسل', 'حلقة', 'الحلقة', 'موسم'] },
  { type: 'فلم', words: ['فيلم', 'فلم', 'أفلام'] },
  { type: 'مسرحية', words: ['مسرحية', 'مسرحيات'] },
  { type: 'برنامج', words: ['برنامج', 'برامج'] },
  { type: 'أنمي', words: ['أنمي', 'انمي'] },
]

function detectType(text: string): string {
  const t = text || ''
  for (const entry of TYPE_KEYWORDS) {
    if (entry.words.some(w => t.includes(w))) return entry.type
  }
  return 'غير محدد'
}

// روابط الأعمال بالصفحة غالباً نسبية (مثلاً "/movie/123") — نحوّلها لرابط كامل
// عشان خطوة استخراج الصور (wk-enrich) بعدين تقدر تدخل عليها مباشرة
function toAbsoluteUrl(href: string, baseUrl: string): string | null {
  try { return new URL(href, baseUrl).toString() } catch { return null }
}

// محددات CSS (Selectors) جرّبناها لأنها شائعة بقوالب ووردبريس اللي تستخدمها مواقع
// الأفلام/المسلسلات العربية — نجرّبها بالترتيب، وأول واحد يطلع له 3 عناصر فأكثر نعتمده.
// لو موقع مختلف بالتصميم وما ظبطت معاه، تحتاج تضيف محدد خاص فيه هنا.
const CANDIDATE_SELECTORS = [
  '.entry-title a', 'h2.entry-title a', 'h3.entry-title a',
  '.postDiv h1 a', '.postDiv .h1 a', 'article h3 a', 'article h2 a',
  '.Small--Box .title a', '.BlockName a', '.GridItem .title a',
  '.singleTitle a', '.Block--Item a.title',
]

// بعض المواقع (قوالب بطاقات حديثة) تحط العنوان بعنصر منفصل (h2/h3) جوه البطاقة، والرابط
// يكون بأقرب <a> يغلّف البطاقة كلها — مو نفس العنصر. لو لقينا واحد من هذي نجرّب معه إستراتيجية مختلفة
const TITLE_ELEMENT_SELECTORS = ['.modern-title']
// عنصر يحمل نوع العمل صراحة جنب العنوان (أدق من تخمين الكلمات المفتاحية لو موجود)
const EXPLICIT_TYPE_SELECTOR = '.modern-subtitle'

interface ScrapedItem { name: string; url: string | null; type: string; page?: number }

// يحلل صفحة وحدة ويطلع منها كل الأعمال اللي قدر يتعرّف عليها
function extractFromPage(html: string, pageUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html)
  let items: ScrapedItem[] = []

  // محاولة 1: نجرّب المحددات الجاهزة (CANDIDATE_SELECTORS) وحدة وحدة
  for (const sel of CANDIDATE_SELECTORS) {
    const found = $(sel)
    if (found.length >= 3) {   // أقل من 3 = على الأغلب مو القائمة الصحيحة (زر أو رابط عشوائي)
      found.each((_, el) => {
        const $el = $(el)
        const name = $el.text().trim()
        const href = $el.attr('href')
        if (!name || !href) return
        const url = toAbsoluteUrl(href, pageUrl)
        // نجمع النص المحيط بالعنصر (البطاقة/المقالة اللي يحتويه) عشان نخمّن النوع منه
        const contextText = $el.closest('article, .postDiv, .Small--Box, .GridItem, li, div').text()
        items.push({ name, url, type: detectType(contextText || name) })
      })
      if (items.length) break   // أول محدد نجح فيه نوقف — ما نكرر بمحددات ثانية
    }
  }

  // محاولة 2: عنوان بعنصر منفصل جوه بطاقة (TITLE_ELEMENT_SELECTORS)، والرابط بأقرب <a> يغلّف البطاقة —
  // نجرّبها قبل الاحتياطية العامة لأنها أدق بكثير من مسح كل الروابط
  if (!items.length) {
    for (const sel of TITLE_ELEMENT_SELECTORS) {
      const found = $(sel)
      if (found.length >= 3) {
        found.each((_, el) => {
          const $el = $(el)
          const name = $el.text().trim()
          const card = $el.closest('.content-card, article, li, .col, div')
          const $link = $el.closest('a[href]').length ? $el.closest('a[href]') : card.find('a[href]').first()
          const href = $link.attr('href')
          if (!name || !href) return
          const url = toAbsoluteUrl(href, pageUrl)
          const explicitType = card.find(EXPLICIT_TYPE_SELECTOR).first().text().trim()
          items.push({ name, url, type: explicitType ? detectType(explicitType) : detectType(card.text() || name) })
        })
        if (items.length) break
      }
    }
  }

  // محاولة 3 (احتياطية أخيرة): لو ولا محدد من القوائم أعلاه نجح، نمسح كل روابط منطقة
  // المحتوى الرئيسية ونفلتر الروابط اللي نصها يشبه اسم عمل (طول معقول)
  if (!items.length) {
    const container = $('#content, .content, main, #main, body').first()
    container.find('a').each((_, el) => {
      const $el = $(el)
      const name = $el.text().trim()
      const href = $el.attr('href')
      if (!name || name.length < 3 || name.length > 100 || !href) return
      const url = toAbsoluteUrl(href, pageUrl)
      const contextText = $el.parent().text()
      items.push({ name, url, type: detectType(contextText || name) })
    })
  }

  // إزالة التكرار (نفس الاسم + نفس الرابط) — قد يظهر العمل الوحد أكثر من مرة
  // بالصفحة (بوستر + عنوان، كلاهما رابط لنفس العمل)
  const seen = new Set<string>()
  const unique: ScrapedItem[] = []
  for (const it of items) {
    const key = `${it.name}|${it.url}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(it)
  }
  return unique
}

// نقطة الدخول: POST /api/wk-scrape
// body: { urlPattern, startPage, endPage }
// - urlPattern: رابط الموقع، ممكن يحتوي "{page}" بمكان رقم الصفحة (مثلاً site.com/movies/page/{page}/)
// - startPage/endPage: نطاق الصفحات (يُتجاهل endPage لو ما فيه "{page}" بالرابط — صفحة وحدة فقط)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { urlPattern?: string; startPage?: number; endPage?: number } | null
  const urlPattern = body?.urlPattern
  if (!urlPattern) return Response.json({ error: 'الرجاء إدخال رابط الموقع' }, { status: 400 })

  const hasPlaceholder = urlPattern.includes('{page}')
  const start = Number(body?.startPage) || 1
  const end = hasPlaceholder ? Number(body?.endPage) || start : start

  // حد أقصى 50 صفحة بالطلب الواحد — حماية من طلب يطول كثير ويعلّق (Vercel/سيرفر عندهم مهلة زمنية للطلب)
  if (end - start > 50) return Response.json({ error: 'الحد الأقصى 50 صفحة بالطلب الواحد' }, { status: 400 })

  const results: ScrapedItem[] = []
  const errors: string[] = []

  // نسحب الصفحات وحدة ورا وحدة (مو بالتوازي) عشان ما نحمّل سيرفر الموقع الهدف بطلبات كثيرة دفعة وحدة
  for (let p = start; p <= end; p++) {
    const pageUrl = hasPlaceholder ? urlPattern.replace('{page}', String(p)) : urlPattern
    try {
      // رؤوس تشبه متصفح حقيقي — بعض المواقع تحظر الطلبات الناقصة (بدون Accept/Accept-Language)
      // حتى لو فيها User-Agent صحيح، تعتبرها بوت. هذا ما يضمن تجاوز حماية Cloudflare الكاملة —
      // لو الموقع يحظر IP السيرفر نفسه (شائع مع سيرفرات الاستضافة السحابية) بيفشل الطلب برضه.
      const resp = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        },
      })
      if (!resp.ok) { errors.push(`صفحة ${p}: فشل الطلب (${resp.status})`); continue }
      const html = await resp.text()
      const items = extractFromPage(html, pageUrl)
      items.forEach(it => { it.page = p })
      results.push(...items)
    } catch (e) {
      errors.push(`صفحة ${p}: ${(e as Error).message}`)
    }
    if (!hasPlaceholder) break   // ما فيه ترقيم صفحات — صفحة وحدة وخلاص
  }

  // إزالة التكرار الكلي (بين كل الصفحات مع بعض، مو بس داخل صفحة وحدة)
  const seen = new Set<string>()
  const unique = results.filter(it => {
    const key = `${it.name}|${it.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // الواجهة (ScrapeTab) تستقبل هذا وتعرضه كجدول قابل للتعديل قبل الإضافة الفعلية لقاعدة البيانات
  return Response.json({ items: unique, errors })
}
