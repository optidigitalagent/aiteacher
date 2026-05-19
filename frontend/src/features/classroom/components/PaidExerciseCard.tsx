import type { ExerciseCursor, TextBlock, PromptCard, Statement } from '../services/classroomSocket'
import type { FeedbackState } from '../types'

interface Props {
  cursor:              ExerciseCursor
  feedback:            FeedbackState
  feedbackExplanation?: string | null
}

const TYPE_LABEL: Record<string, string> = {
  form_transformation:  'Transform',
  error_correction:     'Correct',
  reconstruction:       'Reconstruct',
  free_production:      'Produce',
  fill_gap:             'Fill in',
  grammar_transform:    'Transform',
  word_box:             'Word Box',
  reading:              'Reading',
  speaking_prompt:      'Speaking',
  vocabulary_matching:  'Match',
  matching:             'Match',
  grammar_focus_fill:   'Grammar Focus',
  grammar_drill:        'Grammar Drill',
  personal_fill:        'Your Turn',
  discussion:           'Discussion',
  pair_speaking:        'Speaking',
  fill_in_the_gap:      'Fill in',
  sentence_transformation: 'Transform',
}

function isMatchingExercise(exerciseType: string): boolean {
  return exerciseType === 'vocabulary_matching' || exerciseType === 'matching'
}

