import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md animate-fade-up">
        <div className="text-6xl mb-5">🤖</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">AI English Teacher</h1>
        <p className="text-gray-500 mb-10 text-sm leading-relaxed max-w-xs mx-auto">
          A voice-first AI lesson that feels like a real tutor — personalised, Socratic, and built for teenagers.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => navigate('/demo/setup')}
            className="w-full max-w-xs py-4 px-8 bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:from-[#3451d1] hover:to-[#4f6ef7] transition-all duration-200 text-sm"
          >
            🎯 Start my free AI demo lesson
          </button>
          <button
            onClick={() => navigate('/lesson')}
            className="w-full max-w-xs py-3 px-8 border-2 border-gray-200 text-gray-500 font-medium rounded-2xl text-sm hover:border-cls-accent hover:text-cls-accent transition-all duration-200"
          >
            Continue existing lesson
          </button>
        </div>
      </div>
    </div>
  )
}
