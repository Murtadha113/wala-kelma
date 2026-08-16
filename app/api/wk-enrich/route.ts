// يدخل صفحة كل عمل ويسحب صورة og:image (أو أول صورة بالمحتوى) — سيرفر فقط
import * as cheerio from 'cheerio'

export const runtime = 'nodejs'

interface EnrichRow { name: string; type?: string; url: string | null }

async function getImageForRow(row: EnrichRow): Promise<EnrichRow & { image: string }> {
  if (!row.url) return { ...row, image: '' }
  try {
    const resp = await fetch(row.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' },
    })
    if (!resp.ok) return { ...row, image: '' }
    const html = await resp.text()
    const $ = cheerio.load(html)

    let image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || ''

    if (!image) {
      const firstImg = $('article img, .postDiv img, .single img, main img').first().attr('src')
      if (firstImg) image = new URL(firstImg, row.url).toString()
    }

    return { ...row, image: image || '' }
  } catch {
    return { ...row, image: '' }
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { rows?: EnrichRow[] } | null
  const rows = body?.rows
  if (!Array.isArray(rows) || rows.length === 0) return Response.json({ error: 'لا توجد بيانات' }, { status: 400 })
  if (rows.length > 25) return Response.json({ error: 'الحد الأقصى 25 صف بالطلب الواحد (عشان ما يصير Timeout) — قسّم الدفعة' }, { status: 400 })

  const BATCH = 5
  const output: (EnrichRow & { image: string })[] = []
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const done = await Promise.all(chunk.map(getImageForRow))
    output.push(...done)
  }

  return Response.json({ items: output })
}