export default function PaidExerciseCard({ cursor, feedback, feedbackExplanation }: Props) {
  const {
    exerciseType, instruction, currentItem,
    itemIndex, itemTotal, completedItems, failedItems, wordBoxState, items, options,
    completionState, expectedInputMode, pendingTransition,
    readingText, textBlocks, promptCards, statements,
  } = cursor

  const isComplete = completionState === 'complete' || completionState === 'skipped'

  const typeLabel  = TYPE_LABEL[exerciseType] ?? exerciseType
  const itemsTotal = itemTotal > 0 ? itemTotal : (items?.length ?? 0)

  // Display items: prefer the explicit items array, fall back to itemTotal count
  const allItems = items && items.length > 0 ? items : null

  return (
    <div style={{
      background: 'white', borderRadius: 20,
      boxShadow: '0 4px 24px rgba(15,23,42,0.08)', maxWidth: 580, width: '100%',
      border: feedback === 'correct' ? '2px solid #22c55e'
            : feedback === 'wrong'   ? '2px solid #f59e0b'
            : '2px solid transparent',
      transition: 'border-color 0.25s',
      display: 'flex', flexDirection: 'column',
      maxHeight: '70vh', overflow: 'hidden',
    }}>
      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', padding: '22px 24px', flex: 1 }}>
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
          {itemsTotal > 0 && (
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
              Item {itemIndex + 1} of {itemsTotal}
            </span>
          )}
        </div>

        {/* Exercise instruction — prominent, readable */}
        {instruction && (
          <div style={{
            fontSize: 14, color: '#0F172A', fontWeight: 600, marginBottom: 16,
            lineHeight: 1.6,
            background: 'linear-gradient(135deg,#F8F7FF,#FFF8F4)',
            borderRadius: 12, padding: '12px 14px',
          }}>
            {instruction}
          </div>
        )}

        {/* Reading text — full passage (e.g. find_opposites Sarah's comment) */}
        {readingText && (
          <div style={{
            background: '#F8F9FA', borderRadius: 12, padding: '12px 14px', marginBottom: 14,
            fontSize: 13, color: '#334155', lineHeight: 1.7,
            border: '1px solid #E2E8F0',
            maxHeight: 180, overflowY: 'auto',
          }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Reading text
            </div>
            {readingText}
          </div>
        )}

        {/* Text blocks — structured article/comment blocks with optional speaker name */}
        {textBlocks && textBlocks.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Read the text
            </div>
            <div style={{
              maxHeight: 260, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 8,
              paddingRight: 2,
            }}>
              {textBlocks.map((block: TextBlock) => (
                <div key={block.id} style={{
                  background: '#F8F9FA', borderRadius: 10, padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                }}>
                  {(block.title || block.speaker) && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: '#6E7CFB',
                      marginBottom: 4, letterSpacing: '0.02em',
                    }}>
                      {block.speaker || block.title}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.65 }}>
                    {block.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt cards — for discussion and speaking exercises */}
        {promptCards && promptCards.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Discussion task
            </div>
            {promptCards.map((card: PromptCard) => (
              <div key={card.id} style={{
                background: 'linear-gradient(135deg,#F0F4FF,#F8F0FF)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                border: '1.5px solid rgba(110,124,251,0.2)',
              }}>
                <div style={{ fontSize: 14, color: '#3730a3', fontWeight: 600, lineHeight: 1.55 }}>
                  {card.prompt}
                </div>
                {card.helperText && (
                  <div style={{ fontSize: 12, color: '#6E7CFB', marginTop: 6, fontStyle: 'italic' }}>
                    {card.helperText}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Statements — for agree/disagree exercises */}
        {statements && statements.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Statements — agree or disagree?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {statements.map((s: Statement, i: number) => (
                <div key={s.id} style={{
                  padding: '8px 12px', borderRadius: 9, fontSize: 13,
                  background: 'rgba(110,124,251,0.05)',
                  color: '#475569',
                  border: '1px solid rgba(110,124,251,0.12)',
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 700, minWidth: 18, paddingTop: 1 }}>{i + 1}.</span>
                  <span style={{ lineHeight: 1.5 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Item progress dots */}
        {itemsTotal > 1 && (
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

        {/* Current item — highlighted and prominent */}
        <div style={{
          background: 'linear-gradient(135deg,#EEF0FF,#F3F0FF)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 14,
          fontSize: 16, color: '#3730a3', fontWeight: 700, lineHeight: 1.6,
          border: '1.5px solid rgba(110,124,251,0.25)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6E7CFB', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current item
          </span>
          {currentItem || '…'}
        </div>

        {/* All items list — full exercise context */}
        {allItems && allItems.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              All items
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {allItems.map((item, i) => {
                const done   = completedItems.includes(i)
                const failed = failedItems.includes(i)
                const active = i === itemIndex
                return (
                  <div key={i} style={{
                    padding: '7px 12px', borderRadius: 9, fontSize: 13,
                    background: active  ? 'rgba(110,124,251,0.10)'
                              : done    ? 'rgba(34,197,94,0.07)'
                              : failed  ? 'rgba(239,68,68,0.07)'
                              : 'transparent',
                    color: active  ? '#4338ca'
                         : done    ? '#15803d'
                         : failed  ? '#b91c1c'
                         : '#64748B',
                    fontWeight: active ? 700 : 400,
                    borderLeft: active  ? '3px solid #6E7CFB'
                               : done   ? '3px solid #22c55e'
                               : failed ? '3px solid #ef4444'
                               : '3px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {done && !failed && <span style={{ fontSize: 12, color: '#22c55e' }}>✓</span>}
                    {failed && <span style={{ fontSize: 12, color: '#ef4444' }}>✗</span>}
                    {!done && !failed && <span style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 700, minWidth: 16 }}>{i + 1}.</span>}
                    <span>{item}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Matching layout — two-column when exercise has both left column items and right column options */}
        {isMatchingExercise(exerciseType) && allItems && allItems.length > 0 && options && options.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Match these
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Questions</div>
                {allItems.map((item, i) => (
                  <div key={i} style={{
                    padding: '7px 10px', borderRadius: 9, fontSize: 13, marginBottom: 4,
                    background: i === itemIndex ? 'rgba(110,124,251,0.12)' : 'rgba(0,0,0,0.03)',
                    color: i === itemIndex ? '#4338ca' : '#475569',
                    fontWeight: i === itemIndex ? 700 : 400,
                    borderLeft: i === itemIndex ? '3px solid #6E7CFB' : '3px solid transparent',
                  }}>
                    {item}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Options</div>
                {options.map((opt, i) => (
                  <div key={i} style={{
                    padding: '7px 10px', borderRadius: 9, fontSize: 13, marginBottom: 4,
                    background: 'rgba(0,0,0,0.03)',
                    color: '#475569',
                  }}>
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Answer options word bank — for non-matching exercises with a word bank */}
        {!isMatchingExercise(exerciseType) && options && options.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Word bank
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {options.map((opt, i) => (
                <span key={i} style={{
                  padding: '5px 11px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'linear-gradient(135deg,#EEF0FF,#F3F0FF)',
                  color: '#6E7CFB',
                  border: '1.5px solid #C7CBF9',
                }}>
                  {opt}
                </span>
              ))}
            </div>
          </div>
        )}

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

        {/* Expected input mode hint — shown when engine specifies how the student should respond */}
        {expectedInputMode && expectedInputMode !== 'any' && !isComplete && (
          <div style={{
            marginTop: 10,
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: '#94A3B8', fontWeight: 600,
          }}>
            <span style={{ fontSize: 13 }}>
              {expectedInputMode === 'voice' ? '🎤' : expectedInputMode === 'choice' ? '☑' : '⌨'}
            </span>
            {expectedInputMode === 'voice' ? 'Respond by speaking'
              : expectedInputMode === 'choice' ? 'Select the correct option'
              : 'Type your answer below'}
          </div>
        )}

        {/* Pending transition indicator — backend signalling exercise/section boundary */}
        {pendingTransition && !isComplete && (
          <div style={{
            marginTop: 10, padding: '6px 12px', borderRadius: 8,
            background: 'rgba(110,124,251,0.08)',
            fontSize: 11, color: '#6E7CFB', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 10, height: 10, border: '2px solid rgba(110,124,251,0.3)', borderTopColor: '#6E7CFB', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            Moving to next exercise…
          </div>
        )}
      </div>

      {/* Exercise complete banner — backend cursor says exercise is done */}
      {isComplete && (
        <div style={{
          borderTop: '1px solid #F1F5F9',
          padding: '10px 24px',
          background: completionState === 'skipped' ? '#fffbeb' : '#f0fdf4',
          color:      completionState === 'skipped' ? '#b45309'  : '#16a34a',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 15 }}>{completionState === 'skipped' ? '→' : '✓'}</span>
          {completionState === 'skipped' ? 'Exercise skipped — moving on.' : 'Exercise complete!'}
        </div>
      )}

      {/* Feedback banner — outside scroll area so always visible; hidden when complete banner shown */}
      {feedback && !isComplete && (
        <div style={{
          borderTop: '1px solid #F1F5F9',
          padding: '10px 24px',
          background: feedback === 'correct' ? '#f0fdf4' : '#fffbeb',
          color:      feedback === 'correct' ? '#16a34a' : '#b45309',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: '0 0 20px 20px',
        }}>
          <span style={{ fontSize: 15 }}>{feedback === 'correct' ? '✓' : '→'}</span>
          {feedback === 'correct'
            ? 'Correct!'
            : (feedbackExplanation || 'Listen to the teacher.')}
        </div>
      )}
    </div>
  )
}
