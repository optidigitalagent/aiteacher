  186   * validates the paid session. The frontend
            should show "Begin Lesson" only
      187   * after receiving this event — not just on
            WS open.

● Update(backend\src\ws\message-types.ts)
  ⎿  Added 1 line
      285    | OutboundLessonResumed
      286    | OutboundStudentMessage
      287    | OutboundTeacherTurnEnd
      288 +  | OutboundVoiceUnavailable               
      289    | OutboundLessonReady
      290    | OutboundExerciseCursorUpdated
      291    | OutboundTipAdded

● Now update kidsTtsStream() and ttsStream() in lesson-ws.ts:

● Update(backend\src\ws\lesson-ws.ts)
  ⎿  Added 10 lines, removed 2 lines
      1470    meta.ttsController = new AbortController
            ()
      1471    try { prev?.abort() } catch { /* ignore 
            */ }
      1472    try {
      1473 -    await speakToClient(                  
      1473 +    const result = await speakToClient(   
      1474        (msg) => send(ws, msg),
      1475        text,
      1476        meta.ttsController.signal,
      1477        'nova',
      1478      )
      1479 +    if (!result.ok) {                     
      1480 +      console.warn(                       
      1481 +        `[kids:voice_degraded] sessionId=$
           +{meta.kidsSessionId ?? meta.sessionId} ` +
      1482 +        `reason=${result.reason} ttsChars=
           +${text.length} cooldownApplied=true`,     
      1483 +      )                                   
      1484 +      send(ws, { type: 'voice_unavailable'
           +, reason: result.reason })                
      1485 +    }                                     
      1486      send(ws, { type: 'teacher_turn_end' })
      1487    } catch (err: unknown) {
      1488 +    // Safety net: speakToClient should no
           +t throw, but guard against unexpected erro
           +rs.                                       
      1489      const isAbort = err instanceof Error &
            & err.name === 'AbortError'
      1482 -    if (!isAbort) console.error('[kids] TT
           -S error:', err instanceof Error ? err.mess
           -age : err)                                
      1490 +    if (!isAbort) console.error('[kids] TT
           +S unexpected error:', err instanceof Error
           + ? err.message : err)                     
      1491      send(ws, { type: 'teacher_turn_end' })
      1492    } finally {
      1493      meta.ttsActive = false

● Now update the adult ttsStream() to handle the new return
  type:

● Update(backend\src\ws\lesson-ws.ts)
  ⎿  Added 8 lines, removed 4 lines
      3064      severity:     'debug',
      3065    })
      3066    try {
      3067 -    await speakToClient(                  
      3067 +    const result = await speakToClient(   
      3068        (msg) => send(ws, msg),
      3069        text,
      3070        meta.ttsController.signal,
      3071        meta.voiceId ?? undefined,
      3072      )
      3073 -    console.log(`[paid-lesson] teacher_spe
           -aking end chars=${text.length}`)          
      3073 +    if (result.ok) {                      
      3074 +      console.log(`[paid-lesson] teacher_s
           +peaking end chars=${text.length}`)        
      3075 +    } else {                              
      3076 +      console.warn(`[tts:fallback] adult T
           +TS degraded reason=${result.reason} chars=
           +${text.length}`)                          
      3077 +    }                                     
      3078      // Signal frontend that all TTS audio
            has been sent for this turn.
      3079      // The client uses this to calculate a
            ccurate audio-queue completion time
      3080      // and disable the mic until the queue
            d audio actually finishes playing.
      3081      send(ws, { type: 'teacher_turn_end' })
      3082    } catch (err: unknown) {
      3083 +    // Safety net: speakToClient should no
           +t throw, but guard against unexpected erro
           +rs.                                       
      3084      const isAbort = err instanceof Error &
            & err.name === 'AbortError'
      3085      if (!isAbort) {
      3081 -      console.error('[ws] TTS error:', err
           - instanceof Error ? err.message : err)    
      3086 +      console.error('[ws] TTS unexpected e
           +rror:', err instanceof Error ? err.message
           + : err)                                   
      3087        // Send teacher_turn_end so the fron
            tend mic lifecycle completes even on TTS f
            ailure.
      3083 -      // Without this the frontend stays i
           -n isSpeaking=true forever and the mic neve
           -r enables.                                
      3088        send(ws, { type: 'teacher_turn_end' 
            })
      3089      }
      3090      // Do NOT send teacher_turn_end on abo
            rt — frontend already handles interruption

● Now add the minimal voice_unavailable handler to the Kids
  frontend:

● Update(frontend\src\pages\KidsClassroomPage.tsx)
  ⎿  Added 1 line
      736    const [progressCount, setProgressCount] =
            useState(0)
      737    const [errorMsg, setErrorMsg] = useState<
           string | null>(null)
      738    const [micPreflightDone, setMicPreflightD
           one] = useState(false)
      739 +  const [voiceUnavailable, setVoiceUnavaila
          +ble] = useState(false)                     
      740  
      741    // Refs for buffering before user taps "L
           et's Go"
      742    const wsRef            = useRef<WebSocket
            | null>(null)

● Update(frontend\src\pages\KidsClassroomPage.tsx)
  ⎿  Added 5 lines
      798          break 
      799        }
      800  
      801 +      case 'voice_unavailable': {          
      802 +        setVoiceUnavailable(true)          
      803 +        break                              
      804 +      }                                    
      805 +                                           
      806        case 'error':
      807        case 'runtime_error': {
      808          setErrorMsg(msg.message)

● Now add the voice unavailable notice to the JSX — small,
  non-blocking, near the audio indicator:

● Update(frontend\src\pages\KidsClassroomPage.tsx)
  ⎿  Added 6 lines
      984  
      985                <KidsProgressDots count={prog
           ressCount} />
      986  
      987 +              {voiceUnavailable && (       
      988 +                <p style={{ fontSize: 12, c
          +olor: '#94A3B8', margin: 0, textAlign: 'cen
          +ter' }}>                                   
      989 +                  Voice is temporarily unav
          +ailable. You can continue.                 
      990 +                </p>                       
      991 +              )}                           
      992 +                                           
      993                <KidsAudioIndicator state={ki
           dsState} />
      994              </div>
      995  

● Now write the test file:

● Write(backend\src\voice\__tests__\tts-fallback.test.ts)
  ⎿  Wrote 306 lines to
     backend\src\voice\__tests__\tts-fallback.test.ts
       2  * TTS Fallback Tests — Phase 16K
       3  *
         esult correctly and appliesent() returns TtsR
       5  * process-level provider cooldowns on quota/
         rate errors.
       7  * Each describe block uses vi.isolateModules
         () to get a fresh module instance
          / elevenLabsDisabled flags don'tiTtsDisabled
       9  * leak between test suites.
      10  */
     … +393 lines (ctrl+o to expand)

● Now build and run the tests:

● Bash(cd C:\Users\Admin\aiteacher\backend && npm run build
      2>&1 | tail -30)
  ⎿  Error: Exit code 1
     /usr/bin/bash: line 1: cd: C:UsersAdminaiteacherbackend:
     No such file or directory

● PowerShell(cd C:\Users\Admin\aiteacher\backend; npm run
            build 2>&1 | Select-Object -Last 40)
  ⎿  Error: Exit code 2
     > ai-teacher-backend@0.1.0 build
     > tsc --noEmit

     src/voice/__tests__/tts-fallback.test.ts(32,14): error 
     TS2339: Property 'isolateModules' does not exist on type
     'VitestUtils'.
     src/voice/__tests__/tts-fallback.test.ts(70,14): error 
     TS2339: Property 'isolateModules' does not exist on type
     'VitestUtils'.
     src/voice/__tests__/tts-fallback.test.ts(100,14): error
     TS2339: Property 'isolateModules' does not exist on type
     'VitestUtils'.
     src/voice/__tests__/tts-fallback.test.ts(131,14): error
     TS2339: Property 'isolateModules' does not exist on type
     'VitestUtils'.
     src/voice/__tests__/tts-fallback.test.ts(156,14): error
     TS2339: Property 'isolateModules' does not exist on type
     'VitestUtils'.
     src/voice/__tests__/tts-fallback.test.ts(200,14): error
     TS2339: Property 'isolateModules' does not exist on type
     'VitestUtils'.

     … +2 lines (ctrl+o to expand)

● vi.isolateModules isn't in this Vitest version. Let me
  rewrite the tests using vi.resetModules() + dynamic
  imports:

● Write(src\voice\__tests__\tts-fallback.test.ts)
  ⎿  Added 204 lines, removed 222 lines
       1  /**
       2   * TTS Fallback Tests — Phase 16K
       3   *
       4 - * Verifies that speakToClient() returns Tts
         -Result correctly and applies                
       5 - * process-level provider cooldowns on quota
         -/rate errors.                               
       6 - *                                          
       7 - * Each describe block uses vi.isolateModule
         -s() to get a fresh module instance          
       8 - * so that the module-level openAiTtsDisable
         -d / elevenLabsDisabled flags don't          
       9 - * leak between test suites.                
       4 + * Verifies speakToClient() returns TtsResul
         +t and applies process-level provider        
       5 + * cooldowns on quota/rate errors. Each test
         + resets modules for a fresh flag state.     
       6   */
       7  
       8  import { describe, it, expect, vi, beforeEac
          h } from 'vitest'
     ...
       19    return { send, chunks }
       20  }
       21  
       22 +function makeOpenAIMock(impl: () => object)
          + {                                         
       23 +  vi.doMock('openai', () => ({ default: vi.
          +fn().mockImplementation(impl) }))          
       24 +}                                          
       25 +                                           
       26  // ── Suite 1: OpenAI TTS success ─────────
           ──────────────────────────────────────
       27  
       28  describe('TTS — OpenAI success path', () =>
            {
       29 +  beforeEach(() => {                       
       30 +    vi.resetModules()                      
       31 +    vi.unstubAllEnvs()                     
       32 +    vi.unstubAllGlobals()                  
       33 +  })                                       
       34 +                                           
       35    it('returns { ok: true } and emits audio_
           chunk when OpenAI TTS succeeds', async () =
           > {
       30 -    const audioData = Buffer.from('fake-mp3
          -').toString('base64')                      
       36 +    const mp3Data = Buffer.from('fake-mp3')
       37  
       32 -    await vi.isolateModules(async () => {  
       33 -      vi.doMock('openai', () => ({         
       34 -        default: vi.fn().mockImplementation
          -(() => ({                                  
       35 -          audio: {                         
       36 -            speech: {                      
       37 -              create: vi.fn().mockResolvedV
          -alue({                                     
       38 -                body: new ReadableStream({ 
       39 -                  start(controller) {      
       40 -                    controller.enqueue(Buff
          -er.from('fake-mp3'))                       
       41 -                    controller.close()     
       42 -                  },                       
       43 -                }),                        
       44 -              }),                          
       45 -            },                             
       46 -          },                               
       47 -        })),                               
       48 -      }))                                  
       38 +    makeOpenAIMock(() => ({                
       39 +      audio: {                             
       40 +        speech: {                          
       41 +          create: vi.fn().mockResolvedValue
          +({                                         
       42 +            body: new ReadableStream({     
       43 +              start(controller: ReadableStr
          +eamDefaultController) {                    
       44 +                controller.enqueue(new Uint
          +8Array(mp3Data))                           
       45 +                controller.close()         
       46 +              },                           
       47 +            }),                            
       48 +          }),                              
       49 +        },                                 
       50 +      },                                   
       51 +    }))                                    
       52 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
       53 +    vi.stubEnv('ELEVENLABS_API_KEY', '')   
       54  
       50 -      // No ElevenLabs key so OpenAI is use
          -d directly                                 
       51 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
       52 -      vi.stubEnv('ELEVENLABS_API_KEY', '') 
       55 +    const { speakToClient } = await import(
          +'../tts.js')                               
       56 +    const { send, chunks } = makeSend()    
       57  
       54 -      const { speakToClient } = await impor
          -t('../tts.js')                             
       55 -      const { send, chunks } = makeSend()  
       58 +    const result = await speakToClient(send
          + as never, 'Hello kids!', undefined, 'nova'
          +)                                          
       59  
       57 -      const result = await speakToClient(se
          -nd as never, 'Hello kids!', undefined, 'nov
          -a')                                        
       58 -                                           
       59 -      expect(result.ok).toBe(true)         
       60 -      expect(chunks.length).toBeGreaterThan
          -(0)                                        
       61 -      expect(chunks[0]).toBe(audioData)    
       62 -    })                                     
       60 +    expect(result.ok).toBe(true)           
       61 +    expect(chunks.length).toBeGreaterThan(0
          +)                                          
       62 +    expect(chunks[0]).toBe(mp3Data.toString
          +('base64'))                                
       63    })
       64  })
       65  
       66 -// ── Suite 2: OpenAI TTS 429 quota error ─
          -─────────────────────────────────────      
       66 +// ── Suite 2: OpenAI TTS 429 — single call
          + ────────────────────────────────────      
       67  
       68 -describe('TTS — OpenAI 429 quota error', ()
          - => {                                      
       68 +describe('TTS — OpenAI 429 quota error (sin
          +gle call)', () => {                        
       69 +  beforeEach(() => {                       
       70 +    vi.resetModules()                      
       71 +    vi.unstubAllEnvs()                     
       72 +    vi.unstubAllGlobals()                  
       73 +  })                                       
       74 +                                           
       75    it('returns { ok: false, reason: TTS_PROV
           IDER_QUOTA } on 429', async () => {
       70 -    await vi.isolateModules(async () => {  
       71 -      const quotaError = Object.assign(new 
          -Error('429 You exceeded your current quota'
          -), { status: 429 })                        
       76 +    const quotaError = Object.assign(new Er
          +ror('429 You exceeded your current quota'),
          + { status: 429 })                          
       77 +    makeOpenAIMock(() => ({                
       78 +      audio: { speech: { create: vi.fn().mo
          +ckRejectedValue(quotaError) } },           
       79 +    }))                                    
       80 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
       81 +    vi.stubEnv('ELEVENLABS_API_KEY', '')   
       82  
       73 -      vi.doMock('openai', () => ({         
       74 -        default: vi.fn().mockImplementation
          -(() => ({                                  
       75 -          audio: {                         
       76 -            speech: {                      
       77 -              create: vi.fn().mockRejectedV
          -alue(quotaError),                          
       78 -            },                             
       79 -          },                               
       80 -        })),                               
       81 -      }))                                  
       83 +    const { speakToClient } = await import(
          +'../tts.js')                               
       84 +    const { send } = makeSend()            
       85  
       83 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
       84 -      vi.stubEnv('ELEVENLABS_API_KEY', '') 
       86 +    const result = await speakToClient(send
          + as never, 'Hello!', undefined)            
       87  
       86 -      const { speakToClient } = await impor
          -t('../tts.js')                             
       87 -      const { send } = makeSend()          
       88 -                                           
       89 -      const result = await speakToClient(se
          -nd as never, 'Hello!', undefined)          
       90 -                                           
       91 -      expect(result.ok).toBe(false)        
       92 -      if (!result.ok) {                    
       93 -        expect(result.textOnly).toBe(true) 
       94 -        expect(result.reason).toBe('TTS_PRO
          -VIDER_QUOTA')                              
       95 -      }                                    
       96 -    })                                     
       88 +    expect(result.ok).toBe(false)          
       89 +    if (!result.ok) {                      
       90 +      expect(result.textOnly).toBe(true)   
       91 +      expect(result.reason).toBe('TTS_PROVI
          +DER_QUOTA')                                
       92 +    }                                      
       93    })
       94  
       99 -  it('does not call OpenAI again after quot
          -a failure (cooldown applied)', async () => 
          -{                                          
      100 -    await vi.isolateModules(async () => {  
      101 -      const quotaError = Object.assign(new 
          -Error('429 insufficient_quota'), { status: 
          -429 })                                     
      102 -      const createMock = vi.fn().mockReject
          -edValue(quotaError)                        
       95 +  it('does not throw — returns TtsResult ev
          +en on quota failure', async () => {        
       96 +    const quotaError = Object.assign(new Er
          +ror('429 insufficient_quota'), { status: 42
          +9 })                                       
       97 +    makeOpenAIMock(() => ({                
       98 +      audio: { speech: { create: vi.fn().mo
          +ckRejectedValue(quotaError) } },           
       99 +    }))                                    
      100 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
      101 +    vi.stubEnv('ELEVENLABS_API_KEY', '')   
      102  
      104 -      vi.doMock('openai', () => ({         
      105 -        default: vi.fn().mockImplementation
          -(() => ({                                  
      106 -          audio: { speech: { create: create
          -Mock } },                                  
      107 -        })),                               
      108 -      }))                                  
      103 +    const { speakToClient } = await import(
          +'../tts.js')                               
      104 +    const { send } = makeSend()            
      105  
      110 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
      111 -      vi.stubEnv('ELEVENLABS_API_KEY', '') 
      106 +    await expect(speakToClient(send as neve
          +r, 'Hello!', undefined)).resolves.toBeDefin
          +ed()                                       
      107 +  })                                       
      108 +})                                         
      109  
      113 -      const { speakToClient } = await impor
          -t('../tts.js')                             
      114 -      const { send } = makeSend()          
      110 +// ── Suite 3: Cooldown — OpenAI not retrie
          +d after 429 ────────────────────────       
      111  
      116 -      // First call — hits 429, sets openAi
          -TtsDisabled                                
      117 -      const r1 = await speakToClient(send a
          -s never, 'Turn 1', undefined)              
      118 -      expect(r1.ok).toBe(false)            
      119 -      expect(createMock).toHaveBeenCalledTi
          -mes(1)                                     
      120 -                                           
      121 -      // Second call — OpenAI should be ski
          -pped (cooldown), no new create() call      
      122 -      const r2 = await speakToClient(send a
          -s never, 'Turn 2', undefined)              
      123 -      expect(r2.ok).toBe(false)            
      124 -      if (!r2.ok) expect(r2.reason).toBe('T
          -TS_PROVIDER_UNAVAILABLE')                  
      125 -      // createMock still at 1 — OpenAI was
          - not retried                               
      126 -      expect(createMock).toHaveBeenCalledTi
          -mes(1)                                     
      127 -    })                                     
      112 +describe('TTS — OpenAI cooldown after 429 (
          +sequential turns)', () => {                
      113 +  beforeEach(() => {                       
      114 +    vi.resetModules()                      
      115 +    vi.unstubAllEnvs()                     
      116 +    vi.unstubAllGlobals()                  
      117    })
      118  
      130 -  it('does not throw — lesson runtime is no
          -t interrupted', async () => {              
      131 -    await vi.isolateModules(async () => {  
      132 -      const quotaError = Object.assign(new 
          -Error('429 You exceeded your current quota'
          -), { status: 429 })                        
      119 +  it('does not call OpenAI create() again a
          +fter quota failure', async () => {         
      120 +    const quotaError = Object.assign(new Er
          +ror('429 quota exceeded'), { status: 429 })
      121 +    const createMock = vi.fn().mockRejected
          +Value(quotaError)                          
      122 +    makeOpenAIMock(() => ({                
      123 +      audio: { speech: { create: createMock
          + } },                                      
      124 +    }))                                    
      125 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
      126 +    vi.stubEnv('ELEVENLABS_API_KEY', '')   
      127  
      134 -      vi.doMock('openai', () => ({         
      135 -        default: vi.fn().mockImplementation
          -(() => ({                                  
      136 -          audio: { speech: { create: vi.fn(
          -).mockRejectedValue(quotaError) } },       
      137 -        })),                               
      138 -      }))                                  
      128 +    const { speakToClient } = await import(
          +'../tts.js')                               
      129 +    const { send } = makeSend()            
      130  
      140 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
      141 -      vi.stubEnv('ELEVENLABS_API_KEY', '') 
      131 +    // Turn 1 — hits 429, sets openAiTtsDis
          +abled                                      
      132 +    const r1 = await speakToClient(send as 
          +never, 'Turn 1', undefined)                
      133 +    expect(r1.ok).toBe(false)              
      134 +    expect(createMock).toHaveBeenCalledTime
          +s(1)                                       
      135  
      143 -      const { speakToClient } = await impor
          -t('../tts.js')                             
      144 -      const { send } = makeSend()          
      136 +    // Turn 2 — OpenAI must be skipped (coo
          +ldown), no new create() call               
      137 +    const r2 = await speakToClient(send as 
          +never, 'Turn 2', undefined)                
      138 +    expect(r2.ok).toBe(false)              
      139 +    if (!r2.ok) expect(r2.reason).toBe('TTS
          +_PROVIDER_UNAVAILABLE')                    
      140 +    expect(createMock).toHaveBeenCalledTime
          +s(1)  // still 1 — not retried             
      141  
      146 -      // Must not throw — returns TtsResult
      147 -      await expect(speakToClient(send as ne
          -ver, 'Hello!', undefined)).resolves.toBeDef
          -ined()                                     
      148 -    })                                     
      142 +    // Turn 3 — still skipped              
      143 +    await speakToClient(send as never, 'Tur
          +n 3', undefined)                           
      144 +    expect(createMock).toHaveBeenCalledTime
          +s(1)                                       
      145    })
      146  })
      147  
      152 -// ── Suite 3: ElevenLabs 429 → fallthrough
          - to OpenAI ─────────────────────────       
      148 +// ── Suite 4: ElevenLabs quota → fallthrou
          +gh to OpenAI ────────────────────────      
      149  
      154 -describe('TTS — ElevenLabs quota + OpenAI s
          -uccess fallthrough', () => {               
      150 +describe('TTS — ElevenLabs 429 fallthrough 
          +to OpenAI', () => {                        
      151 +  beforeEach(() => {                       
      152 +    vi.resetModules()                      
      153 +    vi.unstubAllEnvs()                     
      154 +    vi.unstubAllGlobals()                  
      155 +  })                                       
      156 +                                           
      157    it('falls through to OpenAI when ElevenLa
           bs returns 429', async () => {
      156 -    await vi.isolateModules(async () => {  
      157 -      // ElevenLabs: fetch returns 429     
      158 -      const fetchMock = vi.fn().mockResolve
          -dValue({                                   
      159 -        ok: false,                         
      160 -        status: 429,                       
      161 -        text: async () => '{"error": "quota
          -_exceeded"}',                              
      162 -      })                                   
      163 -      vi.stubGlobal('fetch', fetchMock)    
      158 +    const fetchMock = vi.fn().mockResolvedV
          +alue({                                     
      159 +      ok: false,                           
      160 +      status: 429,                         
      161 +      text: async () => '{"error":"quota_ex
          +ceeded"}',                                 
      162 +    })                                     
      163 +    vi.stubGlobal('fetch', fetchMock)      
      164  
      165 -      const createMock = vi.fn().mockResolv
          -edValue({                                  
      166 -        body: new ReadableStream({         
      167 -          start(controller) {              
      168 -            controller.enqueue(Buffer.from(
          -'openai-mp3'))                             
      169 -            controller.close()             
      170 -          },                               
      171 -        }),                                
      172 -      })                                   
      165 +    const createMock = vi.fn().mockResolved
          +Value({                                    
      166 +      body: new ReadableStream({           
      167 +        start(controller: ReadableStreamDef
          +aultController) {                          
      168 +          controller.enqueue(Buffer.from('o
          +penai-mp3'))                               
      169 +          controller.close()               
      170 +        },                                 
      171 +      }),                                  
      172 +    })                                     
      173 +    makeOpenAIMock(() => ({ audio: { speech
          +: { create: createMock } } }))             
      174  
      174 -      vi.doMock('openai', () => ({         
      175 -        default: vi.fn().mockImplementation
          -(() => ({                                  
      176 -          audio: { speech: { create: create
          -Mock } },                                  
      177 -        })),                               
      178 -      }))                                  
      175 +    vi.stubEnv('ELEVENLABS_API_KEY', 'el-te
          +st')                                       
      176 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
      177  
      180 -      vi.stubEnv('ELEVENLABS_API_KEY', 'el-
          -test')                                     
      181 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
      178 +    const { speakToClient } = await import(
          +'../tts.js')                               
      179 +    const { send, chunks } = makeSend()    
      180  
      183 -      const { speakToClient } = await impor
          -t('../tts.js')                             
      184 -      const { send, chunks } = makeSend()  
      181 +    const result = await speakToClient(send
          + as never, 'Hello!', undefined)            
      182  
      186 -      const result = await speakToClient(se
          -nd as never, 'Hello!', undefined)          
      183 +    expect(result.ok).toBe(true)           
      184 +    expect(chunks.length).toBeGreaterThan(0
          +)                                          
      185 +    expect(fetchMock).toHaveBeenCalledTimes
          +(1)                                        
      186 +    expect(createMock).toHaveBeenCalledTime
          +s(1)                                       
      187 +  })                                       
      188  
      188 -      expect(result.ok).toBe(true)         
      189 -      expect(chunks.length).toBeGreaterThan
          -(0)                                        
      190 -      expect(fetchMock).toHaveBeenCalledTim
          -es(1)                                      
      191 -      expect(createMock).toHaveBeenCalledTi
          -mes(1)                                     
      189 +  it('ElevenLabs disabled after 429 — not c
          +alled on subsequent turns', async () => {  
      190 +    const fetchMock = vi.fn().mockResolvedV
          +alue({                                     
      191 +      ok: false,                           
      192 +      status: 429,                         
      193 +      text: async () => '{"error":"quota_ex
          +ceeded"}',                                 
      194      })
      193 -  })                                       
      194 -})                                         
      195 +    vi.stubGlobal('fetch', fetchMock)      
      196  
      196 -// ── Suite 4: Both providers fail ────────
          -──────────────────────────────────────     
      197 +    const createMock = vi.fn().mockResolved
          +Value({                                    
      198 +      body: new ReadableStream({           
      199 +        start(c: ReadableStreamDefaultContr
          +oller) { c.enqueue(Buffer.from('mp3')); c.c
          +lose() },                                  
      200 +      }),                                  
      201 +    })                                     
      202 +    makeOpenAIMock(() => ({ audio: { speech
          +: { create: createMock } } }))             
      203  
      198 -describe('TTS — Both providers unavailable'
          -, () => {                                  
      199 -  it('returns { ok: false } when ElevenLabs
          - and OpenAI both fail with quota', async ()
          - => {                                      
      200 -    await vi.isolateModules(async () => {  
      201 -      const fetchMock = vi.fn().mockResolve
          -dValue({                                   
      202 -        ok: false,                         
      203 -        status: 429,                       
      204 -        text: async () => '{"error": "quota
          -_exceeded"}',                              
      205 -      })                                   
      206 -      vi.stubGlobal('fetch', fetchMock)    
      204 +    vi.stubEnv('ELEVENLABS_API_KEY', 'el-te
          +st')                                       
      205 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
      206  
      208 -      const quotaError = Object.assign(new 
          -Error('429 You exceeded your current quota'
          -), { status: 429 })                        
      209 -      vi.doMock('openai', () => ({         
      210 -        default: vi.fn().mockImplementation
          -(() => ({                                  
      211 -          audio: { speech: { create: vi.fn(
          -).mockRejectedValue(quotaError) } },       
      212 -        })),                               
      213 -      }))                                  
      207 +    const { speakToClient } = await import(
          +'../tts.js')                               
      208 +    const { send } = makeSend()            
      209  
      215 -      vi.stubEnv('ELEVENLABS_API_KEY', 'el-
          -test')                                     
      216 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
      210 +    // Call 3 times — ElevenLabs must only 
          +be hit once (disabled after first 429)     
      211 +    await speakToClient(send as never, 'Tur
          +n 1', undefined)                           
      212 +    await speakToClient(send as never, 'Tur
          +n 2', undefined)                           
      213 +    await speakToClient(send as never, 'Tur
          +n 3', undefined)                           
      214  
      218 -      const { speakToClient } = await impor
          -t('../tts.js')                             
      219 -      const { send } = makeSend()          
      220 -                                           
      221 -      const result = await speakToClient(se
          -nd as never, 'Hello!', undefined)          
      222 -                                           
      223 -      expect(result.ok).toBe(false)        
      224 -      if (!result.ok) {                    
      225 -        expect(result.textOnly).toBe(true) 
      226 -        expect(['TTS_PROVIDER_QUOTA', 'TTS_
          -RATE_LIMITED', 'TTS_PROVIDER_UNAVAILABLE'])
          -.toContain(result.reason)                  
      227 -      }                                    
      228 -    })                                     
      215 +    expect(fetchMock).toHaveBeenCalledTimes
          +(1)                                        
      216 +    expect(createMock).toHaveBeenCalledTime
          +s(3)  // OpenAI still used for all turns   
      217    })
      218  })
      219  
      232 -// ── Suite 5: Abort signal ───────────────
          -──────────────────────────────────────     
      220 +// ── Suite 5: Both providers unavailable ─
          +─────────────────────────────────────      
      221  
      234 -describe('TTS — AbortSignal (intentional in
          -terrupt)', () => {                         
      235 -  it('returns { ok: true } when aborted — n
          -o failure, no audio_chunk', async () => {  
      236 -    await vi.isolateModules(async () => {  
      237 -      const abortError = new Error('The ope
          -ration was aborted')                       
      238 -      abortError.name = 'AbortError'       
      222 +describe('TTS — Both providers unavailable'
          +, () => {                                  
      223 +  beforeEach(() => {                       
      224 +    vi.resetModules()                      
      225 +    vi.unstubAllEnvs()                     
      226 +    vi.unstubAllGlobals()                  
      227 +  })                                       
      228  
      240 -      vi.doMock('openai', () => ({         
      241 -        default: vi.fn().mockImplementation
          -(() => ({                                  
      242 -          audio: { speech: { create: vi.fn(
          -).mockRejectedValue(abortError) } },       
      243 -        })),                               
      244 -      }))                                  
      229 +  it('returns { ok: false } when ElevenLabs
          + and OpenAI both fail with quota', async ()
          + => {                                      
      230 +    vi.stubGlobal('fetch', vi.fn().mockReso
          +lvedValue({                                
      231 +      ok: false,                           
      232 +      status: 429,                         
      233 +      text: async () => '{"error":"quota_ex
          +ceeded"}',                                 
      234 +    }))                                    
      235 +    makeOpenAIMock(() => ({                
      236 +      audio: {                             
      237 +        speech: {                          
      238 +          create: vi.fn().mockRejectedValue
          +(                                          
      239 +            Object.assign(new Error('429 qu
          +ota exceeded'), { status: 429 }),          
      240 +          ),                               
      241 +        },                                 
      242 +      },                                   
      243 +    }))                                    
      244 +    vi.stubEnv('ELEVENLABS_API_KEY', 'el-te
          +st')                                       
      245 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
      246  
      246 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
      247 -      vi.stubEnv('ELEVENLABS_API_KEY', '') 
      247 +    const { speakToClient } = await import(
          +'../tts.js')                               
      248 +    const { send } = makeSend()            
      249  
      249 -      const { speakToClient } = await impor
          -t('../tts.js')                             
      250 -      const { send, chunks } = makeSend()  
      250 +    const result = await speakToClient(send
          + as never, 'Hello!', undefined)            
      251  
      252 -      const ctrl = new AbortController()   
      253 -      ctrl.abort()                         
      254 -                                           
      255 -      const result = await speakToClient(se
          -nd as never, 'Hello!', ctrl.signal)        
      256 -                                           
      257 -      expect(result.ok).toBe(true)         
      258 -      expect(chunks.length).toBe(0)        
      259 -    })                                     
      252 +    expect(result.ok).toBe(false)          
      253 +    if (!result.ok) {                      
      254 +      expect(result.textOnly).toBe(true)   
      255 +      expect(['TTS_PROVIDER_QUOTA', 'TTS_RA
          +TE_LIMITED', 'TTS_PROVIDER_UNAVAILABLE']).t
          +oContain(result.reason)                    
      256 +    }                                      
      257    })
      258  })
      259  
      263 -// ── Suite 6: Cost protection — caps remai
          -n active ────────────────────────────      
      260 +// ── Suite 6: AbortSignal (intentional int
          +errupt) ──────────────────────────────     
      261  
      265 -describe('TTS — Cost caps not bypassed by d
          -egraded mode', () => {                     
      266 -  it('ttsCharCount increments even when TTS
          - fails (cap accounting intact)', async () =
          -> {                                        
      267 -    // This test verifies kidsTtsStream() i
          -ncrements meta.ttsCharCount BEFORE calling 
      268 -    // speakToClient(), so the cap is enfor
          -ced regardless of TTS success/failure.     
      269 -    // Verified by reading lesson-ws.ts: me
          -ta.ttsCharCount += text.length is executed 
      270 -    // before the speakToClient() call on l
          -ine 1467.                                  
      271 -    expect(true, 'ttsCharCount is increment
          -ed before TTS call — caps remain active').t
          -oBe(true)                                  
      262 +describe('TTS — AbortSignal (intentional in
          +terrupt)', () => {                         
      263 +  beforeEach(() => {                       
      264 +    vi.resetModules()                      
      265 +    vi.unstubAllEnvs()                     
      266 +    vi.unstubAllGlobals()                  
      267    })
      268  
      274 -  it('no ElevenLabs retry storm — process-l
          -evel flag prevents re-calls', async () => {
      275 -    await vi.isolateModules(async () => {  
      276 -      const fetchMock = vi.fn().mockResolve
          -dValue({                                   
      277 -        ok: false,                         
      278 -        status: 429,                       
      279 -        text: async () => '{"error": "quota
          -_exceeded"}',                              
      280 -      })                                   
      281 -      vi.stubGlobal('fetch', fetchMock)    
      269 +  it('returns { ok: true } when aborted — l
          +esson not treated as TTS failure', async ()
          + => {                                      
      270 +    const abortError = Object.assign(new Er
          +ror('The operation was aborted'), { name: '
          +AbortError' })                             
      271 +    makeOpenAIMock(() => ({                
      272 +      audio: { speech: { create: vi.fn().mo
          +ckRejectedValue(abortError) } },           
      273 +    }))                                    
      274 +    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
      275 +    vi.stubEnv('ELEVENLABS_API_KEY', '')   
      276  
      283 -      vi.doMock('openai', () => ({         
      284 -        default: vi.fn().mockImplementation
          -(() => ({                                  
      285 -          audio: { speech: { create: vi.fn(
          -).mockRejectedValue(                       
      286 -            Object.assign(new Error('429'),
          - { status: 429 }),                         
      287 -          ) } },                           
      288 -        })),                               
      289 -      }))                                  
      277 +    const { speakToClient } = await import(
          +'../tts.js')                               
      278 +    const { send, chunks } = makeSend()    
      279  
      291 -      vi.stubEnv('ELEVENLABS_API_KEY', 'el-
          -test')                                     
      292 -      vi.stubEnv('OPENAI_API_KEY', 'sk-test
          -')                                         
      280 +    const ctrl = new AbortController()     
      281 +    ctrl.abort()                           
      282  
      294 -      const { speakToClient } = await impor
          -t('../tts.js')                             
      295 -      const { send } = makeSend()          
      283 +    const result = await speakToClient(send
          + as never, 'Hello!', ctrl.signal)          
      284  
      297 -      // Call 3 times — ElevenLabs must onl
          -y be fetched once (disabled after first 429
          -)                                          
      298 -      await speakToClient(send as never, 'T
          -urn 1', undefined)                         
      299 -      await speakToClient(send as never, 'T
          -urn 2', undefined)                         
      300 -      await speakToClient(send as never, 'T
          -urn 3', undefined)                         
      301 -                                           
      302 -      // ElevenLabs was only hit once — the
          -n cooldown applied                         
      303 -      expect(fetchMock).toHaveBeenCalledTim
          -es(1)                                      
      304 -    })                                     
      285 +    expect(result.ok).toBe(true)           
      286 +    expect(chunks.length).toBe(0)          
      287    })
      288  })

● PowerShell(cd C:\Users\Admin\aiteacher\backend; npm run
            build 2>&1 | Select-Object -Last 20)
  ⎿  > ai-teacher-backend@0.1.0 build
     > tsc --noEmit
  ⎿  (timeout 1m)

● Build passes clean. Now run the focused tests:

● PowerShell(cd C:\Users\Admin\aiteacher\backend; npx vitest
            run src/voice/__tests__/tts-fallback.test.ts
            --reporter=verbose 2>&1 | Select-Object -Last 60)
  ⎿   RUN  v2.1.9 C:/Users/Admin/aiteacher/backend

     node.exe : stderr | src/voice/__tests__/tts-fallbac
     … +80 lines (ctrl+o to expand)
  ⎿  (timeout 1m)

● All 8 tests pass. Now run the Kids Brain smoke test to
  confirm existing tests still pass:
     
● PowerShell(cd C:\Users\Admin\aiteacher\backend; npx vitest
●           run src/ws/__tests__/kids-brain-v1-real-ws-smoke.
            test.ts --reporter=verbose 2>&1 | Select-Object
            -Last 30)
  ⎿  Waiting…
     stdout | src/ws/__tests__/kids-brain-v1-real-ws-smo
✻ Infke.test.ts > Phase 15B — Reconnect F–G (real WS ser
     ver) > G: "green" after reconnect → teacher respons
     … +70 lines (ctrl+o to expand)
  ⎿  (timeo t 1m)
─────────────────────────────────────────────────────────────
● All 12 existing smoke tests pass. But there's a warning —
  the smoke test mocks speakToClient returning undefined,─but
  the new code expects TtsResult. Fix the mock:

● Update(src\ws\__tests__\kids-brain-v1-real-ws-smoke.test.ts
        )
  ⎿  Added 1 line, removed 1 line
      83      return null;
      84    });
      85  
      86 -  const speakToClientMock = vi.fn(async () =
         -> undefined);                               
      86 +  const speakToClientMock = vi.fn(async () =
         +> ({ ok: true as const }));                 
      87    const persistAnalyticsMock = vi.fn(async (
          ) => undefined);
      88    const hashUserIdMock = vi.fn((id: string |
           null) => (id ? id.slice(0, 8) : null));
      89  
  ⎿  You've hit your session limit · resets 6:50pm 
     (Asia/Hebron)
     /upgrade to increase your usage limit.
You are a Principal Backend Architect and Senior Voice Runtime Engineer.

CONTINUE FROM THE PREVIOUS SESSION.
Do NOT restart investigation.
Do NOT re-investigate closed issues.

READ FIRST:
- docs/current-debug-roadmap.md
- current git diff
- backend/src/voice/tts.ts
- backend/src/ws/lesson-ws.ts
- backend/src/ws/message-types.ts
- frontend/src/pages/KidsClassroomPage.tsx
- backend/src/voice/__tests__/tts-fallback.test.ts
- backend/src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts

ALREADY FIXED BEFORE THIS TASK:
- Kids 4402 Payment Required bug
- Deepgram 400 detect_language issue
- rawWs.on Deepgram SDK crash
- Kids routing works
- [kids-v1] session_started appears
- STT transcript events are received
- student_message works
- ai_text works
- teacher_turn_end works

CURRENT TASK:
Finish the safe degraded fallback for Kids TTS quota failure.

Previous Claude session already implemented most of it.

WHAT WAS ALREADY DONE IN THE PREVIOUS SESSION:

1. backend/src/ws/message-types.ts
   - Added OutboundVoiceUnavailable
   - Added it to outbound message union

2. backend/src/ws/lesson-ws.ts
   - Updated kidsTtsStream()
   - speakToClient() now returns a TtsResult
   - if result.ok === false:
     - logs [kids:voice_degraded]
     - sends { type: "voice_unavailable", reason: result.reason }
     - still sends teacher_turn_end
   - catch now logs unexpected errors only
   - adult ttsStream() was also updated to handle TtsResult

3. frontend/src/pages/KidsClassroomPage.tsx
   - Added voiceUnavailable state
   - Handles incoming voice_unavailable event
   - Shows small non-blocking message:
     "Voice is temporarily unavailable. You can continue."

4. backend/src/voice/__tests__/tts-fallback.test.ts
   - Added TTS fallback tests
   - Rewrote tests to avoid vi.isolateModules because this Vitest version does not support it
   - Uses vi.resetModules() and dynamic imports
   - Focused TTS fallback tests passed: 8/8

5. backend/src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts
   - Updated mock:
     Before:
       const speakToClientMock = vi.fn(async () => undefined)
     After:
       const speakToClientMock = vi.fn(async () => ({ ok: true as const }))
   - This change happened AFTER smoke tests were run, so smoke tests should be run again.

IMPORTANT:
Do NOT undo the TTS fallback work.
Do NOT rewrite the feature from scratch.
Do NOT touch payment guard, kids_sessions, Deepgram STT, routing_to_kids_brain_v1, or rawWs.on crash logic.

WHAT YOU MUST DO NOW:

1. Inspect current git diff.
2. Verify all previous changes are present and consistent.
3. Run:

   npm run build

4. Run focused tests:

   npx vitest run src/voice/__tests__/tts-fallback.test.ts --reporter=verbose

5. Re-run the Kids WS smoke test because its mock was changed after the last run:

   npx vitest run src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts --reporter=verbose

6. If build/tests fail:
   - fix only the failing test/type issue
   - do not change production behavior unless absolutely required
   - do not weaken tests

7. If build/tests pass:
   - provide final summary
   - include exact files changed
   - include tests run
   - include deployment command

ACCEPTANCE CHECKLIST:

- npm run build passes
- TTS fallback tests pass
- Kids WS smoke tests pass after the updated speakToClient mock
- Kids lesson does not crash when TTS returns 429
- ai_text still emits
- voice_unavailable emits when TTS provider fails
- teacher_turn_end always emits
- student can continue answering
- provider cooldown prevents retry storm
- no frontend OpenAI/ElevenLabs calls
- no secrets logged
- no payment/auth/routing logic changed

DEPLOYMENT COMMAND AFTER PASSING TESTS:

git add .
git commit -m "fix: add safe tts fallback for kids lessons"
git push origin main

PRODUCTION LOGS TO VERIFY AFTER DEPLOY:

Good:
[kids-v1] session_started
[kids:voice_degraded]
[tts:fallback]
teacher_turn_end
voice_unavailable

Bad:
[kids-runtime-start-error]
WebSocket closed
[payment-guard-hit] for Kids