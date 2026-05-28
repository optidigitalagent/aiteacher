import { useRef, useEffect } from 'react'
import type { CharacterState } from '../hooks/useCharacterVideoState'

// ── Asset paths ───────────────────────────────────────────────────────────────
// Place video files in /public/character/ and update these paths to match
// your actual filenames (e.g. "listens.mp4", "speaking.webm", etc.).
// If a file is missing the <video> silently shows nothing — lesson TTS and
// mic are completely unaffected.
//
// Dance videos are kept MUTED to prevent audio overlap with teacher TTS.
// The teacher audio queue runs immediately after a step is accepted, so
// unmuted dance would overlap with the next teacher message. Implement
// sound coordination via the teacherMessageChain if needed in the future.
const ASSETS = {
  listening: '/character/listening.mp4',
  speaking:  '/character/speaking.mp4',
  thinking:  '/character/thinking.mp4',
  dance: [
    '/character/dance1.mp4',
    '/character/dance2.mp4',
    '/character/dance3.mp4',
  ] as const,
}

export interface CharacterVideoPanelProps {
  state:        CharacterState
  danceIndex:   number
  onDanceEnded: () => void
}

const STATE_COLOR: Record<CharacterState, string> = {
  listening:   '#22c55e',
  speaking:    '#6E7CFB',
  thinking:    '#9B8CFF',
  celebrating: '#f59e0b',
}

const STATE_LABEL: Record<CharacterState, string> = {
  listening:   'Listening',
  speaking:    'Speaking',
  thinking:    'Thinking…',
  celebrating: '🎉',
}

// Builds a style that shows/hides via visibility (keeps element in layout so
// play() works on all browsers including iOS Safari with display:none quirks).
function vidStyle(active: boolean): React.CSSProperties {
  return {
    position:    'absolute',
    inset:       0,
    width:       '100%',
    height:      '100%',
    objectFit:   'cover',
    borderRadius: 'inherit',
    visibility:  active ? 'visible' : 'hidden',
    zIndex:      active ? 1 : 0,
  }
}

export default function CharacterVideoPanel({ state, danceIndex, onDanceEnded }: CharacterVideoPanelProps) {
  const listeningRef = useRef<HTMLVideoElement | null>(null)
  const speakingRef  = useRef<HTMLVideoElement | null>(null)
  const thinkingRef  = useRef<HTMLVideoElement | null>(null)
  const dance0Ref    = useRef<HTMLVideoElement | null>(null)
  const dance1Ref    = useRef<HTMLVideoElement | null>(null)
  const dance2Ref    = useRef<HTMLVideoElement | null>(null)

  // Store latest callback in ref so onEnded handlers never hold stale closures.
  const onDanceEndedRef = useRef(onDanceEnded)
  useEffect(() => { onDanceEndedRef.current = onDanceEnded }, [onDanceEnded])

  // ── Playback control ───────────────────────────────────────────────────────
  useEffect(() => {
    const isDance = state === 'celebrating'

    const loopRefs  = [listeningRef, speakingRef, thinkingRef]
    const danceRefs = [dance0Ref, dance1Ref, dance2Ref]
    const allRefs   = [...loopRefs, ...danceRefs]

    // Determine which element should be active
    let activeEl: HTMLVideoElement | null = null
    if (isDance) {
      activeEl = danceIndex === 0 ? dance0Ref.current
               : danceIndex === 1 ? dance1Ref.current
               : dance2Ref.current
    } else {
      activeEl = state === 'speaking'  ? speakingRef.current
               : state === 'thinking'  ? thinkingRef.current
               : listeningRef.current
    }

    // Pause every video except the active one
    for (const ref of allRefs) {
      if (ref.current && ref.current !== activeEl && !ref.current.paused) {
        ref.current.pause()
      }
    }

    if (!activeEl) return

    // Dance: always restart from the beginning for a clean one-shot
    if (isDance) {
      activeEl.currentTime = 0
    }

    console.log(`[character_video_play_started] state=${state}`)
    activeEl.play().catch((err: unknown) => {
      const reason = err instanceof Error ? err.name : String(err)
      console.log(`[character_video_play_failed] state=${state} reason=${reason}`)
    })
  }, [state, danceIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  // (refs are stable — intentionally omitted from deps)

  const isDance = state === 'celebrating'
  const color   = STATE_COLOR[state]
  const label   = STATE_LABEL[state]

  return (
    <div style={{
      width:                '100%',
      height:               '100%',
      position:             'relative',
      borderRadius:         22,
      overflow:             'hidden',
      background:           'rgba(255,248,240,0.72)',
      backdropFilter:       'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      boxShadow:            '0 2px 0 rgba(255,255,255,0.9) inset, 0 12px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(110,124,251,0.06)',
      border:               '1px solid rgba(255,255,255,0.65)',
    }}>

      {/* Looping states — muted autoplay */}
      <video
        ref={listeningRef}
        src={ASSETS.listening}
        loop muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=listening')}
        onError={() => console.log('[character_video_play_failed] state=listening reason=load_error')}
        style={vidStyle(!isDance && state === 'listening')}
      />
      <video
        ref={speakingRef}
        src={ASSETS.speaking}
        loop muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=speaking')}
        onError={() => console.log('[character_video_play_failed] state=speaking reason=load_error')}
        style={vidStyle(!isDance && state === 'speaking')}
      />
      <video
        ref={thinkingRef}
        src={ASSETS.thinking}
        loop muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=thinking')}
        onError={() => console.log('[character_video_play_failed] state=thinking reason=load_error')}
        style={vidStyle(!isDance && state === 'thinking')}
      />

      {/* Dance 1 — one-shot, muted (avoids TTS overlap, see ASSETS comment above) */}
      <video
        ref={dance0Ref}
        src={ASSETS.dance[0]}
        muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=dance1')}
        onError={() => console.log('[character_video_play_failed] state=dance1 reason=load_error')}
        onEnded={() => onDanceEndedRef.current()}
        style={vidStyle(isDance && danceIndex === 0)}
      />
      {/* Dance 2 */}
      <video
        ref={dance1Ref}
        src={ASSETS.dance[1]}
        muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=dance2')}
        onError={() => console.log('[character_video_play_failed] state=dance2 reason=load_error')}
        onEnded={() => onDanceEndedRef.current()}
        style={vidStyle(isDance && danceIndex === 1)}
      />
      {/* Dance 3 */}
      <video
        ref={dance2Ref}
        src={ASSETS.dance[2]}
        muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=dance3')}
        onError={() => console.log('[character_video_play_failed] state=dance3 reason=load_error')}
        onEnded={() => onDanceEndedRef.current()}
        style={vidStyle(isDance && danceIndex === 2)}
      />

      {/* State badge — bottom overlay */}
      <div style={{
        position:      'absolute',
        bottom:        10,
        left:          0,
        right:         0,
        display:       'flex',
        justifyContent:'center',
        zIndex:        2,
        pointerEvents: 'none',
      }}>
        <div style={{
          background:   `${color}22`,
          border:       `1px solid ${color}44`,
          borderRadius: 99,
          padding:      '4px 12px',
          display:      'flex',
          alignItems:   'center',
          gap:          5,
          backdropFilter:       'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width:       6,
            height:      6,
            borderRadius:'50%',
            background:  color,
            animation:   'cls-halo-breathe 1.5s ease-in-out infinite',
            flexShrink:  0,
          }} />
          <span style={{ fontSize: 11, color, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
