import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IcChev, IcExit } from './icons'
import type { LessonSessionMetadata } from '../../../types/lessonTypes'

interface ClassroomHeaderProps {
  meta?: LessonSessionMetadata | null
}

export default function ClassroomHeader({ meta }: ClassroomHeaderProps) {
  const navigate = useNavigate()
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const sectionLabel = meta?.sectionNumber ? `Section ${meta.sectionNumber}` : 'Lesson'
  const topicLabel   = meta?.sectionTopic ?? meta?.sectionTitle ?? 'English'
  const teacherName  = meta?.teacherName ?? 'Alex'

  return (
    <>
      <div style={{
        height: 56,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(255,255,255,0.45)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', padding: '0 32px',
        flexShrink: 0, position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 260, flexShrink: 0 }}>
          <div style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 11, color: 'white', letterSpacing: '-0.5px',
            boxShadow: '0 3px 10px rgba(110,124,251,0.4)',
          }}>Ai</div>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
            AI Teacher
          </span>
        </div>

        {/* Section title — from session metadata */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 700 }}>{sectionLabel}</span>
          <span style={{ fontSize: 14, color: '#c5c5d5', fontWeight: 400 }}>•</span>
          <span style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 700 }}>{topicLabel}</span>
        </div>

        {/* Right: teacher chip + exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 260, justifyContent: 'flex-end' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 12px', borderRadius: 10, background: '#f5f5f7',
            border: '1px solid #ebebf0',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, color: 'white',
            }}>{teacherName[0].toUpperCase()}</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{teacherName}</span>
            <IcChev />
          </div>
          <button
            onClick={() => setShowExitConfirm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none',
              border: '1.5px solid #e8e8f0', borderRadius: 9, padding: '6px 13px',
              cursor: 'pointer', color: '#888', fontSize: 13, fontWeight: 600,
            }}
          >
            <IcExit /> Exit
          </button>
        </div>
      </div>

      {/* Exit confirmation */}
      {showExitConfirm && (
        <div
          onClick={() => setShowExitConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 20, padding: '32px 28px',
              maxWidth: 400, width: '100%',
              boxShadow: '0 32px 64px rgba(15,23,42,0.2)',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 10 }}>🚪</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
              Leave the lesson?
            </div>
            <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 24 }}>
              If you leave before finishing, unsaved lesson progress may be lost.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  padding: '10px 20px', borderRadius: 12, border: '1.5px solid #E6EAF2',
                  background: 'white', color: '#0F172A', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Stay in lesson
              </button>
              <button
                onClick={() => navigate('/')}
                style={{
                  padding: '10px 20px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                  color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Leave lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
