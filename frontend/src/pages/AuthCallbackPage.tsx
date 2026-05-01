<<<<<<< HEAD
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setStoredToken } from '../lib/auth'

function safeReturnTo(raw: string | null): string {
  if (!raw) return '/demo/setup'
  const t = raw.trim()
  if (!t.startsWith('/')) return '/demo/setup'
  if (t.startsWith('//')) return '/demo/setup'
  if (t.includes('://')) return '/demo/setup'
  return t
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const token    = params.get('token')
    const returnTo = safeReturnTo(params.get('returnTo'))

    if (token) {
      setStoredToken(token)
      navigate(returnTo, { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [navigate])

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
=======
// Handles the redirect from Google OAuth.
// URL: /auth/callback?token=<jwt>
// Stores the token, then restores previous setup state and redirects to /learning.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { storeToken, useAuth } from '../context/AuthContext'
import { loadSetupState, clearSetupState } from '../components/shared/AuthGate'

export default function AuthCallbackPage() {
  const navigate     = useNavigate()
  const { refreshUser } = useAuth()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')

    async function processLogin() {
      console.log('[auth] callback token found:', !!token)
      if (token) {
        storeToken(token)
        // Sync auth context state before navigating — without this the user
        // appears logged-out at /learning until a hard page reload.
        await refreshUser()
      }

      const setup = loadSetupState()
      clearSetupState()

      if (setup) {
        navigate('/learning', { replace: true, state: { restoredSetup: setup } })
      } else {
        navigate('/learning', { replace: true })
      }
    }

    processLogin()
  }, [navigate, refreshUser])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'linear-gradient(160deg,#FFF9F3,#F6F4FF,#FFF4EE)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid #E6EAF2', borderTopColor: '#7B8CFF',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ fontSize: 15, color: '#64748B', fontWeight: 500 }}>Signing you in…</div>
>>>>>>> production/main
      </div>
    </div>
  )
}
