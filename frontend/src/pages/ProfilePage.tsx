import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileStats {
  lessonsCompleted:    number
  learningTimeMinutes: number
  currentStreakDays:   number
  testsCompleted:      number
  averageAccuracy:     number | null
}

interface ProfileData {
  profile: {
    displayName:    string | null
    avatarEmoji:    string | null
    level:          string
    rank:           string
    xp:             number
    lessonsCompleted: number
    subscriptionStatus: string
  }
  stats:           ProfileStats
  learningHistory: unknown[]
  completedTests:  unknown[]
  achievements:    unknown[]
  insights:        unknown[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_AVATARS = ['🙂', '😎', '🦊', '🐼', '🐧', '🚀', '🌟', '🎓']

const RANK_LADDER = [
  { rank: 'New Learner',         xpStart: 0,    xpEnd: 100  },
  { rank: 'Active Learner',      xpStart: 100,  xpEnd: 300  },
  { rank: 'Confident Learner',   xpStart: 300,  xpEnd: 700  },
  { rank: 'Strong Communicator', xpStart: 700,  xpEnd: 1500 },
  { rank: 'Expert',              xpStart: 1500, xpEnd: 3000 },
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:         { background: '#FFFFFF', minHeight: '100vh', color: '#0F172A' },
  main:         { maxWidth: 1200, margin: '0 auto', padding: '40px 40px 80px' },
  card:         { background: '#FFFFFF', border: '1px solid #F0EEF8', borderRadius: 20, padding: 28, boxShadow: '0 2px 16px rgba(123,140,255,0.06)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: '#A18BFF', marginBottom: 6 },
  sectionTitle: { fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 20, letterSpacing: '-0.3px' },
  btnPrimary:   { background: 'linear-gradient(135deg, #7B8CFF 0%, #FFB38C 100%)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap' as const },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(minutes: number): string {
  if (minutes === 0) return '0h'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function getRankProgress(xp: number) {
  const tier = RANK_LADDER.find(r => xp >= r.xpStart && xp < r.xpEnd)
    ?? RANK_LADDER[RANK_LADDER.length - 1]!
  const next = RANK_LADDER[RANK_LADDER.indexOf(tier) + 1]
  const progress = next
    ? Math.round(((xp - tier.xpStart) / (tier.xpEnd - tier.xpStart)) * 100)
    : 100
  return { currentRank: tier.rank, nextRank: next?.rank ?? null, progress }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedProgressBar({ value, color = 'linear-gradient(90deg, #7B8CFF, #A18BFF)', height = 8 }: { value: number; color?: string; height?: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 300)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div style={{ background: '#F0EEF8', borderRadius: 999, height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 999, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  )
}

function MiniLineChart({ data, labels }: { data: number[]; labels: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const pad = { top: 12, right: 12, bottom: 24, left: 28 }
    const chartW = W - pad.left - pad.right
    const chartH = H - pad.top - pad.bottom
    const min = Math.min(...data) - 5
    const max = Math.max(...data) + 5
    ctx.clearRect(0, 0, W, H)
    const xStep = chartW / (data.length - 1)
    const yScale = (v: number) => pad.top + chartH - ((v - min) / (max - min)) * chartH
    const xAt = (i: number) => pad.left + i * xStep
    ctx.strokeStyle = '#F0EEF8'; ctx.lineWidth = 1
    ;[0.25, 0.5, 0.75, 1].forEach(t => {
      const y = pad.top + chartH * (1 - t)
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke()
    })
    const grad = ctx.createLinearGradient(0, pad.top, 0, H)
    grad.addColorStop(0, 'rgba(123,140,255,0.15)'); grad.addColorStop(1, 'rgba(123,140,255,0)')
    ctx.beginPath(); ctx.moveTo(xAt(0), yScale(data[0]))
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(xAt(i), yScale(v)) })
    ctx.lineTo(xAt(data.length - 1), pad.top + chartH); ctx.lineTo(xAt(0), pad.top + chartH)
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
    const lineGrad = ctx.createLinearGradient(pad.left, 0, pad.left + chartW, 0)
    lineGrad.addColorStop(0, '#7B8CFF'); lineGrad.addColorStop(1, '#FFB38C')
    ctx.beginPath(); ctx.moveTo(xAt(0), yScale(data[0]))
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(xAt(i), yScale(v)) })
    ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke()
    data.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(xAt(i), yScale(v), 3.5, 0, Math.PI * 2)
      ctx.fillStyle = i === data.length - 1 ? '#FFB38C' : '#7B8CFF'; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
    })
    ctx.fillStyle = '#94A3B8'; ctx.font = '10px DM Sans, sans-serif'; ctx.textAlign = 'center'
    labels.forEach((l, i) => ctx.fillText(l, xAt(i), H - 6))
  }, [data, labels])
  return <canvas ref={canvasRef} width={520} height={140} style={{ width: '100%', height: 140 }} />
}

