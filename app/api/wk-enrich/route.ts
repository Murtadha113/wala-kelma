// ═══════════════════════════════════════════════════════════════════════
// استخراج صورة (بوستر) لكل عمل — الخطوة 2 من أداة "سحب أعمال" بالإدارة
//
// وقت سحب الأسماء (wk-scrape) ما نجيب الصورة — نجيبها هنا بخطوة منفصلة لأنها
// تحتاج ندخل صفحة كل عمل لحاله (أبطأ)، فنسويها بس للأعمال اللي المشرف فعلاً
// اختارها للإضافة، مو لكل شي طلع بالسحب.
//
// طريقة الشغل لكل رابط عمل:
// 1) ندخل صفحة العمل ونجيب الـ HTML.
// 2) نقرأ وسم <meta property="og:image"> — تقريباً كل موقع حديث يحطه بصفحاته
//    عشان صورة المعاينة لما تُشارك الصفحة (فيسبوك/واتساب)، فهو أدق مصدر للبوستر.
// 3) لو ما فيه og:image، نجرّب twitter:image، وبعدها كحل أخير أول صورة بالمحتوى.
// ═══════════════════════════════════════════════════════════════════════
import * as cheerio from 'cheerio'

// runtime: 'nodejs' لازم عشان cheerio يحتاج بيئة Node كاملة (مو بيئة Edge المحدودة)
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
    const $ = cheerio.load(html)

    let image = ''

    // أولوية 1: صورة نص alt عندها يطابق اسم العمل — أدق مصدر لو موجود، وما يهم شكل القالب.
    // بعض المواقع (زي عرب سينما) تحط نفس og:image الافتراضي بكل صفحات الموقع فيصير عديم الفايدة،
    // فمطابقة alt بالاسم أوثق منه
    const normalizedName = row.name.trim().toLowerCase()
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

    if (image) image = new URL(image, row.url).toString()   // نحوّلها لرابط كامل لو كانت نسبية

    return { ...row, image: image || '' }
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
