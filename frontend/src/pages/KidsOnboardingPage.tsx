import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, getStoredToken } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// ── Interest taxonomy ─────────────────────────────────────────────────────────

const INTERESTS = [
  { tag: 'roblox',      label: 'Roblox',      emoji: '🎮' },
  { tag: 'minecraft',   label: 'Minecraft',   emoji: '🧱' },
  { tag: 'brawl_stars', label: 'Brawl Stars', emoji: '⚔️' },
  { tag: 'pokemon',     label: 'Pokémon',     emoji: '⭐' },
  { tag: 'football',    label: 'Football',    emoji: '⚽' },
  { tag: 'animals',     label: 'Animals',     emoji: '🐾' },
  { tag: 'cars',        label: 'Cars',        emoji: '🚗' },
  { tag: 'space',       label: 'Space',       emoji: '🚀' },
  { tag: 'dinosaurs',   label: 'Dinosaurs',   emoji: '🦕' },
  { tag: 'superheroes', label: 'Superheroes', emoji: '🦸' },
  { tag: 'princesses',  label: 'Princesses',  emoji: '👑' },
  { tag: 'drawing',     label: 'Drawing',     emoji: '🎨' },
]

// ── Teachers ──────────────────────────────────────────────────────────────────

const TEACHERS = [
  { id: 'lucy', name: 'Lucy', emoji: '👩‍🏫', desc: 'Energetic & playful' },
  { id: 'tom',  name: 'Tom',  emoji: '👨‍🏫', desc: 'Calm & encouraging'  },
]

// ── API ───────────────────────────────────────────────────────────────────────

interface ProfilePayload {
  childName:     string
  childAgeYears: number
  teacherId:     string
  interests:     string[]
}