function StatCard({ icon, value, label, trend, accent = '#7B8CFF' }: { icon: string; value: string | number; label: string; trend?: string; accent?: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ ...S.card, padding: '22px 24px', transform: hovered ? 'translateY(-4px)' : 'none', boxShadow: hovered ? '0 8px 24px rgba(123,140,255,0.12)' : '0 2px 16px rgba(123,140,255,0.06)' }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 16 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {trend && <div style={{ fontSize: 11, color: accent, marginTop: 6, fontWeight: 600 }}>{trend}</div>}
    </div>
  )
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

interface EditProfileModalProps {
  initialName:  string
  initialEmoji: string | null
  token:        string
  onClose:      () => void
  onSaved:      () => void
}

function EditProfileModal({ initialName, initialEmoji, token, onClose, onSaved }: EditProfileModalProps) {
  const [name,    setName]    = useState(initialName)
  const [emoji,   setEmoji]   = useState(initialEmoji ?? '')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 50) {
      setError('Name must be 2–50 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const body: Record<string, string> = { displayName: trimmed }
      if (emoji) body.avatarEmoji = emoji

      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Save failed. Try again.')
        return
      }
      onSaved()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', width: 420, boxShadow: '0 24px 64px rgba(15,23,42,0.18)', border: '1px solid #F0EEF8' }}
      >
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 24 }}>Edit profile</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Display name</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={50}
            placeholder="Your name"
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #E6EAF2', borderRadius: 12, padding: '11px 14px',
              fontSize: 15, color: '#0F172A', outline: 'none',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'border-color 150ms',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#7B8CFF')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E6EAF2')}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Choose avatar</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ALLOWED_AVATARS.map(av => (
              <button
                key={av}
                onClick={() => setEmoji(av === emoji ? '' : av)}
                style={{
                  width: 44, height: 44, borderRadius: 12, fontSize: 22,
                  border: emoji === av ? '2.5px solid #7B8CFF' : '1.5px solid #E6EAF2',
                  background: emoji === av ? 'rgba(123,140,255,0.08)' : '#FAFAFA',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                }}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: '#DC2626', background: 'rgba(220,38,38,0.06)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #E6EAF2', background: 'none', color: '#64748B', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{ ...S.btnPrimary, flex: 1, padding: '11px 0', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Profile Hero ─────────────────────────────────────────────────────────────

function ProfileHero({
  displayName, avatarEmoji, avatarUrl, rank, level,
  onEdit,
}: {
  displayName: string; avatarEmoji: string | null; avatarUrl: string | null
  rank: string; level: string; onEdit: () => void
}) {
  const navigate = useNavigate()
  const [hoverBtn, setHoverBtn] = useState(false)

  const avatarContent = avatarEmoji
    ? <span style={{ fontSize: 36, lineHeight: 1 }}>{avatarEmoji}</span>
    : avatarUrl
      ? <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
      : <span style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{displayName.charAt(0).toUpperCase()}</span>

  return (
    <div style={{ ...S.card, background: 'linear-gradient(135deg,#FAFBFF 0%,#FFF8F4 100%)', border: '1px solid #EEE9FF', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#7B8CFF 0%,#A18BFF 60%,#FFB38C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 24px rgba(123,140,255,0.3)' }}>
          {avatarContent}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 28, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>{displayName}</h1>
            <span style={{ background: 'linear-gradient(135deg,#7B8CFF18,#A18BFF18)', color: '#7B8CFF', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(123,140,255,0.2)' }}>{level}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#A18BFF', marginBottom: 10 }}>✦ {rank}</div>
          <button
            onClick={onEdit}
            style={{ fontSize: 13, color: '#7B8CFF', background: 'rgba(123,140,255,0.08)', border: '1px solid rgba(123,140,255,0.2)', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, transition: 'all 150ms' }}
          >
            Edit profile
          </button>
        </div>
      </div>
      <button
        onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
        onClick={() => navigate('/learning')}
        style={{ ...S.btnPrimary, padding: '13px 28px', fontSize: 15, borderRadius: 14, transform: hoverBtn ? 'scale(1.02)' : 'scale(1)', boxShadow: hoverBtn ? '0 6px 24px rgba(123,140,255,0.35)' : '0 2px 12px rgba(123,140,255,0.2)' }}
      >
        ◎ Continue learning →
      </button>
    </div>
  )
}

// ─── Stats Grid ───────────────────────────────────────────────────────────────

function StatsGrid({ stats }: { stats: ProfileStats }) {
  const accuracyDisplay = stats.averageAccuracy !== null
    ? `${Math.round(stats.averageAccuracy)}%`
    : '—'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 24 }}>
      <StatCard icon="📚" value={stats.lessonsCompleted} label="Lessons completed" accent="#7B8CFF" />
      <StatCard icon="⏱" value={formatTime(stats.learningTimeMinutes)} label="Learning time" accent="#A18BFF" />
      <StatCard icon="🔥" value={stats.currentStreakDays === 0 ? '0d' : `${stats.currentStreakDays}d`} label="Current streak" accent="#FFB38C" />
      <StatCard icon="✅" value={stats.testsCompleted} label="Tests completed" accent="#7B8CFF" />
      <StatCard icon="🎯" value={accuracyDisplay} label="Avg. accuracy" accent="#FFB38C" />
    </div>
  )
}

