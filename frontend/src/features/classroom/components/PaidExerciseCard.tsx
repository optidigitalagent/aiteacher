import type { ExerciseCursor } from '../services/classroomSocket'
import type { FeedbackState } from '../types'

interface Props {
  cursor:   ExerciseCursor
  feedback: FeedbackState
}

const TYPE_LABEL: Record<string, string> = {
  form_transformation: 'Transform',
  error_correction:    'Correct',
  reconstruction:      'Reconstruct',
  free_production:     'Produce',
  fill_gap:            'Fill in',
  grammar_transform:   'Transform',
  word_box:            'Word Box',
  reading:             'Reading',
  speaking_prompt:     'Speaking',
  vocabulary_matching: 'Vocabulary',
}

export default function PaidExerciseCard({ cursor, feedback }: Props) {
  const {
    exerciseType, instruction, currentItem,
    itemIndex, itemTotal, completedItems, failedItems, wordBoxState,
  } = cursor

  const typeLabel  = TYPE_LABEL[exerciseType] ?? exerciseType
  const itemsTotal = itemTotal > 0 ? itemTotal : undefined

  return (
    <div style={{
      background: 'white', borderRadius: 20, padding: '22px 24px',
      boxShadow: '0 4px 24px rgba(15,23,42,0.08)', maxWidth: 540, width: '100%',
      border: feedback === 'correct' ? '2px solid #22c55e'
            : feedback === 'wrong'   ? '2px solid #ef4444'
            : '2px solid transparent',
      transition: 'border-color 0.25s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: 'linear-gradient(135deg,#EEF0FF,#F3F0FF)',
            color: '#6E7CFB', borderRadius: 8, padding: '4px 10px',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            {typeLabel}
          </span>
          {cursor.exerciseNumber > 0 && (
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>
              Exercise {cursor.exerciseNumber}
            </span>
          )}
        </div>
        {itemsTotal !== undefined && (
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
            Item {itemIndex + 1} of {itemsTotal}
          </span>
        )}
      </div>

      {/* Exercise instruction */}
      {instruction && (
        <div style={{
          fontSize: 13, color: '#64748B', fontWeight: 500, marginBottom: 14,
          lineHeight: 1.55, fontStyle: 'italic',
        }}>
          {instruction}
        </div>
      )}

      {/* Item progress dots */}
      {itemsTotal !== undefined && itemsTotal > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {Array.from({ length: itemsTotal }, (_, i) => {
            const done   = completedItems.includes(i)
            const failed = failedItems.includes(i)
            const active = i === itemIndex
            return (
              <div key={i} style={{
                width: 28, height: 6, borderRadius: 3,
                background: done && !failed ? '#22c55e'
                          : failed          ? '#ef4444'
                          : active          ? '#6E7CFB'
                          : '#E6EAF2',
                transition: 'background 0.2s',
              }} />
            )
          })}
        </div>
      )}

      {/* Current item text */}
      <div style={{
        background: 'linear-gradient(135deg,#F8F7FF,#FFF8F4)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 14,
        fontSize: 15, color: '#0F172A', fontWeight: 600, lineHeight: 1.6,
      }}>
        {currentItem || '…'}
      </div>

      {/* Word box (vocabulary exercises) */}
      {wordBoxState && wordBoxState.available.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Word box
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {wordBoxState.available.map((word) => {
              const used = wordBoxState.used.includes(word)
              return (
                <span key={word} style={{
                  padding: '5px 11px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: used ? '#F1F5F9' : 'linear-gradient(135deg,#EEF0FF,#F3F0FF)',
                  color: used ? '#CBD5E1' : '#6E7CFB',
                  textDecoration: used ? 'line-through' : 'none',
                  border: used ? '1.5px solid #E6EAF2' : '1.5px solid #C7CBF9',
                  transition: 'all 0.15s',
                }}>
                  {word}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          marginTop: 14, borderRadius: 10, padding: '9px 14px',
          background: feedback === 'correct' ? '#f0fdf4' : '#fef2f2',
          color:      feedback === 'correct' ? '#16a34a' : '#dc2626',
          fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{feedback === 'correct' ? '✓' : '✗'}</span>
          {feedback === 'correct' ? 'Correct!' : 'Not quite — listen to the teacher.'}
        </div>
      )}
    </div>
  )
}
