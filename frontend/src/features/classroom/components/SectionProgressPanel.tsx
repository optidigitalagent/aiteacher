import type { LessonStep } from '../types'
import { IcCheck, ChatIcon } from './icons'

interface Props {
  steps:              LessonStep[]
  progress:           number
  chatOpen:           boolean
  onOpenChat:         () => void
  onCloseChat:        () => void
  sectionNumber?:     string
  sectionTopic?:      string
  exerciseCount?:     number
  currentExerciseNum?: number
}

export default function SectionProgressPanel({
  steps, progress, chatOpen, onOpenChat, onCloseChat,
  sectionNumber, sectionTopic, exerciseCount, currentExerciseNum,
}: Props) {
  const doneCount = steps.filter(s => s.status === 'done').length
  const donePct   = ((doneCount / steps.length) * 100).toFixed()

  const sectionLabel = sectionNumber ? `Section ${sectionNumber}` : 'Lesson'
  const topicLabel   = sectionTopic ?? 'English lesson'
  const totalEx      = exerciseCount ?? steps.length
  const doneEx       = steps.filter(s => s.status === 'done').length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20,
      boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 10px 30px rgba(0,0,0,0.06)',
      border: '1px solid rgba(255,255,255,0.7)',
      overflow: 'hidden', height: '100%', minHeight: 0,
      padding: '20px 16px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
        {sectionLabel}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.3px', marginBottom: 6, lineHeight: 1.25 }}>
        {topicLabel}
      </div>
      {exerciseCount !== undefined && (
        <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, marginBottom: currentExerciseNum ? 4 : 14 }}>
          {doneEx} / {totalEx} exercises
        </div>
      )}
      {currentExerciseNum !== undefined && currentExerciseNum > 0 && (
        <div style={{
          fontSize: 11, fontWeight: 700, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            background: 'rgba(110,124,251,0.12)',
            color: '#6E7CFB', borderRadius: 99,
            padding: '2px 9px', fontSize: 10.5, fontWeight: 800,
          }}>
            Exercise {currentExerciseNum}
          </span>
          <span style={{ color: '#aaa', fontSize: 10.5 }}>active</span>
        </div>
      )}

      {/* Timeline — TODO: steps driven by backend:
          completedExercises, activeExercise, nextExercise arrays
          Shape: [{ id, label, type: 'exercise'|'grammar'|'speaking', status, exerciseId? }] */}
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto' }}>
        <div style={{
          position: 'absolute', left: 11, top: 12, bottom: 12,
          width: 1.5, borderRadius: 99,
          background: `linear-gradient(to bottom, #22c55e ${donePct}%, #e8e8f0 ${donePct}%)`,
          zIndex: 0,
        }} />
        {steps.map((step, i) => {
          const done   = step.status === 'done'
          const active = step.status === 'active'
          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 8px 7px 0', position: 'relative', zIndex: 1,
              borderRadius: 9,
              background: active ? 'rgba(110,124,251,0.07)' : 'transparent',
              marginBottom: 2,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done   ? 'linear-gradient(135deg,#4ade80,#22c55e)' :
                            active ? 'linear-gradient(135deg,#6E7CFB,#9B8CFF)'  : 'white',
                border: !done && !active ? '1.5px solid #e0e0e8' : 'none',
                boxShadow: done   ? '0 2px 8px rgba(34,197,94,0.3)'    :
                           active ? '0 2px 8px rgba(110,124,251,0.35)' : 'none',
              }}>
                {done
                  ? <IcCheck s={10} c="white" />
                  : <span style={{ fontSize: 9, fontWeight: 700, color: active ? 'white' : '#bbb' }}>{i + 1}</span>
                }
              </div>
              <span style={{
                fontSize: 12.5,
                fontWeight: active ? 700 : done ? 500 : 400,
                color: active ? '#6E7CFB' : done ? '#666' : '#aaa',
                lineHeight: 1.2,
              }}>
                {step.label}
              </span>
              {active && (
                <div style={{
                  marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: '#6E7CFB', boxShadow: '0 0 6px rgba(110,124,251,0.7)',
                  animation: 'cls-halo-breathe 1.5s ease-in-out infinite',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar — TODO: progressPercent from backend session */}
      <div style={{ marginTop: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: '#888', fontWeight: 600 }}>Your progress</span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1a1a2e' }}>{progress}%</span>
        </div>
        <div style={{ height: 5, background: '#ede9ff', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg,#6E7CFB,#9B8CFF)', borderRadius: 99,
            boxShadow: '0 2px 6px rgba(110,124,251,0.4)', transition: 'width 0.8s ease',
          }} />
        </div>
      </div>

      {/* Chat toggle */}
      {!chatOpen ? (
        <button onClick={onOpenChat} style={{
          marginTop: 14, width: '100%', padding: '9px', borderRadius: 11,
          border: '1.5px solid rgba(110,124,251,0.2)', background: 'rgba(110,124,251,0.05)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          color: '#6E7CFB', fontSize: 12.5, fontWeight: 700, transition: 'all 0.2s',
          flexShrink: 0,
        }}>
          <ChatIcon s={13} c="#6E7CFB" /> Open Chat
        </button>
      ) : (
        <button onClick={onCloseChat} style={{
          marginTop: 14, width: '100%', padding: '8px 10px', borderRadius: 11,
          border: '1.5px solid rgba(110,124,251,0.15)', background: 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          color: '#aaa', fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
          flexShrink: 0,
        }}>
          <ChatIcon s={12} c="#bbb" /> Hide chat
        </button>
      )}
    </div>
  )
}
