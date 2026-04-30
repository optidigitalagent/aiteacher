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
      </div>
    </div>
  )
}
