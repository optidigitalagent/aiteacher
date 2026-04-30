interface ExitModalProps {
  onStay:  () => void
  onLeave: () => void
}

// FUTURE: onLeave should call backend to save/pause lesson before navigating away
export function ExitModal({ onStay, onLeave }: ExitModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onStay}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-modal-in border border-[rgba(0,0,0,0.07)]">
        <div className="mb-5">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 3L17.5 17H2.5L10 3Z" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M10 9V12" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="10" cy="14.5" r="0.75" fill="#D97706"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1.5">Leave active lesson?</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            You are in an active lesson. If you leave now, this session may not be saved.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onStay}
            className="w-full py-2.5 rounded-xl bg-cls-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Stay in lesson
          </button>
          <button
            onClick={onLeave}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Leave lesson
          </button>
        </div>
      </div>
    </div>
  )
}
