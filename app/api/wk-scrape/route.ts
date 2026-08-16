// يسحب أسماء وأنواع الأعمال من موقع خارجي — سيرفر فقط (Node) عشان نتفادى قيود CORS بالمتصفح
import * as cheerio from 'cheerio'

export const runtime = 'nodejs'

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

function toAbsoluteUrl(href: string, baseUrl: string): string | null {
  try { return new URL(href, baseUrl).toString() } catch { return null }
}

// محاولات محددات CSS شائعة بمواقع الأفلام/المسلسلات العربية (قوالب ووردبريس منتشرة)
const CANDIDATE_SELECTORS = [
  '.entry-title a', 'h2.entry-title a', 'h3.entry-title a',
  '.postDiv h1 a', '.postDiv .h1 a', 'article h3 a', 'article h2 a',
  '.Small--Box .title a', '.BlockName a', '.GridItem .title a',
  '.singleTitle a', '.Block--Item a.title',
]

interface ScrapedItem { name: string; url: string | null; type: string; page?: number }

function extractFromPage(html: string, pageUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html)
  let items: ScrapedItem[] = []

  for (const sel of CANDIDATE_SELECTORS) {
    const found = $(sel)
    if (found.length >= 3) {
      found.each((_, el) => {
        const $el = $(el)
        const name = $el.text().trim()
        const href = $el.attr('href')
        if (!name || !href) return
        const url = toAbsoluteUrl(href, pageUrl)
        const contextText = $el.closest('article, .postDiv, .Small--Box, .GridItem, li, div').text()
        items.push({ name, url, type: detectType(contextText || name) })
      })
      if (items.length) break
    }
  }

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { urlPattern?: string; startPage?: number; endPage?: number } | null
  const urlPattern = body?.urlPattern
  if (!urlPattern) return Response.json({ error: 'الرجاء إدخال رابط الموقع' }, { status: 400 })

  const hasPlaceholder = urlPattern.includes('{page}')
  const start = Number(body?.startPage) || 1
  const end = hasPlaceholder ? Number(body?.endPage) || start : start

  if (end - start > 50) return Response.json({ error: 'الحد الأقصى 50 صفحة بالطلب الواحد' }, { status: 400 })

  const results: ScrapedItem[] = []
  const errors: string[] = []

  for (let p = start; p <= end; p++) {
    const pageUrl = hasPlaceholder ? urlPattern.replace('{page}', String(p)) : urlPattern
    try {
      const resp = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' },
      })
      if (!resp.ok) { errors.push(`صفحة ${p}: فشل الطلب (${resp.status})`); continue }
      const html = await resp.text()
      const items = extractFromPage(html, pageUrl)
      items.forEach(it => { it.page = p })
      results.push(...items)
    } catch (e) {
      errors.push(`صفحة ${p}: ${(e as Error).message}`)
    }
    if (!hasPlaceholder) break
  }

  const seen = new Set<string>()
  const unique = results.filter(it => {
    const key = `${it.name}|${it.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return Response.json({ items: unique, errors })
}
