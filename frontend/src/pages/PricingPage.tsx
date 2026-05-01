import { useNavigate } from 'react-router-dom'

const FEATURES = [
  'Unlimited AI voice lessons',
  'Personalised grammar & vocabulary tracking',
  'Real textbook integration (Focus B1 / B2)',
  'Speaking confidence builder with feedback',
  'Progress dashboard & lesson history',
]

export default function PricingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-up">
          <div className="h-1.5 bg-gradient-to-r from-[#4f6ef7] via-[#818cf8] to-[#a78bfa]" />

          <div className="p-8 text-center">
            <div className="text-5xl mb-4">🎓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Loved your demo?</h1>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Your free demo is complete. Unlock the full AI English lesson experience.
            </p>

            <div className="text-left space-y-3.5 mb-8">
              {FEATURES.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            <button
              className="w-full py-4 bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:from-[#3451d1] hover:to-[#4f6ef7] transition-all duration-200 text-sm tracking-wide mb-3"
              onClick={() => {/* payment flow to be connected */}}
            >
              🚀 Get full access
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Back to home
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
