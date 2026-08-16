// ═══════════════════════════════════════════════════════════════════════
// يستخرج البوستر من صفحات عمل جابها متصفح المشرف نفسه — نفس فكرة wk-parse لكن للصور.
// راجع wk-parse للتفاصيل الكاملة عن سبب وجود المسار المزدوج (سيرفر / متصفح).
// ═══════════════════════════════════════════════════════════════════════
import { extractImage } from '@/lib/wk-scrape-shared'

// runtime: 'nodejs' لازم عشان cheerio (تحليل الـHTML بالمكتبة المشتركة) يحتاج بيئة Node كاملة
export const runtime = 'nodejs'

interface ParseImageRow { name: string; url: string; html: string }

// نقطة الدخول: POST /api/wk-parse-image
// body: { rows: [{ name, url, html }, ...] } — صفحات عمل جابها المتصفح بنفسه مسبقاً
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { rows?: ParseImageRow[] } | null
  const rows = body?.rows
  if (!Array.isArray(rows) || rows.length === 0) return Response.json({ error: 'لا توجد بيانات' }, { status: 400 })
  if (rows.length > 25) return Response.json({ error: 'الحد الأقصى 25 صف بالطلب الواحد' }, { status: 400 })

  const items = rows
    .filter(r => r?.url && r?.html)
    .map(r => ({ name: r.name, url: r.url, image: extractImage(r.html, r.url, r.name) }))

  return Response.json({ items })
}
