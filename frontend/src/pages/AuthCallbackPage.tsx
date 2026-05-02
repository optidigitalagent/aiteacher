import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setStoredToken } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

function safeReturnTo(raw: string | null): string {
  if (!raw) return '/demo/setup'
  const t = raw.trim()
  if (!t.startsWith('/')) return '/demo/setup'
  if (t.startsWith('//')) return '/demo/setup'
  if (t.includes('://')) return '/demo/setup'
  return t
}

export default function AuthCallbackPage() {
  const navigate    = useNavigate()
  const { refreshUser } = useAuth()

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const token    = params.get('token')
    const returnTo = safeReturnTo(params.get('returnTo'))

    if (token) {
      // 1. persist token to localStorage
      setStoredToken(token)
      console.log('[auth] token stored, initialising session...')
      // 2. populate AuthContext React state (user/profile/token) BEFORE
      //    navigating so the target page already sees isAuthenticated=true
      refreshUser().then(() => {
        console.log('[auth] session ready, redirecting to', returnTo)
        navigate(returnTo, { replace: true })
      })
    } else {
      navigate('/', { replace: true })
    }
  }, [navigate, refreshUser])

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <div className="text-center">
        <div className="flex gap-2 justify-center mb-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-cls-accent animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
    </div>
  )
}
