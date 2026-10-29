// قارئ ملفات Excel (.xlsx) بسيط بدون مكتبات — الملف أصلاً zip فيه XML، نفكّه بـ DecompressionStream
// المدمج بالمتصفح ونقرأ أول ورقة كجدول نصوص (صف العناوين أول صف). يكفي لاستيراد الأعمال بالأدمن.

async function unzip(buf: ArrayBuffer): Promise<Map<string, string>> {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  // نهاية الفهرس المركزي (EOCD) — نبحث عنها من آخر الملف
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('الملف مو Excel صالح (.xlsx)')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const files = new Map<string, string>()
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(p + 10, true)
    const compSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const raw = bytes.slice(dataStart, dataStart + compSize)
    if (method === 0) files.set(name, dec.decode(raw))
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      files.set(name, await new Response(stream).text())
    }
  }
  return files
}

const decodeXml = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&')

// نص الخلية قد يتوزع على أكثر من <t> (تنسيقات مختلفة داخل نفس النص)
const joinRuns = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decodeXml(m[1])).join('')

// "BC12" → 54 (رقم العمود من صفر)
function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export async function readXlsxRows(file: File): Promise<string[][]> {
  const files = await unzip(await file.arrayBuffer())

  // أول ورقة حسب ترتيب workbook.xml (مو بالضرورة sheet1.xml)
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const wb = files.get('xl/workbook.xml')
  const rels = files.get('xl/_rels/workbook.xml.rels')
  const firstRid = wb?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1]
  if (firstRid && rels) {
    const target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstRid}"[^>]*Target="([^"]+)"`))?.[1]
      ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstRid}"`))?.[1]
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  }
  const sheet = files.get(sheetPath)
  if (!sheet) throw new Error('ما لقيت ورقة بيانات داخل الملف')

  const shared = [...(files.get('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => joinRuns(m[1]))

  const rows: string[][] = []
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]
      const body = cm[2] || ''
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]
      const type = attrs.match(/\bt="([^"]+)"/)?.[1]
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let val = ''
      if (type === 's' && v != null) val = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') val = joinRuns(body)
      else if (v != null) val = decodeXml(v)
      const i = ref ? colIndex(ref) : row.length
      while (row.length < i) row.push('')
      row[i] = val.trim()
    }
    if (row.some(c => c !== '')) rows.push(row)
  }
  return rows
}
