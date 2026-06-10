import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, getStoredToken } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface ChildProfile {
  childId:       string
  childName:     string
  childAgeYears: number
  ageBand:       string
  teacherId:     string
  interests:     string[]
}

async function fetchChildProfile(): Promise<ChildProfile | null> {
  const token = getStoredToken()
  if (!token) return null
  const res = await fetch(`${API_BASE}/api/kids/child-profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (res.status === 401) throw new Error('UNAUTHENTICATED')
  if (!res.ok) throw new Error('FETCH_ERROR')
  return res.json() as Promise<ChildProfile>
}

async function startKidsSession(): Promise<string> {
  const token = getStoredToken()
  if (!token) throw new Error('UNAUTHENTICATED')
  const res = await fetch(`${API_BASE}/lesson/kids/start`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new Error('UNAUTHENTICATED')
  if (res.status === 429) throw new Error('RATE_LIMITED')
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((body.code as string | undefined) ?? 'INTERNAL_ERROR')
  }
  const data = await res.json() as { sessionId: string }
  if (!data.sessionId) throw new Error('INVALID_SESSION')
  return data.sessionId
}

const TEACHER_DISPLAY: Record<string, string> = {
  lucy:    'Lucy',
  tom:     'Tom',
  default: 'Lucy',
}

const INTEREST_LABELS: Record<string, string> = {
  roblox:      'Roblox',
  brawl_stars: 'Brawl Stars',
  minecraft:   'Minecraft',
  pokemon:     'Pokémon',
  football:    'Football',
  animals:     'Animals',
  cars:        'Cars',
  space:       'Space',
  dinosaurs:   'Dinosaurs',
  superheroes: 'Superheroes',
  princesses:  'Princesses',
  drawing:     'Drawing',
}

const CSS = `
  .kp-page {
    min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: linear-gradient(160deg, #FFF9F3 0%, #F0F4FF 50%, #FFF4EE 100%);
    padding: 24px;
  }
  .kp-card {
    background: #fff; border-radius: 28px; padding: 48px 44px;
    max-width: 460px; width: 100%;
    box-shadow: 0 24px 64px rgba(15,23,42,0.10), 0 0 0 1px rgba(230,234,242,0.8);
    text-align: center;
  }
  .kp-icon { font-size: 52px; margin-bottom: 20px; display: block; animation: kp-bounce 2s ease-in-out infinite; }
  @keyframes kp-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  .kp-title { font-family:'Sora',sans-serif; font-size:24px; font-weight:800; color:#0F172A; letter-spacing:-0.6px; margin-bottom:6px; }
  .kp-greeting { font-size:15px; color:#475569; margin-bottom:24px; line-height:1.5; }
  .kp-profile-box {
    background: #F8F9FF; border: 1px solid rgba(123,140,255,0.15);
    border-radius: 16px; padding: 16px 20px; margin-bottom: 24px; text-align: left;
  }
  .kp-profile-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
  .kp-profile-label { font-size:11px; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.06em; }
  .kp-profile-val { font-size:14px; font-weight:600; color:#0F172A; }
  .kp-interests { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
  .kp-interest-chip {
    font-size:11px; color:#7B8CFF; background:rgba(123,140,255,0.08);
    border:1px solid rgba(123,140,255,0.18); border-radius:20px; padding:3px 10px; font-weight:500;
  }
  .kp-btn {
    width: 100%; padding: 16px;
    background: linear-gradient(135deg, #7B8CFF 0%, #A18BFF 60%, #FFB38C 100%);
    color: #fff; font-family:'Sora',sans-serif; font-size:16px; font-weight:700;
    border: none; border-radius: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 8px 24px rgba(123,140,255,0.35);
    transition: transform 180ms, box-shadow 180ms;
    margin-bottom: 12px;
  }
  .kp-btn:hover:not(:disabled) { transform:scale(1.02); box-shadow:0 12px 32px rgba(123,140,255,0.45); }
  .kp-btn:disabled { background:#C8D0E1; box-shadow:none; cursor:not-allowed; }
  .kp-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:kp-spin 0.7s linear infinite; }
  @keyframes kp-spin { to{transform:rotate(360deg)} }
  .kp-edit-link { font-size:13px; color:#7B8CFF; text-decoration:none; display:block; margin-top:4px; }
  .kp-edit-link:hover { text-decoration:underline; }
  .kp-error { background:rgba(239,68,68,0.08); color:#DC2626; border:1px solid rgba(239,68,68,0.2); border-radius:10px; padding:10px 14px; font-size:13px; margin-top:12px; }
  .kp-caps { margin-top:20px; padding-top:20px; border-top:1px solid #EEF1F7; display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
  .kp-cap-chip { font-size:11px; color:#94A3B8; background:#F6F7FB; border:1px solid #EEF1F7; border-radius:20px; padding:3px 10px; }
  @media(max-width:480px){ .kp-card{padding:32px 24px; border-radius:20px;} .kp-title{font-size:20px;} }
`

export default function KidsPrototypePage() {
  const navigate = useNavigate()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const [profile,  setProfile]  = useState<ChildProfile | null | 'loading'>('loading')
  const [starting, setStarting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (isAuthLoading) return
    if (!isAuthenticated) {
      navigate('/', { replace: true })
      return
    }
    fetchChildProfile()
      .then(p => setProfile(p))
      .catch(err => {
        if ((err as Error).message === 'UNAUTHENTICATED') navigate('/', { replace: true })
        else setProfile(null)
      })
  }, [isAuthenticated, isAuthLoading, navigate])

  useEffect(() => {
    if (profile === null) {
      navigate('/kids/onboarding', { replace: true })
    }
  }, [profile, navigate])

  async function handleStart() {
    setStarting(true)
    setError(null)
    try {
      const sessionId = await startKidsSession()
      navigate(`/kids/classroom/${sessionId}`)
    } catch (err) {
      const code = (err as Error).message
      if (code === 'UNAUTHENTICATED') { navigate('/', { replace: true }); return }
      if (code === 'RATE_LIMITED') setError('Too many requests. Please wait a moment.')
      else setError('Failed to start session. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  if (isAuthLoading || profile === 'loading') return null

  const p = profile as ChildProfile
  const teacherName = TEACHER_DISPLAY[p.teacherId] ?? 'Lucy'

  return (
    <>
      <style>{CSS}</style>
      <div className="kp-page">
        <div className="kp-card">
          <span className="kp-icon">🦁</span>
          <h1 className="kp-title">Kids English</h1>
          <p className="kp-greeting">
            Ready to learn, {p.childName}?<br />
            Your teacher today is <strong>{teacherName}</strong>.
          </p>

          <div className="kp-profile-box">
            <div className="kp-profile-row">
              <span className="kp-profile-label">Name</span>
              <span className="kp-profile-val">{p.childName}</span>
            </div>
            <div className="kp-profile-row">
              <span className="kp-profile-label">Age</span>
              <span className="kp-profile-val">{p.childAgeYears} years old</span>
            </div>
            <div className="kp-profile-row">
              <span className="kp-profile-label">Teacher</span>
              <span className="kp-profile-val">{teacherName}</span>
            </div>
            {p.interests.length > 0 && (
              <div className="kp-interests">
                {p.interests.map(tag => (
                  <span key={tag} className="kp-interest-chip">
                    {INTEREST_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button className="kp-btn" disabled={starting} onClick={handleStart}>
            {starting ? <><div className="kp-spinner" /> Starting…</> : 'Start lesson →'}
          </button>

          <Link to="/kids/onboarding" className="kp-edit-link">Edit child profile</Link>

          {error && <div className="kp-error">⚠ {error}</div>}

          <div className="kp-caps">
            <span className="kp-cap-chip">Kids Box · Unit 1</span>
            <span className="kp-cap-chip">Ages 6–9</span>
            <span className="kp-cap-chip">English</span>
          </div>
        </div>
      </div>
    </>
  )
}
