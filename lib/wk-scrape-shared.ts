// ═══════════════════════════════════════════════════════════════════════
// منطق تحليل HTML المشترك بين كل راوتات "سحب أعمال" — معزول هنا عشان يُستخدم من
// طرفين مختلفين:
// 1) راوتات تجيب الـHTML بنفسها من سيرفرنا (wk-scrape, wk-enrich) — تشتغل مع أغلب المواقع.
// 2) راوتات "parse-only" (wk-parse, wk-parse-image) تستقبل HTML جابه متصفح المشرف نفسه —
//    تُستخدم تلقائياً لما الموقع الهدف يحظر IP سيرفرنا (شائع مع مواقع خلف Cloudflare تحظر
//    نطاقات IP الاستضافة السحابية بالجملة) لكن يسمح بطلبات كروس-أورجن (Access-Control-Allow-Origin).
//    ما فيها أي تحايل — الطلب بهذي الحالة يطلع فعلياً من جهاز المشرف، بنفس الآلية اللي الموقع نفسه فاتحها.
// ═══════════════════════════════════════════════════════════════════════
import * as cheerio from 'cheerio'

export interface ScrapedItem { name: string; url: string | null; type: string; page?: number }

// نخمّن نوع العمل من الكلمات اللي حوالين اسمه بالصفحة (عنوان القسم، وسم، فقرة...) —
// أول كلمة مفتاحية تتطابق تحدد النوع؛ لو ما لقينا شي نرجّع "غير محدد" والمشرف يعدّله يدوياً
const TYPE_KEYWORDS: { type: string; words: string[] }[] = [
  { type: 'مسلسل', words: ['مسلسل', 'حلقة', 'الحلقة', 'موسم'] },
  { type: 'فلم', words: ['فيلم', 'فلم', 'أفلام'] },
  { type: 'مسرحية', words: ['مسرحية', 'مسرحيات'] },
  { type: 'برنامج', words: ['برنامج', 'برامج'] },
  { type: 'أنمي', words: ['أنمي', 'انمي'] },
]

export function detectType(text: string): string {
  const t = text || ''
  for (const entry of TYPE_KEYWORDS) {
    if (entry.words.some(w => t.includes(w))) return entry.type
  }
  return 'غير محدد'
}

// روابط الأعمال بالصفحة غالباً نسبية (مثلاً "/movie/123") — نحوّلها لرابط كامل
// عشان خطوة استخراج الصور بعدين تقدر تدخل عليها مباشرة
export function toAbsoluteUrl(href: string, baseUrl: string): string | null {
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

// يحلل صفحة وحدة ويطلع منها كل الأعمال اللي قدر يتعرّف عليها
export function extractFromPage(html: string, pageUrl: string): ScrapedItem[] {
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

// يستخرج رابط بوستر العمل من صفحته — يُستدعى بخطوة "استخراج الصور" (enrich) بعد ما المشرف يحدد الأعمال
export function extractImage(html: string, pageUrl: string, name: string): string {
  const $ = cheerio.load(html)
  let image = ''

  // أولوية 1: صورة نص alt عندها يطابق اسم العمل — أدق مصدر لو موجود، وما يهم شكل القالب.
  // بعض المواقع تحط نفس og:image الافتراضي بكل صفحات الموقع فيصير عديم الفايدة، فمطابقة alt أوثق منه
  const normalizedName = name.trim().toLowerCase()
  if (normalizedName) {
    $('img[alt]').each((_, el) => {
      if (image) return
      const alt = ($(el).attr('alt') || '').trim().toLowerCase()
      if (alt && (alt === normalizedName || alt.includes(normalizedName) || normalizedName.includes(alt))) {
        const src = $(el).attr('src')
        if (src) image = src
      }
    })
  }

  // أولوية 2: وسم meta القياسي (og:image / twitter:image)
  if (!image) image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || ''

  // أولوية 3 (أخيرة): أول صورة داخل منطقة المحتوى الرئيسية بالصفحة
  if (!image) {
    const firstImg = $('article img, .postDiv img, .single img, main img').first().attr('src')
    if (firstImg) image = firstImg
  }

  return image ? new URL(image, pageUrl).toString() : ''   // نحوّلها لرابط كامل لو كانت نسبية
}
