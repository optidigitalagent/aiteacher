import { redirectToGoogleAuth } from '../../lib/auth'

interface Props {
  onBack: () => void
}

export default function AuthGate({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center animate-modal-in">

        <div className="w-16 h-16 rounded-2xl bg-cls-accent-lgt flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-cls-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to start your lesson</h2>
        <p className="text-sm text-gray-500 mb-7">
          Your AI lesson is configured and ready. Sign in with Google to begin — it takes 10 seconds.
        </p>

        <button
          onClick={() => redirectToGoogleAuth('/demo/setup')}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-6 border-2 border-gray-200 rounded-2xl hover:border-cls-accent hover:bg-cls-accent-lgt transition-all duration-200 font-semibold text-gray-700 text-sm mb-3"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Go back and edit choices
        </button>

        <p className="mt-6 text-xs text-gray-400">
          No credit card required · One free demo lesson per account
        </p>
      </div>
    </div>
  )
}