// ─── Productivity Card ────────────────────────────────────────────────────────

function ProductivityCard({ stats }: { stats: ProfileStats }) {
  const [hovered, setHovered] = useState(false)
  const hasData = stats.lessonsCompleted > 0

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ ...S.card, transform: hovered ? 'translateY(-4px)' : 'none', boxShadow: hovered ? '0 8px 24px rgba(123,140,255,0.12)' : '0 2px 16px rgba(123,140,255,0.06)' }}>
      <div style={S.sectionLabel}>Productivity</div>
      {hasData ? (
        <>
          <MiniLineChart data={[0, 0, 0, 0, 0, 0, stats.lessonsCompleted]} labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} />
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'linear-gradient(135deg,rgba(123,140,255,0.06),rgba(161,139,255,0.06))', borderRadius: 12, border: '1px solid rgba(123,140,255,0.1)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A18BFF', letterSpacing: '0.8px', marginBottom: 4 }}>AI INSIGHT</div>
            <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.6 }}>Complete more lessons to unlock AI-powered productivity insights.</p>
          </div>
        </>
      ) : (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No activity yet</div>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>Complete your first lesson to see your learning progress and AI insights here.</p>
        </div>
      )}
    </div>
  )
}

// ─── Rank Progress Card ───────────────────────────────────────────────────────

function RankProgressCard({ xp, rank }: { xp: number; rank: string }) {
  const [hovered, setHovered] = useState(false)
  const { currentRank, nextRank, progress } = getRankProgress(xp)
  const displayRank = rank ?? currentRank
  const ranks = RANK_LADDER.map(r => r.rank)
  const currentIdx = ranks.indexOf(displayRank)

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ ...S.card, transform: hovered ? 'translateY(-4px)' : 'none', boxShadow: hovered ? '0 8px 24px rgba(123,140,255,0.12)' : '0 2px 16px rgba(123,140,255,0.06)' }}>
      <div style={S.sectionLabel}>Level Progression</div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>Current rank</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#7B8CFF' }}>✦ {displayRank}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>Next rank</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{nextRank ?? '—'}</div>
          </div>
        </div>
        <AnimatedProgressBar value={progress} height={10} color="linear-gradient(90deg,#7B8CFF,#A18BFF,#FFB38C)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 12, color: '#7B8CFF', fontWeight: 600 }}>{xp} XP</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{progress}% to next rank</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {ranks.map((r, i) => (
          <div key={r} style={{ flex: 1, height: 6, borderRadius: 999, background: i < currentIdx ? '#7B8CFF' : i === currentIdx ? 'linear-gradient(90deg,#7B8CFF,#A18BFF)' : '#F0EEF8' }} />
        ))}
      </div>
      <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg,rgba(255,179,140,0.08),rgba(161,139,255,0.06))', borderRadius: 12, border: '1px solid rgba(255,179,140,0.15)' }}>
        <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.6 }}>
          {xp === 0
            ? 'Complete your first AI lesson to start earning XP and climbing the ranks.'
            : `You have ${xp} XP. Keep learning to reach ${nextRank ?? 'the top'}!`}
        </p>
      </div>
    </div>
  )
}

