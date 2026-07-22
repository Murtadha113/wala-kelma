// عناصر واجهة مشتركة للوحة الأدمن (كل تبويبات app/admin/*)
import { WK_COLORS } from '@/lib/wala-kelma-content'

export const C = WK_COLORS

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${C.ink}12`, boxShadow: `0 8px 22px ${C.ink}0a`, ...style }}>{children}</div>
}
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: 13, fontWeight: 900, color: `${C.ink}88`, marginBottom: 8, ...style }}>{children}</p>
}
export function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: `${C.ink}88`, lineHeight: 1.7 }}>{children}</p>
}
export const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.ink}20`, fontSize: 14, color: C.ink, background: C.cream, outline: 'none', marginBottom: 8, fontFamily: 'inherit' }
export const primaryBtn: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, cursor: 'pointer', boxShadow: `0 8px 20px ${C.red}2c` }
export const ghostBtn: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${C.ink}22`, background: 'transparent', color: `${C.ink}cc`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
