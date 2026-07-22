// رفع الصور إلى ImgBB — مجاني بدون بطاقة ائتمان (Firebase Storage الجديد يتطلب خطة Blaze المدفوعة)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// folder يُستخدم فقط كجزء من اسم الملف بـ ImgBB (لا مجلدات فعلية هناك)
export async function uploadImage(file: File, folder: string): Promise<string> {
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
