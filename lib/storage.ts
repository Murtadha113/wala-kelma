// رفع الصور إلى ImgBB — مجاني بدون بطاقة ائتمان (Firebase Storage الجديد يتطلب خطة Blaze المدفوعة)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// البنرات والإيصالات تحتاج دقة أعلى (عرض عريض / نص لازم ينقرا)، الباقي بوسترات صغيرة
const FALLBACK_MAX_SIDE: Record<string, number> = { banners: 1400, receipts: 1400 }
const FALLBACK_MAX_BYTES = 700_000   // تحت حد مستند Firestore (1MB) بهامش لباقي الحقول

// بديل لما ImgBB يطيح (صيانة/حظر): نصغّر الصورة بالمتصفح ونرجعها data URL تنحفظ داخل المستند نفسه —
// الرفع يكمل بدون أي خدمة خارجية، والصور القديمة على ImgBB تبقى زي ما هي
async function compressToDataUrl(file: File, folder: string): Promise<string> {
  const maxSide = FALLBACK_MAX_SIDE[folder.split('/')[0]] ?? 480
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('المتصفح ما يدعم معالجة الصور')
  ctx.fillStyle = '#fff'   // PNG شفاف → خلفية بيضاء بدل سوداء عند التحويل لـ JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= FALLBACK_MAX_BYTES) return url
  }
  throw new Error('الصورة كبيرة جداً — جرّب صورة أصغر')
}

async function uploadToImgbb(file: File, folder: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_IMGBB_KEY
  if (!apiKey) throw new Error('مفتاح ImgBB غير مُعدّ — أضف NEXT_PUBLIC_IMGBB_KEY بملف .env.local')

  const base64 = await fileToBase64(file)
  const form = new FormData()
  form.append('key', apiKey)
  form.append('image', base64)
  form.append('name', `${folder}_${Date.now()}`)

  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok || !data?.data?.url) throw new Error(data?.error?.message || 'فشل رفع الصورة')
  return data.data.url as string
}

// folder يُستخدم فقط كجزء من اسم الملف بـ ImgBB (لا مجلدات فعلية هناك)
export async function uploadImage(file: File, folder: string): Promise<string> {
  try {
    return await uploadToImgbb(file, folder)
  } catch (e) {
    console.warn('ImgBB upload failed, storing compressed image inline:', e)
    return compressToDataUrl(file, folder)
  }
}