// ─── Lesson History Card ──────────────────────────────────────────────────────

function LessonHistoryCard({ history }: { history: unknown[] }) {
  return (
    <div style={{ ...S.card, marginBottom: 24 }}>
      <div style={S.sectionLabel}>Recent Activity</div>
      <h2 style={{ ...S.sectionTitle, marginBottom: 16 }}>Learning History</h2>
      {history.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No lessons completed yet</div>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>Start your first AI lesson to build your learning history.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* future: render history items */}
        </div>
      )}
    </div>
  )
}

// ─── Tests Card ───────────────────────────────────────────────────────────────

function TestsCard({ tests }: { tests: unknown[] }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ ...S.card, transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? '0 8px 24px rgba(123,140,255,0.1)' : '0 2px 16px rgba(123,140,255,0.06)' }}>
      <div style={S.sectionLabel}>Exams & Quizzes</div>
      <h2 style={S.sectionTitle}>Tests Completed</h2>
      {tests.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No tests completed yet</div>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>Review tests will appear here after you complete Focus Review sections.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* future: render test items */}
        </div>
      )}
    </div>
  )
}

// ─── Achievements Card ────────────────────────────────────────────────────────

function AchievementsCard({ achievements }: { achievements: unknown[] }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ ...S.card, transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? '0 8px 24px rgba(123,140,255,0.1)' : '0 2px 16px rgba(123,140,255,0.06)' }}>
      <div style={S.sectionLabel}>Milestones</div>
      <h2 style={S.sectionTitle}>Achievements</h2>
      {achievements.length === 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#FAFAFA', borderRadius: 14, border: '1px solid #F0EEF8', opacity: 0.6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(161,139,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏆</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>First AI Lesson</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Complete your first lesson to unlock this achievement.</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>🔒</div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* future: render achievement items */}
        </div>
      )}
    </div>
  )
}

// ─── AI Recommendations Card ──────────────────────────────────────────────────

function AIInsightsCard({ insights, lessonsCompleted }: { insights: unknown[]; lessonsCompleted: number }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [hoverBtn, setHoverBtn] = useState(false)
  const hasInsights = insights.length > 0 || lessonsCompleted > 0

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ ...S.card, background: 'linear-gradient(135deg,#FAFBFF 0%,#FFF8F4 100%)', border: '1px solid #EEE9FF', marginBottom: 24, transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? '0 8px 24px rgba(123,140,255,0.1)' : '0 2px 16px rgba(123,140,255,0.06)' }}>
      <div style={S.sectionLabel}>Personalized Learning</div>
      <h2 style={S.sectionTitle}>AI Insights</h2>
      {hasInsights ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* future: render real insights */}
        </div>
      ) : (
        <div style={{ padding: '16px 20px', background: 'rgba(123,140,255,0.06)', borderRadius: 14, border: '1px solid rgba(123,140,255,0.12)', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7B8CFF', letterSpacing: '0.8px', marginBottom: 8 }}>GETTING STARTED</div>
          <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.7 }}>
            Complete your first lesson to receive personalized AI feedback on your grammar, vocabulary, and speaking confidence.
          </p>
        </div>
      )}
      <button
        onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
        onClick={() => navigate('/learning')}
        style={{ ...S.btnPrimary, padding: '13px 28px', fontSize: 14, borderRadius: 12, transform: hoverBtn ? 'scale(1.02)' : 'scale(1)', boxShadow: hoverBtn ? '0 6px 24px rgba(123,140,255,0.35)' : '0 2px 12px rgba(123,140,255,0.15)' }}
      >
        {lessonsCompleted > 0 ? 'Start next lesson →' : 'Start your first lesson →'}
      </button>
    </div>
  )
}

// ─── Gradient CTA ─────────────────────────────────────────────────────────────

