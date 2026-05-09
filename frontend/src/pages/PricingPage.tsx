import { useSearchParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getStoredToken } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const PLAN_FEATURES = [
  '10 full AI lessons per month',
  '50 minutes per lesson',
  '500 total lesson minutes',
  'Personalised grammar tracking',
  'Real textbook integration (Focus B1)',
  'Speaking confidence builder',
]

function FeatureCheck({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-sm text-gray-700 leading-snug">{text}</span>
    </div>
  )
}

function ReasonBanner({ reason }: { reason: string | null }) {
  if (!reason) return null
  const messages: Record<string, { icon: string; title: string; body: string }> = {
    required:     { icon: '🔒', title: 'Subscription required', body: 'Purchase a plan to start your first paid lesson.' },
    expired:      { icon: '⏰', title: 'Subscription expired',  body: 'Your plan has ended. Renew to continue learning.' },
    limit_reached:{ icon: '📚', title: 'Lesson minutes used',   body: 'You have used all lesson minutes this month. Renew to continue.' },
  }
  const msg = messages[reason]
  if (!msg) return null
  return (
    <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
      <div className="text-2xl">{msg.icon}</div>
      <div>
        <div className="text-sm font-semibold text-amber-800">{msg.title}</div>
        <div className="text-xs text-amber-600 mt-0.5">{msg.body}</div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { isAuthenticated, isAuthLoading, profile } = useAuth()

  const fromDemo = searchParams.get('from') === 'demo_used'
  const reason   = searchParams.get('reason')

  const [paying, setPaying] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const isActive = profile?.subscriptionStatus === 'active'

  async function handlePayClick() {
    if (!isAuthenticated) {
      // Redirect to Google auth, returning to pricing after login
      const returnTo = encodeURIComponent('/pricing')
      window.location.href = `${API_BASE}/auth/google?returnTo=${returnTo}`
      return
    }

    setPaying(true)
    setError(null)

    try {
      const token = getStoredToken()
      const res = await fetch(`${API_BASE}/billing/liqpay/create`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Server error ${res.status}`)
      }

      const { data, signature } = await res.json() as { data: string; signature: string }

      // Submit form to LiqPay checkout — standard LiqPay v3 integration
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = 'https://www.liqpay.ua/api/3/checkout'
      form.acceptCharset = 'utf-8'

      const dataInput = document.createElement('input')
      dataInput.type  = 'hidden'
      dataInput.name  = 'data'
      dataInput.value = data
      form.appendChild(dataInput)

      const sigInput = document.createElement('input')
      sigInput.type  = 'hidden'
      sigInput.name  = 'signature'
      sigInput.value = signature
      form.appendChild(sigInput)

      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      console.error('[pricing] payment error:', err)
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
      setPaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] px-4 py-12">
      <div className="w-full max-w-[820px] mx-auto">

        {fromDemo && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3">
            <div className="text-2xl">🎓</div>
            <div>
              <div className="text-sm font-semibold text-green-800">Your free demo is complete!</div>
              <div className="text-xs text-green-600 mt-0.5">
                You experienced personalised AI English learning. Subscribe below to continue.
              </div>
            </div>
          </div>
        )}

        <ReasonBanner reason={reason} />

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">AI English — Monthly Plan</h1>
          <p className="text-gray-500 text-base">
            10 full AI lessons · 50 min each · 500 total minutes · 31 days
          </p>
        </div>

        {/* Pricing card */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-8 ring-2 ring-[#4f6ef7]">
          <div className="h-1.5 bg-gradient-to-r from-[#4f6ef7] via-[#818cf8] to-[#a78bfa]" />
          <div className="p-8">
            <div className="flex items-end gap-3 mb-2">
              <span className="text-5xl font-extrabold text-gray-900">1</span>
              <span className="text-2xl font-bold text-gray-500 mb-1">UAH</span>
              <span className="text-sm text-gray-400 mb-2">/ month</span>
              <span className="ml-2 mb-2 px-2.5 py-1 bg-blue-50 text-[#4f6ef7] text-xs font-bold rounded-full">
                TEST PRICE
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-8">Full AI lesson access for one month</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {PLAN_FEATURES.map((f) => <FeatureCheck key={f} text={f} />)}
            </div>

            {isActive ? (
              <div className="w-full py-4 rounded-xl font-semibold text-sm bg-green-50 text-green-700 border border-green-200 text-center">
                Your subscription is active — {profile?.paidMinutesRemaining ?? 0} minutes remaining
              </div>
            ) : (
              <button
                onClick={handlePayClick}
                disabled={paying || isAuthLoading}
                className="w-full py-4 rounded-xl font-semibold text-base bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white hover:from-[#3451d1] hover:to-[#4f6ef7] shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {paying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Redirecting to LiqPay…
                  </span>
                ) : isAuthenticated ? (
                  'Pay with LiqPay — 1 UAH'
                ) : (
                  'Sign in to pay'
                )}
              </button>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-4">
              Secure payment via LiqPay. Subscription activates automatically after payment confirmation.
            </p>
          </div>
        </div>

        {/* Free trial card */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-6">
          <div className="h-1.5 bg-gray-100" />
          <div className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
              🎓
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-gray-900">Free Trial — Demo lesson</div>
              <div className="text-xs text-gray-500 mt-0.5">1 personalised AI lesson · No credit card required</div>
            </div>
            <button
              onClick={() => navigate('/demo/setup')}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
            >
              {fromDemo ? 'Demo used' : 'Try free'}
            </button>
          </div>
        </div>

        <div className="text-center">
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to home
          </button>
        </div>

      </div>
    </div>
  )
}
