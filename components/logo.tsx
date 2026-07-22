import Image from 'next/image'

// نسبة العرض:الارتفاع الفعلية لملف public/logo.png (800×632)
const ASPECT = 800 / 632

export function Logo({ height = 64, priority = false }: { height?: number; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="ولا كلمة"
      width={Math.round(height * ASPECT)}
      height={height}
      priority={priority}
      style={{ height, width: 'auto' }}
    />
  )
}
