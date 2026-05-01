import { useSearchParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'

const PLANS = [
  {
    id: 'trial',
    name: 'Free Trial',
    priceLabel: 'Free',
    desc: 'Experience AI English learning',
    features: [
      '1 personalised AI demo lesson',
      'Calibration quiz',
      'Speaking confidence check',
      'No credit card required',
    ],
    cta: 'Demo included',
    highlight: false,
  },
  {
    id: 'monthly',
    name: 'Monthly',
    priceLabel: 'Plans launching soon',
    desc: 'Full AI lesson access',
    features: [
      'Unlimited AI voice lessons',
      'Personalised grammar tracking',
      'Real textbook integration',
      'Speaking confidence builder',
      'Progress dashboard',
    ],
    cta: 'Notify me',
    highlight: true,
  },
  {
    id: 'annual',
    name: 'Annual',
    priceLabel: 'Plans launching soon',
    desc: 'Best value — save over 20%',
    features: [
      'Everything in Monthly',
      'Priority AI response speed',
      'Lesson history archive',
      'Early access to new features',
    ],
    cta: 'Notify me',
    highlight: false,
  },
]

const ALL_FEATURES = [
  'Unlimited AI voice lessons',
  'Personalised grammar & vocabulary tracking',
  'Real textbook integration (Focus B1 / B2)',
  'Speaking confidence builder with feedback',
  'Progress dashboard & lesson history',
]

export default function PricingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [toastVisible, setToastVisible] = useState(false)

  const fromDemo = searchParams.get('from') === 'demo_used'

  const handleNotifyClick = () => {
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] px-4 py-12">
      <div className="w-full max-w-[900px] mx-auto">

        {fromDemo && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 animate-fade-up">
            <div className="text-2xl">🎓</div>
            <div>
              <div className="text-sm font-semibold text-green-800">Your free demo is complete!</div>
              <div className="text-xs text-green-600 mt-0.5">
                You experienced personalised AI English learning. Choose a plan below to continue.
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Choose your AI English plan</h1>
          <p className="text-gray-500 text-base">
            Full access launching soon. Plans are listed below so you can compare before they go live.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`bg-white rounded-3xl shadow-lg overflow-hidden flex flex-col ${plan.highlight ? 'ring-2 ring-[#4f6ef7]' : ''}`}
            >
              <div className={`h-1.5 ${plan.highlight ? 'bg-gradient-to-r from-[#4f6ef7] via-[#818cf8] to-[#a78bfa]' : 'bg-gray-100'}`} />

              <div className="p-6 flex flex-col flex-1">
                {plan.highlight && (
                  <div className="mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#4f6ef7] bg-blue-50 px-2.5 py-1 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}
                <div className="text-lg font-bold text-gray-900 mb-1">{plan.name}</div>
                <div className="text-xl font-bold text-gray-800 mb-1">{plan.priceLabel}</div>
                <div className="text-xs text-gray-400 mb-5">{plan.desc}</div>

                <div className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600 leading-snug">{f}</span>
                    </div>
                  ))}
                </div>

                {plan.id === 'trial' ? (
                  <button
                    onClick={() => navigate('/demo/setup')}
                    className="w-full py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    {fromDemo ? 'Demo used' : 'Try the demo'}
                  </button>
                ) : (
                  <button
                    onClick={handleNotifyClick}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white hover:from-[#3451d1] hover:to-[#4f6ef7] shadow-md'
                        : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {toastVisible && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl animate-fade-up z-50 whitespace-nowrap">
            Payment is coming soon — we'll notify you when plans launch.
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">What's included in full access</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-[#4f6ef7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-6">
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to home
          </button>
        </div>

      </div>
    </div>
  )
}
