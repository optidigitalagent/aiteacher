import { useState, useEffect, useRef } from 'react'
import type { Exercise, FeedbackState } from '../types'
import { IcCheck, IcBulb } from './icons'

interface Props {
  question:      Exercise
  answer:        string
  feedback:      FeedbackState
  showHint:      boolean
  onCheck:       () => void
  onHintToggle:  () => void
}

export default function ExercisePanel({ question, answer, feedback, showHint, onCheck, onHintToggle }: Props) {
  const [shakeKey, setShakeKey] = useState(0)
  const prevFeedback = useRef<FeedbackState>(null)

  useEffect(() => {
    if (feedback === 'wrong' && prevFeedback.current !== 'wrong') {
      setShakeKey(k => k + 1)
    }
    prevFeedback.current = feedback
  }, [feedback])

  const parts = question.sentence.split('________')
  const blankColor =
    feedback === 'correct' ? '#22c55e' :
    feedback === 'wrong'   ? '#ef4444' :
                             '#6E7CFB'

  return (
    <div style={{
      width: '100%', maxWidth: 720,
      background: 'rgba(255,255,255,0.88)', borderRadius: 24,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      padding: '36px 40px',
      boxShadow: '0 2px 0 rgba(255,255,255,1) inset, 0 20px 60px rgba(0,0,0,0.08), 0 40px 80px rgba(110,124,251,0.1)',
      border: '1px solid rgba(255,255,255,0.7)',
      outline: '1px solid rgba(110,124,251,0.07)',
      display: 'flex', flexDirection: 'column', gap: 0,
      transition: 'transform 0.22s ease, box-shadow 0.22s ease',
      transform: 'translateY(-2px)',
    }}>
      {/* Exercise badge — TODO: index/total from backend session state */}
      <div style={{ marginBottom: 22 }}>
        <span style={{
          background: 'linear-gradient(135deg, #ede9ff, #f0f0ff)',
          color: '#6E7CFB', fontSize: 12, fontWeight: 700,
          padding: '5px 14px', borderRadius: 99,
          border: '1px solid rgba(110,124,251,0.2)',
        }}>
          Exercise {question.index} of {question.total}
        </span>
      </div>

      {/* Prompt */}
      <h2 style={{
        fontSize: 26, fontWeight: 700, color: '#1a1a2e',
        lineHeight: 1.35, marginBottom: 22, letterSpacing: '-0.4px',
      }}>
        {question.prompt}
      </h2>

      {/* Hint chip */}
      <div style={{ marginBottom: 30 }}>
        <button onClick={onHintToggle} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: showHint ? '#fef9ee' : '#fafafa',
          border: showHint ? '1px solid #fde68a' : '1px solid #e8e8e8',
          borderRadius: 99, padding: '6px 14px', cursor: 'pointer',
          color: showHint ? '#92400e' : '#666', fontSize: 12.5, fontWeight: 600,
          transition: 'all 0.2s',
        }}>
          <IcBulb s={13} c={showHint ? '#f59e0b' : '#aaa'} />
          {showHint ? question.hint : 'Show hint'}
        </button>
      </div>

      {/* Sentence with blank — shake animation on wrong */}
      <div
        key={shakeKey}
        className={shakeKey > 0 ? 'cls-shake' : ''}
        style={{
          fontSize: 20, fontWeight: 600, color: '#1a1a2e',
          lineHeight: 1.7, marginBottom: 28,
          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 6px',
        }}
      >
        <span>{parts[0]}</span>
        <span style={{
          display: 'inline-block', minWidth: 140, textAlign: 'center',
          borderBottom: `2.5px solid ${blankColor}`,
          paddingBottom: 2, color: blankColor,
          fontSize: 20, fontStyle: answer ? 'normal' : 'italic', fontWeight: 700,
          transition: 'color 0.2s, border-color 0.2s',
        }}>
          {answer || '         '}
        </span>
        <span>{parts[1]}</span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="cls-slide-up" style={{
          fontSize: 13.5, fontWeight: 700, marginBottom: 16,
          color: feedback === 'correct' ? '#22c55e' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {feedback === 'correct'
            ? <><IcCheck s={14} c="#22c55e" /> Correct! The answer is &ldquo;{question.answer}&rdquo;.</>
            : '✕ Not quite — try again or ask Sophie.'
          }
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* TODO: onCheck sends answer to backend via POST /api/lesson/input */}
        <button onClick={onCheck} disabled={!answer.trim()} style={{
          padding: '14px 40px', borderRadius: 14, border: 'none',
          background: !answer.trim()
            ? '#f0f0f0'
            : 'linear-gradient(135deg, #6E7CFB 0%, #9B8CFF 60%, #FFB86B 100%)',
          color: !answer.trim() ? '#bbb' : 'white',
          fontWeight: 700, fontSize: 15, cursor: answer.trim() ? 'pointer' : 'not-allowed',
          boxShadow: answer.trim() ? '0 8px 28px rgba(110,124,251,0.4), 0 2px 0 rgba(255,255,255,0.3) inset' : 'none',
          transition: 'all 0.2s', letterSpacing: '-0.2px',
        }}>
          Check answer
        </button>
        <button onClick={onHintToggle} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', color: '#888', fontSize: 13.5, fontWeight: 600,
          padding: '10px', borderRadius: 10, transition: 'color 0.15s',
        }}>
          <IcBulb s={14} c="#f59e0b" /> Need a hint?
        </button>
      </div>
    </div>
  )
}
