import { useEffect } from 'react'
import type { TipRecord } from '../services/classroomSocket'

const CATEGORY_META: Record<string, { bg: string; text: string; border: string; label: string }> = {
  VOCAB:            { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE', label: 'Vocabulary' },
  PHRASE:           { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', label: 'Phrase' },
  GRAMMAR:          { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: 'Grammar' },
  PRONUNCIATION:    { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF', label: 'Pronunciation' },
  COMMON_MISTAKE:   { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', label: 'Common Mistake' },
}

export default function TipsDrawer({
  tips,
  onClose,
}: {
  tips:    TipRecord[]
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const grouped = tips.reduce<Record<string, TipRecord[]>>((acc, tip) => {
    acc[tip.category] ??= []
    acc[tip.category]!.push(tip)
    return acc
  }, {})

  const categoryOrder = ['GRAMMAR', 'COMMON_MISTAKE', 'VOCAB', 'PHRASE', 'PRONUNCIATION']
  const orderedKeys   = [
    ...categoryOrder.filter(k => grouped[k]),
    ...Object.keys(grouped).filter(k => !categoryOrder.includes(k)),
  ]

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 150,
      width: 320, maxWidth: '90vw',
      background: 'white',
      boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px 14px',
        borderBottom: '1px solid #F1F5F9',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>
            My Learning Notes
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
            {tips.length} tip{tips.length !== 1 ? 's' : ''} from your lessons
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: 10, border: 'none',
            background: '#F1F5F9', color: '#64748B',
            fontSize: 17, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-label="Close tips"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tips.length === 0 ? (
          <div style={{
            textAlign: 'center', color: '#94A3B8', fontSize: 13,
            marginTop: 48, lineHeight: 1.6, padding: '0 16px',
          }}>
            No tips yet — they appear as you make progress in your lessons.
          </div>
        ) : (
          orderedKeys.map(category => {
            const meta  = CATEGORY_META[category] ?? { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0', label: category }
            const items = grouped[category] ?? []
            return (
              <div key={category}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: meta.bg, color: meta.text,
                  border: `1px solid ${meta.border}`,
                  borderRadius: 99, padding: '3px 10px',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
                  textTransform: 'uppercase', marginBottom: 8,
                }}>
                  {meta.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(tip => (
                    <TipCard key={tip.id} tip={tip} meta={meta} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function TipCard({ tip, meta }: { tip: TipRecord; meta: { bg: string; text: string; border: string } }) {
  return (
    <div style={{
      background: '#FAFBFC',
      border: '1px solid #F1F5F9',
      borderLeft: `3px solid ${meta.border}`,
      borderRadius: '0 10px 10px 0',
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 3, lineHeight: 1.3 }}>
        {tip.title}
      </div>
      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.55 }}>
        {tip.explanation}
      </div>
      {tip.example && (
        <div style={{
          fontSize: 12, color: meta.text, fontStyle: 'italic',
          marginTop: 6, paddingTop: 6, borderTop: '1px solid #F1F5F9',
          lineHeight: 1.45,
        }}>
          e.g. &ldquo;{tip.example}&rdquo;
        </div>
      )}
    </div>
  )
}
