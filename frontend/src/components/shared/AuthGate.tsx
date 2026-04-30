// Modal shown when an unauthenticated user tries to start a lesson.
// Saves current setup state to sessionStorage, then redirects to Google OAuth.

const BACKEND_URL  = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const SETUP_KEY    = 'lesson_setup_state'

export interface LessonSetupState {
  mode?:          string
  bookId?:        string
  bookTitle?:     string
  sectionId?:     string
  sectionNumber?: string
  sectionTitle?:  string
  sectionTopic?:  string
  teacherId?:     string
  teacherName?:   string
  voiceId?:       string
}

export function saveSetupState(state: LessonSetupState): void {
  sessionStorage.setItem(SETUP_KEY, JSON.stringify(state))
}

export function loadSetupState(): LessonSetupState | null {
  try {
    const raw = sessionStorage.getItem(SETUP_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LessonSetupState
  } catch {
    return null
  }
}

export function clearSetupState(): void {
  sessionStorage.removeItem(SETUP_KEY)
}

const CSS = `
  .auth-gate-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(15,23,42,0.55);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    animation: ag-fade-in 200ms ease both;
  }
  @keyframes ag-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .auth-gate-modal {
    background: #fff;
    border-radius: 28px;
    padding: 48px 44px;
    max-width: 440px;
    width: calc(100% - 32px);
    box-shadow: 0 32px 80px rgba(15,23,42,0.18), 0 0 0 1px rgba(230,234,242,0.8);
    animation: ag-slide-up 260ms cubic-bezier(0.22,1,0.36,1) both;
    text-align: center;
  }
  @keyframes ag-slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .auth-gate-icon {
    width: 72px; height: 72px; border-radius: 22px; margin: 0 auto 24px;
    background: linear-gradient(135deg,rgba(123,140,255,0.12),rgba(161,139,255,0.08));
    border: 1px solid rgba(123,140,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
  }
  .auth-gate-title {
    font-family: 'Sora', sans-serif;
    font-size: 22px; font-weight: 800; color: #0F172A;
    letter-spacing: -0.5px; margin-bottom: 12px;
  }
  .auth-gate-text {
    font-size: 14px; color: #64748B;
    line-height: 1.65; margin-bottom: 32px;
  }
  .auth-gate-btn {
    width: 100%; padding: 15px;
    background: linear-gradient(135deg, #7B8CFF 0%, #A18BFF 60%, #FFB38C 100%);
    color: #fff;
    font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700;
    border: none; border-radius: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 8px 24px rgba(123,140,255,0.35);
    transition: transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms;
    margin-bottom: 12px;
  }
  .auth-gate-btn:hover { transform: scale(1.02); box-shadow: 0 12px 32px rgba(123,140,255,0.45); }
  .auth-gate-btn:active { transform: scale(0.98); }
  .auth-gate-btn-cancel {
    width: 100%; padding: 12px;
    background: transparent; color: #94A3B8;
    font-size: 14px; font-weight: 500;
    border: none; cursor: pointer; border-radius: 12px;
    transition: color 160ms, background 160ms;
  }
  .auth-gate-btn-cancel:hover { background: #F6F7FB; color: #64748B; }
  .auth-gate-google-icon {
    width: 20px; height: 20px; flex-shrink: 0;
  }
  .auth-gate-privacy {
    margin-top: 16px; font-size: 11px; color: #CBD5E1;
  }
`

interface Props {
  setupState?: LessonSetupState
  onCancel:    () => void
}

export default function AuthGate({ setupState, onCancel }: Props) {
  function handleGoogleLogin() {
    if (setupState) saveSetupState(setupState)
    window.location.href = `${BACKEND_URL}/auth/google`
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="auth-gate-overlay" onClick={onCancel}>
        <div className="auth-gate-modal" onClick={(e) => e.stopPropagation()}>
          <div className="auth-gate-icon">🎓</div>

          <div className="auth-gate-title">
            Create an account to start your AI lesson
          </div>

          <div className="auth-gate-text">
            Your progress, level, lesson history, and achievements will be saved to your account.
          </div>

          <button className="auth-gate-btn" onClick={handleGoogleLogin}>
            <svg className="auth-gate-google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(255,255,255,0.9)"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.9)"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgba(255,255,255,0.9)"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.9)"/>
            </svg>
            Continue with Google
          </button>

          <button className="auth-gate-btn-cancel" onClick={onCancel}>
            Maybe later
          </button>

          <div className="auth-gate-privacy">
            By continuing you agree to our terms. We never share your data.
          </div>
        </div>
      </div>
    </>
  )
}
