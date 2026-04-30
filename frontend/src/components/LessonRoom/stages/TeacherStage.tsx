import type { Message } from '../../../hooks/useLesson'

interface TeacherStageProps {
  lastTeacherMessage: Message | null
  isTeacherSpeaking:  boolean
  isConfusionLoading: boolean
}

export function TeacherStage({
  lastTeacherMessage,
  isTeacherSpeaking,
  isConfusionLoading,
}: TeacherStageProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
      {lastTeacherMessage ? (
        <div className="max-w-2xl w-full animate-fade-up">
          {/* Speech bubble card */}
          <div className="bg-white rounded-2xl shadow-sm border border-[rgba(0,0,0,0.07)] p-8">
            <p className={`
              text-xl leading-relaxed font-light text-gray-900
              transition-opacity duration-300
              ${isTeacherSpeaking ? 'opacity-100' : 'opacity-80'}
            `}>
              {lastTeacherMessage.displayText ?? lastTeacherMessage.text}
            </p>

            {/* Speaking indicator */}
            {isTeacherSpeaking && (
              <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-gray-100">
                <span className="w-1.5 h-1.5 rounded-full bg-cls-accent animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cls-accent animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cls-accent animate-bounce [animation-delay:240ms]" />
                <span className="text-xs text-gray-500 ml-1">Alex is speaking</span>
              </div>
            )}
          </div>
        </div>
      ) : isConfusionLoading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Alex is preparing an explanation…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400">
              <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2.5 14.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm text-gray-400">Waiting for Alex…</p>
        </div>
      )}
    </div>
  )
}
