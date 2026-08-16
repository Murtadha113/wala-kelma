// ═══════════════════════════════════════════════════════════════════════
// سحب أعمال (أفلام/مسلسلات/مسرحيات...) من موقع خارجي — الخطوة 1 من أداة "سحب أعمال" بالإدارة
//
// هذا الراوت يجيب الـHTML بنفسه من سيرفرنا (Vercel). بعض المواقع (خلف Cloudflare) تحظر
// نطاقات IP سيرفرات الاستضافة السحابية بالجملة، فيفشل الطلب حتى لو الموقع نفسه شغّال عادي
// لأي زائر حقيقي. لهذا الواجهة (ScrapeTab) تجرّب أول طلب مباشر من متصفح المشرف نفسه
// (عبر /api/wk-parse لو الموقع يسمح CORS) وترجع لهذا الراوت بس لو ذاك فشل.
//
// طريقة الشغل:
// 1) نستقبل رابط الموقع + نطاق الصفحات من الواجهة.
// 2) لكل صفحة: نجيب الـ HTML الخام (fetch عادي، بدون متصفح حقيقي — أخف وأسرع).
// 3) نحلّل الـ HTML بمكتبة cheerio (lib/wk-scrape-shared) ونستخرج اسم كل عمل ورابطه ونوعه.
// 4) نرجّع القائمة كاملة + أي أخطاء صارت بصفحات معيّنة (موقع بطيء، صفحة مو موجودة، حظر...).
// ═══════════════════════════════════════════════════════════════════════
import { extractFromPage, type ScrapedItem } from '@/lib/wk-scrape-shared'

// runtime: 'nodejs' لازم عشان cheerio (تحليل الـHTML بالمكتبة المشتركة) يحتاج بيئة Node كاملة
export const runtime = 'nodejs'

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
      // لو الموقع يحظر IP السيرفر نفسه (شائع مع سيرفرات الاستضافة السحابية) بيفشل الطلب برضه،
      // وهنا بالضبط تفرق /api/wk-parse (الطلب من متصفح المشرف) عن هذا الراوت.
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
