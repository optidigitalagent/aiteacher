import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setStoredToken, consumeStoredReturnTo } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

const PENDING_TELEGRAM_TOKEN_KEY = 'pendingTelegramLinkToken'

function isSafeReturnTo(raw: string | null): raw is string {
  if (!raw) return false
  const t = raw.trim()
  if (!t.startsWith('/')) return false
  if (t.startsWith('//')) return false
  if (t.includes('://')) return false
  return true
}

function resolveReturnTo(urlParam: string | null): string {
  // 1. returnTo from backend OAuth callback URL (most authoritative)
  if (isSafeReturnTo(urlParam)) return urlParam

  // 2. returnTo saved to sessionStorage just before OAuth redirect started
  const fromStorage = consumeStoredReturnTo()
  if (isSafeReturnTo(fromStorage)) return fromStorage

  // 3. pendingTelegramLinkToken fallback — covers the case where returnTo
  //    was lost entirely but the user came from /tg-connect
  const tgToken = sessionStorage.getItem(PENDING_TELEGRAM_TOKEN_KEY)
  if (tgToken) {
    console.log('[auth] no returnTo found, falling back to pendingTelegramLinkToken')
    return `/tg-connect?token=${encodeURIComponent(tgToken)}`
  }

  // 4. Default
  return '/demo/setup'
}

export default function AuthCallbackPage() {
  const navigate       = useNavigate()
  const { refreshUser } = useAuth()

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const token    = params.get('token')
    const returnTo = resolveReturnTo(params.get('returnTo'))

    if (token) {
      setStoredToken(token)
      console.log('[auth] token stored, initialising session...')
      refreshUser().then(() => {
        console.log('[auth] session ready, redirecting to returnTo:', returnTo)
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
