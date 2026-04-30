import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setStoredToken } from '../lib/auth'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const token    = params.get('token')
    const returnTo = params.get('returnTo') ?? '/demo/setup'

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
      </div>
    </div>
  )
}
