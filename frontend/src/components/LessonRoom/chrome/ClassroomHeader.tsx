interface ClassroomHeaderProps {
  currentPhase:    string
  started:         boolean
  connectionState: string
  onRequestExit:   () => void
}

// FUTURE: section + grammar target come from route/session params
export function ClassroomHeader({
  connectionState,
  onRequestExit,
}: ClassroomHeaderProps) {
  return (
    <header className="flex-none h-14 flex items-center justify-between px-5 bg-white border-b border-[rgba(0,0,0,0.07)] z-50">

      {/* ── Left: logo ── */}
      <div className="flex items-center gap-2 w-44">
        <div className="w-7 h-7 rounded-lg bg-cls-accent flex items-center justify-center shadow-sm">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="5" r="2.5" fill="white" opacity="0.9"/>
            <path d="M2.5 12.5C2.5 10.015 4.74 8 7.5 8s5 2.015 5 4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-sm font-semibold text-gray-900 tracking-tight">AI Teacher</span>
      </div>

      {/* ── Center: section breadcrumb ── */}
      {/* FUTURE: replace hardcoded text with data from route/session */}
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <span className="font-semibold">Section 1.2</span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-500">Present Simple</span>
      </div>

      {/* ── Right: teacher mini + connection dot + exit ── */}
      <div className="flex items-center gap-3 w-44 justify-end">

        {/* Teacher mini avatar + name */}
        {/* FUTURE: replace with selected teacher image + name from session params */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#E9D9C8] overflow-hidden border border-gray-200 flex-none">
            <svg viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="#E9D9C8"/>
              <ellipse cx="14" cy="12" rx="5.5" ry="6.5" fill="#F5C090"/>
              <path d="M4 28c0-6 4.5-9 10-9s10 3 10 9" fill="#3D55C9"/>
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-600 hidden sm:inline">Alex</span>
        </div>

        {/* Connection indicator */}
        <div
          title={connectionState}
          className={`w-2 h-2 rounded-full flex-none transition-colors ${
            connectionState === 'connected'  ? 'bg-emerald-400' :
            connectionState === 'connecting' ? 'bg-amber-400 animate-pulse' :
            connectionState === 'error'      ? 'bg-red-400' :
                                               'bg-gray-300'
          }`}
        />

        {/* Exit button */}
        <button
          onClick={onRequestExit}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50"
          title="Exit lesson"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2H12v10H9M5 4.5L2.5 7 5 9.5M2.5 7H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="hidden sm:inline font-medium">Exit</span>
        </button>
      </div>
    </header>
  )
}