async function saveProfile(payload: ProfilePayload, isEdit: boolean): Promise<void> {
  const token = getStoredToken()
  if (!token) throw new Error('UNAUTHENTICATED')
  const method = isEdit ? 'PUT' : 'POST'
  const res = await fetch(`${API_BASE}/api/kids/child-profile`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('UNAUTHENTICATED')
  if (res.status === 409 && !isEdit) {
    // Profile already exists — switch to PUT
    const res2 = await fetch(`${API_BASE}/api/kids/child-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    if (!res2.ok) throw new Error('SAVE_ERROR')
    return
  }
  if (!res.ok) throw new Error('SAVE_ERROR')
}

async function fetchExistingProfile(): Promise<ProfilePayload | null> {
  const token = getStoredToken()
  if (!token) return null
  const res = await fetch(`${API_BASE}/api/kids/child-profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  const data = await res.json() as {
    childName: string; childAgeYears: number; teacherId: string; interests: string[]
  }
  return data
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  .ko-page {
    min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: linear-gradient(160deg, #FFF9F3 0%, #F0F4FF 50%, #FFF4EE 100%);
    padding: 24px;
  }
  .ko-card {
    background: #fff; border-radius: 28px; padding: 44px 40px;
    max-width: 500px; width: 100%;
    box-shadow: 0 24px 64px rgba(15,23,42,0.10), 0 0 0 1px rgba(230,234,242,0.8);
  }
  .ko-progress { display:flex; gap:6px; margin-bottom:32px; justify-content:center; }
  .ko-dot { width:8px; height:8px; border-radius:50%; background:#E6EAF2; transition:background 250ms; }
  .ko-dot.active { background:#7B8CFF; }
  .ko-dot.done { background:#A18BFF; }
  .ko-step-icon { font-size:42px; text-align:center; display:block; margin-bottom:16px; }
  .ko-step-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:800; color:#0F172A; text-align:center; margin-bottom:8px; letter-spacing:-0.5px; }
  .ko-step-sub { font-size:14px; color:#64748B; text-align:center; margin-bottom:28px; line-height:1.55; }
  .ko-input {
    width:100%; padding:14px 16px; border:2px solid #E6EAF2; border-radius:14px;
    font-size:16px; font-family:'DM Sans',sans-serif; color:#0F172A; background:#fff;
    transition:border-color 180ms, box-shadow 180ms; outline:none;
    box-sizing:border-box;
  }
  .ko-input:focus { border-color:#7B8CFF; box-shadow:0 0 0 3px rgba(123,140,255,0.12); }
  .ko-age-row { display:flex; align-items:center; gap:16px; margin-top:4px; }
  .ko-age-display { font-family:'Sora',sans-serif; font-size:48px; font-weight:800; color:#7B8CFF; min-width:80px; text-align:center; }
  .ko-age-btn {
    width:48px; height:48px; border-radius:50%; border:2px solid #7B8CFF;
    background:#fff; color:#7B8CFF; font-size:24px; font-weight:700;
    display:flex; align-items:center; justify-content:center; cursor:pointer;
    transition:background 150ms, color 150ms; flex-shrink:0;
  }
  .ko-age-btn:hover { background:#7B8CFF; color:#fff; }
  .ko-age-btn:disabled { border-color:#E6EAF2; color:#C8D0E1; cursor:not-allowed; }
  .ko-age-btn:disabled:hover { background:#fff; color:#C8D0E1; }
  .ko-teachers { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:4px; }
  .ko-teacher-card {
    border:2px solid #E6EAF2; border-radius:16px; padding:20px 16px; text-align:center;
    cursor:pointer; transition:border-color 180ms, background 180ms, transform 150ms;
    user-select:none;
  }
  .ko-teacher-card:hover { border-color:#A18BFF; transform:translateY(-2px); }
  .ko-teacher-card.selected { border-color:#7B8CFF; background:rgba(123,140,255,0.06); }
  .ko-teacher-emoji { font-size:32px; display:block; margin-bottom:10px; }
  .ko-teacher-name { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0F172A; margin-bottom:4px; }
  .ko-teacher-desc { font-size:12px; color:#64748B; }
  .ko-interests { display:flex; flex-wrap:wrap; gap:10px; }
  .ko-chip {
    display:flex; align-items:center; gap:6px;
    padding:8px 14px; border-radius:22px; border:2px solid #E6EAF2;
    background:#fff; cursor:pointer; font-size:14px; font-weight:500; color:#475569;
    transition:border-color 180ms, background 180ms, color 180ms; user-select:none;
  }
  .ko-chip:hover { border-color:#A18BFF; color:#0F172A; }
  .ko-chip.selected { border-color:#7B8CFF; background:rgba(123,140,255,0.08); color:#3B4AE0; }
  .ko-chip-emoji { font-size:16px; }
  .ko-max-hint { font-size:12px; color:#94A3B8; text-align:center; margin-top:10px; }
  .ko-confirm-box { background:#F8F9FF; border:1px solid rgba(123,140,255,0.15); border-radius:16px; padding:20px; margin-bottom:28px; }
  .ko-confirm-row { display:flex; justify-content:space-between; margin-bottom:10px; align-items:baseline; }
  .ko-confirm-row:last-child { margin-bottom:0; }
  .ko-confirm-label { font-size:12px; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.06em; }
  .ko-confirm-val { font-size:14px; font-weight:600; color:#0F172A; text-align:right; max-width:70%; }
  .ko-confirm-interests { display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end; }
  .ko-confirm-chip { font-size:11px; color:#7B8CFF; background:rgba(123,140,255,0.08); border:1px solid rgba(123,140,255,0.18); border-radius:20px; padding:2px 8px; }
  .ko-nav { display:flex; gap:12px; margin-top:28px; }
  .ko-btn-back {
    flex:1; padding:14px; border:2px solid #E6EAF2; border-radius:14px;
    background:#fff; color:#475569; font-family:'Sora',sans-serif; font-size:15px; font-weight:600;
    cursor:pointer; transition:border-color 150ms; text-align:center;
  }
  .ko-btn-back:hover { border-color:#A18BFF; }
  .ko-btn-next {
    flex:2; padding:14px;
    background:linear-gradient(135deg,#7B8CFF 0%,#A18BFF 60%,#FFB38C 100%);
    color:#fff; font-family:'Sora',sans-serif; font-size:16px; font-weight:700;
    border:none; border-radius:14px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    box-shadow:0 8px 24px rgba(123,140,255,0.3); transition:transform 150ms, box-shadow 150ms;
  }
  .ko-btn-next:hover:not(:disabled) { transform:scale(1.02); box-shadow:0 12px 32px rgba(123,140,255,0.42); }
  .ko-btn-next:disabled { background:#C8D0E1; box-shadow:none; cursor:not-allowed; }
  .ko-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:ko-spin 0.7s linear infinite; }
  @keyframes ko-spin { to{transform:rotate(360deg)} }
  .ko-error { background:rgba(239,68,68,0.08); color:#DC2626; border:1px solid rgba(239,68,68,0.2); border-radius:10px; padding:10px 14px; font-size:13px; margin-top:12px; text-align:center; }
  .ko-field-error { font-size:12px; color:#DC2626; margin-top:6px; min-height:18px; }
  @media(max-width:480px){
    .ko-card{padding:28px 20px; border-radius:20px;}
    .ko-step-title{font-size:19px;}
    .ko-teachers{grid-template-columns:1fr 1fr;}
  }
`

const TEACHER_DISPLAY: Record<string, string> = { lucy: 'Lucy', tom: 'Tom', default: 'Lucy' }

const MAX_INTERESTS = 5
const TOTAL_STEPS = 5

export default function KidsOnboardingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isAuthLoading } = useAuth()

  const [step,     setStep]     = useState(0) // 0-indexed
  const [isEdit,   setIsEdit]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [fieldErr, setFieldErr] = useState<string | null>(null)

  // Form state
  const [childName,     setChildName]     = useState('')
  const [childAge,      setChildAge]      = useState(7)
  const [teacherId,     setTeacherId]     = useState('lucy')
  const [interests,     setInterests]     = useState<string[]>([])

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, isAuthLoading, navigate])

  // Pre-fill form if profile exists (edit mode)
  useEffect(() => {
    if (!isAuthenticated) return
    fetchExistingProfile().then(profile => {
      if (profile) {
        setIsEdit(true)
        setChildName(profile.childName ?? '')
        setChildAge(profile.childAgeYears ?? 7)
        setTeacherId(profile.teacherId ?? 'lucy')
        setInterests(profile.interests ?? [])
      }
    }).catch(() => {})
  }, [isAuthenticated])

  function toggleInterest(tag: string) {
    setInterests(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag)
      if (prev.length >= MAX_INTERESTS) return prev
      return [...prev, tag]
    })
  }

  function validateStep(): boolean {
    setFieldErr(null)
    if (step === 0 && !childName.trim()) {
      setFieldErr('Please enter your child\'s name.')
      return false
    }
    if (step === 0 && childName.trim().length > 100) {
      setFieldErr('Name is too long (max 100 characters).')
      return false
    }
    return true
  }

  function nextStep() {
    if (!validateStep()) return
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  }

  function prevStep() {
    setFieldErr(null)
    setStep(s => Math.max(s - 1, 0))
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      await saveProfile({ childName: childName.trim(), childAgeYears: childAge, teacherId, interests }, isEdit)
      navigate('/kids', { replace: true })
    } catch (err) {
      const code = (err as Error).message
      if (code === 'UNAUTHENTICATED') { navigate('/', { replace: true }); return }
      setError('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (isAuthLoading) return null

  function DotProgress() {
    return (
      <div className="ko-progress">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`ko-dot${i === step ? ' active' : i < step ? ' done' : ''}`} />
        ))}
      </div>
    )
  }

  function NavButtons({ nextLabel = 'Continue →', onNext = nextStep, disabled = false }: {
    nextLabel?: string
    onNext?: () => void
    disabled?: boolean
  }) {
    return (
      <div className="ko-nav">
        {step > 0 && (
          <button className="ko-btn-back" onClick={prevStep}>← Back</button>
        )}
        <button className="ko-btn-next" onClick={onNext} disabled={disabled || saving}>
          {saving ? <><div className="ko-spinner" /> Saving…</> : nextLabel}
        </button>
      </div>
    )
  }

  // ── Step 0: Child name ──────────────────────────────────────────────────────
  if (step === 0) return (
    <>
      <style>{CSS}</style>
      <div className="ko-page">
        <div className="ko-card">
          <DotProgress />
          <span className="ko-step-icon">👋</span>
          <h1 className="ko-step-title">What's your child's name?</h1>
          <p className="ko-step-sub">We'll use it to make lessons feel personal.</p>
          <input
            className="ko-input"
            type="text"
            placeholder="e.g. Alex"
            value={childName}
            onChange={e => { setChildName(e.target.value); setFieldErr(null) }}
            onKeyDown={e => e.key === 'Enter' && nextStep()}
            autoFocus
            maxLength={100}
          />
          {fieldErr && <div className="ko-field-error">{fieldErr}</div>}
          <NavButtons />
        </div>
      </div>
    </>
  )

  // ── Step 1: Age ─────────────────────────────────────────────────────────────
  if (step === 1) return (
    <>
      <style>{CSS}</style>
      <div className="ko-page">
        <div className="ko-card">
          <DotProgress />
          <span className="ko-step-icon">🎂</span>
          <h1 className="ko-step-title">How old is {childName || 'your child'}?</h1>
          <p className="ko-step-sub">We'll adjust lessons to the right level.</p>
          <div className="ko-age-row" style={{ justifyContent: 'center' }}>
            <button
              className="ko-age-btn"
              onClick={() => setChildAge(a => Math.max(4, a - 1))}
              disabled={childAge <= 4}
            >−</button>
            <div className="ko-age-display">{childAge}</div>
            <button
              className="ko-age-btn"
              onClick={() => setChildAge(a => Math.min(14, a + 1))}
              disabled={childAge >= 14}
            >+</button>
          </div>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#94A3B8', marginTop: '12px' }}>
            years old
          </p>
          <NavButtons />
        </div>
      </div>
    </>
  )

  // ── Step 2: Teacher ─────────────────────────────────────────────────────────
  if (step === 2) return (
    <>
      <style>{CSS}</style>
      <div className="ko-page">
        <div className="ko-card">
          <DotProgress />
          <span className="ko-step-icon">🧑‍🏫</span>
          <h1 className="ko-step-title">Choose a teacher</h1>
          <p className="ko-step-sub">Who should teach {childName || 'your child'}?</p>
          <div className="ko-teachers">
            {TEACHERS.map(t => (
              <div
                key={t.id}
                className={`ko-teacher-card${teacherId === t.id ? ' selected' : ''}`}
                onClick={() => setTeacherId(t.id)}
              >
                <span className="ko-teacher-emoji">{t.emoji}</span>
                <div className="ko-teacher-name">{t.name}</div>
                <div className="ko-teacher-desc">{t.desc}</div>
              </div>
            ))}
          </div>
          <NavButtons />
        </div>
      </div>
    </>
  )

  // ── Step 3: Interests ───────────────────────────────────────────────────────
  if (step === 3) return (
    <>
      <style>{CSS}</style>
      <div className="ko-page">
        <div className="ko-card">
          <DotProgress />
          <span className="ko-step-icon">⭐</span>
          <h1 className="ko-step-title">What does {childName || 'your child'} love?</h1>
          <p className="ko-step-sub">
            The teacher will use these as fun examples during lessons.<br />
            Pick up to {MAX_INTERESTS}.
          </p>
          <div className="ko-interests">
            {INTERESTS.map(({ tag, label, emoji }) => (
              <div
                key={tag}
                className={`ko-chip${interests.includes(tag) ? ' selected' : ''}`}
                onClick={() => toggleInterest(tag)}
              >
                <span className="ko-chip-emoji">{emoji}</span>
                {label}
              </div>
            ))}
          </div>
          {interests.length >= MAX_INTERESTS && (
            <div className="ko-max-hint">Max {MAX_INTERESTS} interests selected. Tap one to deselect.</div>
          )}
          <NavButtons nextLabel="Continue →" />
        </div>
      </div>
    </>
  )

  // ── Step 4: Confirm ─────────────────────────────────────────────────────────
  const teacherName = TEACHER_DISPLAY[teacherId] ?? 'Lucy'
  const interestLabels = interests.map(tag => INTERESTS.find(i => i.tag === tag)?.label ?? tag)

  return (
    <>
      <style>{CSS}</style>
      <div className="ko-page">
        <div className="ko-card">
          <DotProgress />
          <span className="ko-step-icon">🎉</span>
          <h1 className="ko-step-title">All set!</h1>
          <p className="ko-step-sub">Here's the profile for {childName}.</p>

          <div className="ko-confirm-box">
            <div className="ko-confirm-row">
              <span className="ko-confirm-label">Name</span>
              <span className="ko-confirm-val">{childName}</span>
            </div>
            <div className="ko-confirm-row">
              <span className="ko-confirm-label">Age</span>
              <span className="ko-confirm-val">{childAge} years old</span>
            </div>
            <div className="ko-confirm-row">
              <span className="ko-confirm-label">Teacher</span>
              <span className="ko-confirm-val">{teacherName}</span>
            </div>
            <div className="ko-confirm-row">
              <span className="ko-confirm-label">Interests</span>
              {interestLabels.length > 0 ? (
                <div className="ko-confirm-interests">
                  {interestLabels.map(l => <span key={l} className="ko-confirm-chip">{l}</span>)}
                </div>
              ) : (
                <span className="ko-confirm-val" style={{ color: '#94A3B8' }}>None selected</span>
              )}
            </div>
          </div>

          {error && <div className="ko-error">⚠ {error}</div>}

          <NavButtons
            nextLabel={isEdit ? 'Save changes →' : 'Start learning →'}
            onNext={handleSubmit}
            disabled={saving}
          />
        </div>
      </div>
    </>
  )
}
