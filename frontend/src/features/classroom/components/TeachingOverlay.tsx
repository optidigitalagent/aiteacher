import type { TeachingCardData } from '../types'
import { formatAIMessage } from '../utils/formatMessage'

interface Props {
  card:      TeachingCardData
  onDismiss: () => void
}

// TeachingOverlay renders in place of ExercisePanel when the student clicks
// "I don't understand" and the backend returns a teaching card.
//
// TODO: trigger flow:
//   1. Student clicks "I don't understand" → POST /api/lesson/explain { exerciseId, lessonStateId }
//   2. Backend returns: { explanationCard: TeachingCardData }
//   3. ClassroomLayout sets: teachingCard = explanationCard
//   4. This component renders; ExercisePanel hides
//   5. Student clicks "OK, I understand" → teachingCard = null → ExercisePanel returns
//
// teachingCard shape (from backend):
//   { title: string, body: string, ruleTable?: string[][], examples?: string[] }

export default function TeachingOverlay({ card, onDismiss }: Props) {
  return (
    <div className="cls-slide-up" style={{
      width: '100%', maxWidth: 720,
      background: 'rgba(255,255,255,0.95)', borderRadius: 24,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      padding: '36px 40px',
      boxShadow: '0 2px 0 rgba(255,255,255,1) inset, 0 20px 60px rgba(0,0,0,0.08)',
      border: '1px solid rgba(110,124,251,0.12)',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      {/* Badge */}
      <div>
        <span style={{
          background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
          color: '#92400e', fontSize: 12, fontWeight: 700,
          padding: '5px 14px', borderRadius: 99,
          border: '1px solid rgba(245,158,11,0.3)',
        }}>
          📖 Explanation
        </span>
      </div>

      {/* Title */}
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.35, letterSpacing: '-0.4px', margin: 0 }}>
        {card.title}
      </h2>

      {/* Body */}
      <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.7 }}>
        {formatAIMessage(card.body)}
      </div>

      {/* Rule table (optional) */}
      {card.ruleTable && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {card.ruleTable.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '8px 14px', fontSize: 14, fontWeight: ci === 0 ? 600 : 400,
                    color: ci === 0 ? '#1a1a2e' : '#555',
                    borderBottom: '1px solid rgba(110,124,251,0.08)',
                    background: ri % 2 === 0 ? 'rgba(110,124,251,0.03)' : 'transparent',
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Examples (optional) */}
      {card.examples && card.examples.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {card.examples.map((ex, i) => (
            <div key={i} style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(110,124,251,0.05)',
              border: '1px solid rgba(110,124,251,0.1)',
              fontSize: 15, color: '#333', fontStyle: 'italic',
            }}>
              {ex}
            </div>
          ))}
        </div>
      )}

      {/* Dismiss */}
      <button onClick={onDismiss} style={{
        alignSelf: 'flex-start', padding: '12px 32px', borderRadius: 14, border: 'none',
        background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)',
        color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        boxShadow: '0 8px 28px rgba(110,124,251,0.4)',
        transition: 'all 0.2s',
      }}>
        OK, I understand — continue
      </button>
    </div>
  )
}
