import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredToken } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

type UserState = 'loading' | 'guest' | 'demo_available' | 'demo_used'

interface MeResponse {
  demoUsed?: boolean
}

export default function HomePage() {
  const navigate = useNavigate()
  const [userState, setUserState] = useState<UserState>('loading')

  useEffect(() => {
    const token = getStoredToken()
    if (!token) { setUserState('guest'); return }

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() as Promise<MeResponse> : Promise.reject())
      .then(data => setUserState(data.demoUsed ? 'demo_used' : 'demo_available'))
      .catch(() => setUserState('guest'))
  }, [])

  const handleMainCTA = () => {
    if (userState === 'demo_used') {
      navigate('/pricing')
    } else {
      navigate('/demo/setup')
    }
  }

  const isLoading = userState === 'loading'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md animate-fade-up">
        <div className="text-6xl mb-5">🤖</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">AI English Teacher</h1>
        <p className="text-gray-500 mb-10 text-sm leading-relaxed max-w-xs mx-auto">
          A voice-first AI lesson that feels like a real tutor — personalised, Socratic, and built for teenagers.
        </p>

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={handleMainCTA}
            disabled={isLoading}
            className="w-full max-w-xs py-4 px-8 bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:from-[#3451d1] hover:to-[#4f6ef7] transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-default"
          >
            {isLoading
              ? '...'
              : userState === 'demo_used'
                ? '🚀 Unlock full AI lessons'
                : '🎯 Start my free AI demo lesson'
            }
          </button>

          <button
            onClick={() => navigate('/lesson')}
            className="w-full max-w-xs py-3 px-8 border-2 border-gray-200 text-gray-500 font-medium rounded-2xl text-sm hover:border-cls-accent hover:text-cls-accent transition-all duration-200"
          >
            Continue existing lesson
          </button>
        </div>
      </div>
    </div>
  )
}
