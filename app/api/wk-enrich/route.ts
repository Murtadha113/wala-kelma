// ═══════════════════════════════════════════════════════════════════════
// استخراج صورة (بوستر) لكل عمل — الخطوة 2 من أداة "سحب أعمال" بالإدارة
//
// هذا الراوت يجيب صفحة كل عمل بنفسه من سيرفرنا. لو الموقع يحظر IP سيرفرنا (Vercel)،
// الواجهة تجرّب أول /api/wk-parse-image (طلب من متصفح المشرف نفسه) وترجع لهذا الراوت
// بس لو ذاك فشل — نفس فكرة wk-scrape/wk-parse.
//
// طريقة الشغل لكل رابط عمل:
// 1) ندخل صفحة العمل ونجيب الـ HTML.
// 2) نحلّلها بـ extractImage (lib/wk-scrape-shared): صورة alt مطابقة للاسم، ثم og:image،
//    ثم أول صورة بالمحتوى — بالترتيب.
// ═══════════════════════════════════════════════════════════════════════
import { extractImage } from '@/lib/wk-scrape-shared'

// runtime: 'nodejs' لازم عشان cheerio (تحليل الـHTML بالمكتبة المشتركة) يحتاج بيئة Node كاملة
export const runtime = 'nodejs'

interface EnrichRow { name: string; type?: string; url: string | null }

// يجيب صورة عمل وحد — أي خطأ (رابط ميت، حظر، تايم آوت) يرجّع صورة فاضية بدل ما يوقف الدفعة كلها
async function getImageForRow(row: EnrichRow): Promise<EnrichRow & { image: string }> {
  if (!row.url) return { ...row, image: '' }
  try {
    const resp = await fetch(row.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    })
    if (!resp.ok) return { ...row, image: '' }
    const html = await resp.text()
    return { ...row, image: extractImage(html, row.url, row.name) }
  } catch {
    return { ...row, image: '' }
  }
}

// نقطة الدخول: POST /api/wk-enrich
// body: { rows: [{ name, url }, ...] } — الصفوف اللي المشرف حدّدها من نتائج wk-scrape
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { rows?: EnrichRow[] } | null
  const rows = body?.rows
  if (!Array.isArray(rows) || rows.length === 0) return Response.json({ error: 'لا توجد بيانات' }, { status: 400 })
  // حد أقصى 25 صف بالطلب الواحد — الواجهة (ScrapeTab) تقسّم أي عدد أكبر لدفعات تلقائياً
  if (rows.length > 25) return Response.json({ error: 'الحد الأقصى 25 صف بالطلب الواحد (عشان ما يصير Timeout) — قسّم الدفعة' }, { status: 400 })

  // نجيب الصور بدفعات صغيرة (5 بالتوازي) بدل الكل مرة وحدة — نخفف الضغط
  // على سيرفر الموقع الهدف وعلى سيرفرنا بنفس الوقت
  const BATCH = 5
  const output: (EnrichRow & { image: string })[] = []
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const done = await Promise.all(chunk.map(getImageForRow))
    output.push(...done)
  }

  // الواجهة تربط النتائج برجوعها لنفس الصفوف (عبر url) وتعبّي posterUrl لكل عمل
  return Response.json({ items: output })
}
