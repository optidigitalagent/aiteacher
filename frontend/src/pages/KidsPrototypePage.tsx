import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, getStoredToken } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const BACKEND_URL = API_BASE || 'http://localhost:4000'

async function startKidsSession(): Promise<string> {
  const token = getStoredToken()
  if (!token) throw new Error('UNAUTHENTICATED')
  const res = await fetch(`${API_BASE}/lesson/kids/start`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${token}`,
    },
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

function handleGoogleLogin() {
  sessionStorage.setItem('kids_redirect', '/kids')
  window.location.href = `${BACKEND_URL}/auth/google`
}

const CSS = `
  .kp-page {
    min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: linear-gradient(160deg, #FFF9F3 0%, #F0F4FF 50%, #FFF4EE 100%);
    padding: 24px;
  }
  .kp-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;
    color: #7B8CFF; background: rgba(123,140,255,0.1); border: 1px solid rgba(123,140,255,0.2);
    border-radius: 20px; padding: 4px 12px; margin-bottom: 24px;
  }
  .kp-card {
    background: #fff; border-radius: 28px; padding: 48px 44px;
    max-width: 440px; width: 100%;
    box-shadow: 0 24px 64px rgba(15,23,42,0.10), 0 0 0 1px rgba(230,234,242,0.8);
    text-align: center;
  }
  .kp-icon {
    font-size: 52px; margin-bottom: 20px; display: block;
    animation: kp-bounce 2s ease-in-out infinite;
  }
  @keyframes kp-bounce {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
  }
  .kp-title {
    font-family: 'Sora', sans-serif;
    font-size: 24px; font-weight: 800; color: #0F172A;
    letter-spacing: -0.6px; margin-bottom: 8px;
  }
  .kp-sub {
    font-size: 14px; color: #64748B; line-height: 1.6; margin-bottom: 32px;
  }
  .kp-btn {
    width: 100%; padding: 16px;
    background: linear-gradient(135deg, #7B8CFF 0%, #A18BFF 60%, #FFB38C 100%);
    color: #fff;
    font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700;
    border: none; border-radius: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 8px 24px rgba(123,140,255,0.35);
    transition: transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms;
    margin-bottom: 12px;
  }
  .kp-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 12px 32px rgba(123,140,255,0.45); }
  .kp-btn:active:not(:disabled) { transform: scale(0.98); }
  .kp-btn:disabled { background: #C8D0E1; box-shadow: none; cursor: not-allowed; }
  .kp-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
    border-radius: 50%; animation: kp-spin 0.7s linear infinite;
  }
  @keyframes kp-spin { to { transform: rotate(360deg); } }
  .kp-error {
    background: rgba(239,68,68,0.08); color: #DC2626;
    border: 1px solid rgba(239,68,68,0.2); border-radius: 10px;
    padding: 10px 14px; font-size: 13px; margin-top: 12px;
  }
  .kp-caps {
    margin-top: 20px; padding-top: 20px;
    border-top: 1px solid #EEF1F7;
    display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
  }
  .kp-cap-chip {
    font-size: 11px; color: #94A3B8;
    background: #F6F7FB; border: 1px solid #EEF1F7;
    border-radius: 20px; padding: 3px 10px;
  }
  @media (max-width: 480px) {
    .kp-card { padding: 32px 24px; border-radius: 20px; }
    .kp-title { font-size: 20px; }
  }
`

export default function KidsPrototypePage() {
  const navigate = useNavigate()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleStart() {
    if (!isAuthenticated) {
      handleGoogleLogin()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sessionId = await startKidsSession()
      navigate(`/kids/classroom/${sessionId}`)
    } catch (err) {
      const code = err instanceof Error ? err.message : 'INTERNAL_ERROR'
      if (code === 'UNAUTHENTICATED') {
        handleGoogleLogin()
        return
      }
      if (code === 'RATE_LIMITED') {
        setError('Too many requests. Please wait a moment and try again.')
      } else {
        setError('Failed to start session. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (isAuthLoading) return null

  return (
    <>
      <style>{CSS}</style>
      <div className="kp-page">
        <div className="kp-badge">Experimental · Prototype</div>
        <div className="kp-card">
          <span className="kp-icon">🦁</span>
          <h1 className="kp-title">Mentium Kids</h1>
          <p className="kp-sub">
            An experimental English learning session for young learners.
            {!isAuthenticated && ' Sign in to begin.'}
          </p>

          <button
            className="kp-btn"
            disabled={loading}
            onClick={handleStart}
          >
            {loading
              ? <><div className="kp-spinner" /> Starting…</>
              : isAuthenticated
              ? 'Start Kids Prototype →'
              : 'Sign in to start →'
            }
          </button>

          {error && <div className="kp-error">⚠ {error}</div>}

          <div className="kp-caps">
            <span className="kp-cap-chip">⏱ 15 min max</span>
            <span className="kp-cap-chip">Kids Box · Unit 1</span>
            <span className="kp-cap-chip">Ages 6–9</span>
          </div>
        </div>
      </div>
    </>
  )
}
