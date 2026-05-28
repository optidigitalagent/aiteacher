import { useState, useRef, useEffect } from 'react'
import type { CharacterState } from '../hooks/useCharacterVideoState'

// ── Asset paths ───────────────────────────────────────────────────────────────
// Dance videos play with audio (Phase 7.13D). Teacher TTS is gated behind dance
// completion (Phase 7.13C), so no TTS overlap is possible. If autoplay policy
// blocks unmuted playback, the effect retries muted so the dance gate still fires.
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

// Opacity-based show/hide with crossfade transition — prevents blank frames during switches.
// pointerEvents:none on hidden elements avoids blocking interactions.
function vidStyle(active: boolean): React.CSSProperties {
  return {
    position:      'absolute',
    inset:         0,
    width:         '100%',
    height:        '100%',
    objectFit:     'contain',
    borderRadius:  'inherit',
    opacity:       active ? 1 : 0,
    transition:    'opacity 0.12s ease',
    zIndex:        active ? 1 : 0,
    pointerEvents: active ? 'auto' : 'none',
  }
}

export default function CharacterVideoPanel({ state, danceIndex, onDanceEnded }: CharacterVideoPanelProps) {
  const listeningRef = useRef<HTMLVideoElement | null>(null)
  const speakingRef  = useRef<HTMLVideoElement | null>(null)
  const thinkingRef  = useRef<HTMLVideoElement | null>(null)
  const dance0Ref    = useRef<HTMLVideoElement | null>(null)
  const dance1Ref    = useRef<HTMLVideoElement | null>(null)
  const dance2Ref    = useRef<HTMLVideoElement | null>(null)

  // Phase 7.13C: thinking.mp4 fallback — if file is missing, silently use listening.mp4.
  // Uses a ref to guard the one-time log + state to trigger a re-render for correct activeEl.
  const thinkingErrorLoggedRef = useRef(false)
  const [thinkingFailed, setThinkingFailed] = useState(false)

  // Store latest callback in ref so onEnded/onError handlers never hold stale closures.
  const onDanceEndedRef = useRef(onDanceEnded)
  useEffect(() => { onDanceEndedRef.current = onDanceEnded }, [onDanceEnded])

  // ── Playback control ───────────────────────────────────────────────────────
  useEffect(() => {
    const isDance = state === 'celebrating'

    const loopRefs  = [listeningRef, speakingRef, thinkingRef]
    const danceRefs = [dance0Ref, dance1Ref, dance2Ref]
    const allRefs   = [...loopRefs, ...danceRefs]

    // Determine which element should be active.
    // thinking fallback: if thinking.mp4 errored, use listeningRef instead.
    let activeEl: HTMLVideoElement | null = null
    if (isDance) {
      activeEl = danceIndex === 0 ? dance0Ref.current
               : danceIndex === 1 ? dance1Ref.current
               : dance2Ref.current
    } else {
      if (state === 'speaking') {
        activeEl = speakingRef.current
      } else if (state === 'thinking' && !thinkingFailed) {
        activeEl = thinkingRef.current
      } else {
        // listening state OR thinking fallback
        activeEl = listeningRef.current
      }
    }

    // Pause every non-active video except listeningRef — keeping listening always
    // running prevents a blank frame when returning from dance/speaking to listening.
    for (const ref of allRefs) {
      if (ref.current && ref.current !== activeEl && ref.current !== listeningRef.current && !ref.current.paused) {
        ref.current.pause()
      }
    }

    if (!activeEl) return

    console.log(`[character_video_play_started] state=${state}`)

    if (isDance) {
      // Phase 7.13D: dance plays with sound. Muted fallback keeps gate alive if
      // autoplay policy blocks unmuted playback (e.g. iOS before user gesture).
      activeEl.currentTime = 0
      activeEl.muted = false
      activeEl.volume = 1
      console.log(`[character_dance_audio_enabled] danceIndex=${danceIndex}`)
      activeEl.play().then(() => {
        console.log(`[character_video_transition_ready] state=${state}`)
      }).catch((err: unknown) => {
        const reason = err instanceof Error ? err.name : String(err)
        console.log(`[character_dance_audio_play_rejected] reason=${reason}`)
        // Autoplay policy blocked unmuted — retry muted so dance gate still fires.
        activeEl!.muted = true
        console.log(`[character_dance_audio_fallback_muted] danceIndex=${danceIndex}`)
        activeEl!.play().then(() => {
          console.log(`[character_video_transition_ready] state=${state} muted=fallback`)
        }).catch((err2: unknown) => {
          const reason2 = err2 instanceof Error ? err2.name : String(err2)
          console.log(`[character_video_play_failed] state=${state} reason=${reason2}`)
          // Phase 7.13C: resolves gate to prevent teacher TTS deadlock.
          onDanceEndedRef.current()
        })
      })
    } else {
      activeEl.play().then(() => {
        console.log(`[character_video_transition_ready] state=${state}`)
      }).catch((err: unknown) => {
        const reason = err instanceof Error ? err.name : String(err)
        console.log(`[character_video_play_failed] state=${state} reason=${reason}`)
      })
    }
  }, [state, danceIndex, thinkingFailed]) // eslint-disable-line react-hooks/exhaustive-deps
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

      {/* Listening — always plays (never paused); crossfades in when active */}
      <video
        ref={listeningRef}
        src={ASSETS.listening}
        loop muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=listening')}
        onError={() => console.log('[character_video_play_failed] state=listening reason=load_error')}
        style={vidStyle(!isDance && (state === 'listening' || (state === 'thinking' && thinkingFailed)))}
      />
      <video
        ref={speakingRef}
        src={ASSETS.speaking}
        loop muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=speaking')}
        onError={() => console.log('[character_video_play_failed] state=speaking reason=load_error')}
        style={vidStyle(!isDance && state === 'speaking')}
      />
      {/* Phase 7.13C: thinking fallback — if thinking.mp4 is missing, silently show listening */}
      <video
        ref={thinkingRef}
        src={ASSETS.thinking}
        loop muted playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=thinking')}
        onError={() => {
          if (!thinkingErrorLoggedRef.current) {
            thinkingErrorLoggedRef.current = true
            console.log('[character_asset_missing] state=thinking fallback=listening')
            setThinkingFailed(true)
          }
        }}
        style={vidStyle(!isDance && state === 'thinking' && !thinkingFailed)}
      />

      {/* Dance 1 — one-shot, audio enabled (Phase 7.13D); muted controlled imperatively */}
      <video
        ref={dance0Ref}
        src={ASSETS.dance[0]}
        playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=dance1')}
        onError={() => {
          console.log('[character_video_play_failed] state=dance1 reason=load_error')
          onDanceEndedRef.current()
        }}
        onEnded={() => onDanceEndedRef.current()}
        style={vidStyle(isDance && danceIndex === 0)}
      />
      {/* Dance 2 */}
      <video
        ref={dance1Ref}
        src={ASSETS.dance[1]}
        playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=dance2')}
        onError={() => {
          console.log('[character_video_play_failed] state=dance2 reason=load_error')
          onDanceEndedRef.current()
        }}
        onEnded={() => onDanceEndedRef.current()}
        style={vidStyle(isDance && danceIndex === 1)}
      />
      {/* Dance 3 */}
      <video
        ref={dance2Ref}
        src={ASSETS.dance[2]}
        playsInline preload="auto"
        onLoadedData={() => console.log('[character_video_loaded] state=dance3')}
        onError={() => {
          console.log('[character_video_play_failed] state=dance3 reason=load_error')
          onDanceEndedRef.current()
        }}
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
