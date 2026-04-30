import { useParams, useNavigate } from 'react-router-dom'

export default function DemoClassroomPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center bg-white rounded-3xl shadow-xl p-10 animate-modal-in">
        <div className="text-5xl mb-5">🚀</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Demo Lesson Engine</h1>
        <p className="text-sm text-gray-500 mb-2">
          Your personalised AI lesson has been configured and saved.
        </p>
        <p className="text-xs text-gray-400 font-mono break-all mb-8">Session: {id}</p>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 mb-5">
          The voice lesson engine is coming soon. You'll be notified when it launches.
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full py-3 px-6 bg-cls-accent text-white rounded-2xl text-sm font-semibold hover:bg-[#3451d1] transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}
