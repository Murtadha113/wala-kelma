import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Splash } from '@/components/splash'

export const metadata: Metadata = {
  title: 'ولا كلمة',
  description: 'لعبة التمثيل الصامت — مثّل بدون ما تنطق ولا كلمة',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#DA2342',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Splash />
        {children}
      </body>
    </html>
  )
}