function GradientCTA() {
  const navigate = useNavigate()
  const [hoverBtn, setHoverBtn] = useState(false)
  return (
    <div style={{ borderRadius: 24, background: 'linear-gradient(135deg,#7B8CFF 0%,#A18BFF 50%,#FFB38C 100%)', padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Ready for your next lesson?</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', margin: 0 }}>Continue learning with your AI teacher.</p>
      </div>
      <button
        onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
        onClick={() => navigate('/learning')}
        style={{ background: '#fff', color: '#7B8CFF', border: 'none', borderRadius: 14, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', transform: hoverBtn ? 'scale(1.02)' : 'scale(1)', boxShadow: hoverBtn ? '0 6px 24px rgba(0,0,0,0.15)' : '0 2px 12px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}
      >
        Continue learning →
      </button>
    </div>
  )
}

// ─── Loading / Error States ───────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={S.page}>
      <main style={S.main}>
        <div style={{ ...S.card, height: 160, background: 'linear-gradient(135deg,#FAFBFF,#FFF8F4)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 28, padding: 40 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#F0EEF8' }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: 160, height: 24, background: '#F0EEF8', borderRadius: 8, marginBottom: 12 }} />
            <div style={{ width: 120, height: 16, background: '#F0EEF8', borderRadius: 8 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ ...S.card, height: 100, background: '#FAFAFA' }} />
          ))}
        </div>
      </main>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, profile: authProfile, isAuthenticated, isAuthLoading, token, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [profileData, setProfileData]   = useState<ProfileData | null>(null)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)

  const [fetchError, setFetchError] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!token) {
      // Token not yet available — don't stay on skeleton forever.
      setFetchLoading(false)
      return
    }
    setFetchError(false)
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json() as ProfileData
        setProfileData(data)
      } else {
        // API returned an error — clear loading so zero-state defaults render.
        console.warn('[profile] GET /api/profile returned', res.status)
        if (res.status >= 500) setFetchError(true)
      }
    } catch {
      setFetchError(true)
    } finally {
      setFetchLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        navigate('/learning')
        return
      }
      fetchProfile()
    }
  }, [isAuthLoading, isAuthenticated, fetchProfile, navigate])

  async function handleEditSaved() {
    setShowEditModal(false)
    await refreshUser()
    await fetchProfile()
  }

  if (isAuthLoading || fetchLoading) return <LoadingSkeleton />

  // Derive display values — prefer profileData over authProfile
  const pd = profileData
  const displayName: string =
    pd?.profile.displayName
    ?? authProfile?.displayName
    ?? user?.name
    ?? user?.email?.split('@')[0]
    ?? 'New Learner'

  const avatarEmoji: string | null = pd?.profile.avatarEmoji ?? authProfile?.avatarEmoji ?? null
  const level     = pd?.profile.level ?? authProfile?.level ?? 'Beginner'
  const rank      = pd?.profile.rank  ?? authProfile?.rank  ?? 'New Learner'
  const xp        = pd?.profile.xp    ?? authProfile?.xp    ?? 0

  const stats: ProfileStats = pd?.stats ?? {
    lessonsCompleted:    0,
    learningTimeMinutes: 0,
    currentStreakDays:   0,
    testsCompleted:      0,
    averageAccuracy:     null,
  }

  return (
    <div style={S.page}>
      {showEditModal && token && (
        <EditProfileModal
          initialName={displayName}
          initialEmoji={avatarEmoji}
          token={token}
          onClose={() => setShowEditModal(false)}
          onSaved={handleEditSaved}
        />
      )}

      <main style={S.main}>
        {fetchError && (
          <div style={{ marginBottom: 16, padding: '12px 18px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#92400E', fontWeight: 500 }}>Couldn't load your profile data — showing cached info.</span>
            <button onClick={fetchProfile} style={{ fontSize: 12, fontWeight: 700, color: '#7B8CFF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Retry</button>
          </div>
        )}

        <ProfileHero
          displayName={displayName}
          avatarEmoji={avatarEmoji}
          avatarUrl={user?.avatarUrl ?? null}
          rank={rank}
          level={level}
          onEdit={() => setShowEditModal(true)}
        />

        <div id="stats">
          <StatsGrid stats={stats} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <ProductivityCard stats={stats} />
          <RankProgressCard xp={xp} rank={rank} />
        </div>

        <div id="recent-lessons">
          <LessonHistoryCard history={pd?.learningHistory ?? []} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <TestsCard tests={pd?.completedTests ?? []} />
          <AchievementsCard achievements={pd?.achievements ?? []} />
        </div>

        <AIInsightsCard insights={pd?.insights ?? []} lessonsCompleted={stats.lessonsCompleted} />

        <GradientCTA />
      </main>
    </div>
  )
}
