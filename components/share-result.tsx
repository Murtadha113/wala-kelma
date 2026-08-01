'use client'

// زر "شارك النتيجة" — يولّد بطاقة صورة من عنصر مخفي بالـ DOM (html-to-image) ويعرض واتساب/تحميل/نسخ رابط
import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { WalaKelmaRoom, TeamId, getBestActor } from '@/lib/wala-kelma'
import { WK_COLORS } from '@/lib/wala-kelma-content'

const C = WK_COLORS

export function ShareResultButton({ room, refUid }: { room: WalaKelmaRoom; refUid?: string }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)

  const win = room.winner
  const bestActor = getBestActor(room)
  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/${refUid ? `?ref=${refUid}` : ''}`
    : ''

  const generate = async () => {
    if (!cardRef.current) return
    setBusy(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      setImgUrl(dataUrl)
    } catch (e) {
      console.error('generate share image failed:', e)
    }
    setBusy(false)
  }

  const download = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = `wala-kelma-${room.code}.png`
    a.click()
  }

  const shareWhatsapp = () => {
    const text = win === 'draw'
      ? `تعادلنا بلعبة ولا كلمة! 🎭 جرّبها: ${shareLink}`
      : `فاز ${room.teams[win as TeamId].name} بلعبة ولا كلمة! 🎭 جرّبها: ${shareLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const copyLink = () => { navigator.clipboard?.writeText(shareLink) }

  return (
    <div style={{ width: '100%' }}>
      {/* البطاقة المخفية المُصدَّرة كصورة */}
      <div style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none' }}>
        <div ref={cardRef} style={{
          width: 540, height: 960, background: `linear-gradient(160deg, ${C.cream}, #fff)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
          fontFamily: 'Alexandria, sans-serif', padding: 40, direction: 'rtl', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: C.red }}>ولا كلمة 🎭</div>
          <div style={{ fontSize: 70 }}>🏆</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: win === 'A' ? C.violet : win === 'B' ? C.red : C.ink }}>
            {win === 'draw' ? 'تعادل!' : `فاز ${room.teams[win as TeamId].name}`}
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {(['A', 'B'] as TeamId[]).map(id => (
              <div key={id} style={{ background: '#fff', borderRadius: 20, padding: '20px 28px', border: `2px solid ${id === 'A' ? C.violet : C.red}22` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>{room.teams[id].name}</div>
                <div style={{ fontSize: 48, fontWeight: 900, color: id === 'A' ? C.violet : C.red }}>{room.teams[id].score}</div>
              </div>
            ))}
          </div>
          {bestActor && (
            <div style={{ background: `${C.orange}18`, borderRadius: 16, padding: '12px 24px' }}>
              <div style={{ fontSize: 14, color: `${C.ink}88`, fontWeight: 700 }}>🎭 أفضل ممثل</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.orange }}>{bestActor.playerName}</div>
            </div>
          )}
          <div style={{ fontSize: 13, color: `${C.ink}66`, marginTop: 10 }}>{room.matchName || 'مباراة ولا كلمة'} · {new Date().toLocaleDateString('ar')}</div>
        </div>
      </div>

      {!imgUrl ? (
        <button onClick={generate} disabled={busy} style={{
          width: '100%', maxWidth: 360, padding: '12px 10px', borderRadius: 12, border: `1.5px solid ${C.violet}55`, background: `${C.violet}0d`,
          color: C.violet, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          {busy ? 'جاري التجهيز…' : 'شارك النتيجة'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <img src={imgUrl} alt="بطاقة النتيجة" style={{ width: '100%', borderRadius: 16, border: `1px solid ${C.ink}12` }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={shareWhatsapp} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#25D366', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>واتساب</button>
            <button onClick={download} style={{ flex: 1, padding: 11, borderRadius: 10, border: `1.5px solid ${C.ink}22`, background: 'transparent', color: `${C.ink}cc`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>تحميل</button>
            <button onClick={copyLink} style={{ flex: 1, padding: 11, borderRadius: 10, border: `1.5px solid ${C.ink}22`, background: 'transparent', color: `${C.ink}cc`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>نسخ رابط</button>
          </div>
        </div>
      )}
    </div>
  )
}
