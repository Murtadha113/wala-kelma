// ═══════════════════════════════════════════════════════════════════════
// يحلل صفحات HTML جابها متصفح المشرف نفسه (fetch من جهة العميل) — بدون ما سيرفرنا
// يطلب أي شي من الموقع الخارجي، عشان كذا هذا الراوت ما يفشل أبداً بحظر IP.
//
// ليش نحتاجه؟ بعض المواقع (خلف Cloudflare) تحظر نطاقات IP سيرفرات الاستضافة السحابية
// (Vercel وغيرها) بالجملة، لكن تسمح بطلبات كروس-أورجن من المتصفح مباشرة عبر ترويسة
// Access-Control-Allow-Origin. الواجهة (ScrapeTab) تتحقق من هذا: تجرّب fetch() من
// متصفح المشرف نفسه لكل صفحة، ولو نجحت ترسل الـHTML الجاهز هنا للتحليل بس (بدون طلب شبكة إضافي).
// لو الموقع ما يسمح CORS، الطلب من المتصفح يفشل والواجهة ترجع تلقائياً لـ /api/wk-scrape
// (اللي يطلب الصفحة من سيرفرنا كالمعتاد).
// ═══════════════════════════════════════════════════════════════════════
import { extractFromPage, type ScrapedItem } from '@/lib/wk-scrape-shared'

// runtime: 'nodejs' لازم عشان cheerio (تحليل الـHTML بالمكتبة المشتركة) يحتاج بيئة Node كاملة
export const runtime = 'nodejs'

// نقطة الدخول: POST /api/wk-parse
// body: { pages: [{ html, pageUrl, page? }, ...] } — صفحات جابها المتصفح بنفسه مسبقاً
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { pages?: { html: string; pageUrl: string; page?: number }[] } | null
  const pages = body?.pages
  if (!Array.isArray(pages) || pages.length === 0) return Response.json({ error: 'لا توجد صفحات' }, { status: 400 })
  if (pages.length > 50) return Response.json({ error: 'الحد الأقصى 50 صفحة بالطلب الواحد' }, { status: 400 })

  const results: ScrapedItem[] = []
  for (const p of pages) {
    if (!p?.html || !p?.pageUrl) continue
    const items = extractFromPage(p.html, p.pageUrl)
    items.forEach(it => { it.page = p.page })
    results.push(...items)
  }

  // إزالة التكرار الكلي (بين كل الصفحات مع بعض، مو بس داخل صفحة وحدة) — نفس منطق wk-scrape
  const seen = new Set<string>()
  const unique = results.filter(it => {
    const key = `${it.name}|${it.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return Response.json({ items: unique, errors: [] })
}
