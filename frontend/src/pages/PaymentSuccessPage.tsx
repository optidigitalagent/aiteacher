import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type PageStatus = 'checking' | 'active' | 'pending' | 'failed'

export default function PaymentSuccessPage() {
  const { profile, refreshUser, isAuthLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<PageStatus>('checking')
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (isAuthLoading) return

    async function check() {
      await refreshUser()
      setAttempts((n) => n + 1)
    }

    void check()
  }, [isAuthLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return

    if (profile.subscriptionStatus === 'active') {
      setStatus('active')
      return
    }

    // Poll up to 8 times (≈ 16 seconds) waiting for callback to arrive
    if (attempts < 8) {
      const timer = setTimeout(async () => {
        await refreshUser()
        setAttempts((n) => n + 1)
      }, 2000)
      return () => clearTimeout(timer)
    }

    setStatus(attempts >= 8 ? 'pending' : 'checking')
  }, [profile, attempts, refreshUser])

  useEffect(() => {
    if (profile?.subscriptionStatus === 'active') setStatus('active')
  }, [profile?.subscriptionStatus])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center">

        {status === 'checking' && (
          <>
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
              <div className="w-7 h-7 border-4 border-[#4f6ef7] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirming payment…</h2>
            <p className="text-sm text-gray-500">Please wait while we verify your payment with LiqPay.</p>
          </>
        )}

        {status === 'active' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5 text-2xl">
              ✓
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Subscription active!</h2>
            <p className="text-sm text-gray-500 mb-6">
              You have {profile?.paidMinutesRemaining ?? profile?.paidMinutesLimit ?? 500} minutes
              available across {profile?.paidLessonsLimit ?? 10} lessons this month.
            </p>
            <button
              onClick={() => navigate('/learning')}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white hover:from-[#3451d1] hover:to-[#4f6ef7] shadow-md transition-all"
            >
              Start learning
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-14 h-14 rounded-full bg-yellow-50 flex items-center justify-center mx-auto mb-5 text-2xl">
              ⏳
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment confirmation pending</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your payment was received but confirmation is still processing. This usually takes
              under a minute. Check back shortly or contact support if this persists.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => { setStatus('checking'); setAttempts(0) }}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-[#4f6ef7] text-white hover:bg-[#3451d1] transition-colors"
              >
                Check again
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Back to pricing
              </button>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5 text-2xl">
              ✕
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment not confirmed</h2>
            <p className="text-sm text-gray-500 mb-6">
              We could not confirm your payment. No charge was made or the payment was cancelled.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white hover:from-[#3451d1] hover:to-[#4f6ef7] shadow-md transition-all"
            >
              Back to pricing
            </button>
          </>
        )}

      </div>
    </div>
  )
}
