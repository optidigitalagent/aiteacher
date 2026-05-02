You are working on the production AI Teacher platform.                                                       
                                                                                                               
  Role:                                                                                                        
  Principal AI Lesson Architect + Senior Frontend Integration Engineer + Backend Safety Engineer +             
  Conversion-Focused Learning Designer.                                                                        
                                                                                                               
  This is NOT a new project.                                                                                   
  This is NOT a redesign.                                                                                      
  This is a continuation of a live Railway production system.                                                  
                                                                                                               
  ==================================================                                                           
  READ FIRST                                                                                                   
  ==================================================                                                           
                                                                                                               
  Before coding:                                                                                               
                                                                                                               
  1. Read CLAUDE.md.                                                                                           
  2. Inspect .claude/rules.                                                                                    
  3. Inspect .claude/skills.                                                                                   
  4. Use relevant UX/design/product skills if available.                                                       
  5. Inspect existing ClassroomLayout integration.                                                             
  6. Inspect useDemoSession.                                                                                   
  7. Inspect DemoStepCenter.                                                                                   
  8. Inspect demo lesson backend engine.                                                                       
  9. Inspect demo anti-abuse/one-time lock.                                                                    
  10. Inspect current auth/profile/demo session schema.                                                        
                                                                                                               
  Do not assume. Verify current files.                                                                         
                                                                                                               
  ==================================================                                                           
  CURRENT STATE                                                                                                
  ==================================================                                                           
                                                                                                               
  Working:                                                                                                     
                                                                                                               
  - Google auth works.                                                                                         
  - /api/me works.                                                                                             
  - Demo setup works.                                                                                          
  - User cannot start demo unauthenticated.                                                                    
  - Demo one-time lock works.                                                                                  
  - Demo routes work.                                                                                          
  - Demo now uses existing ClassroomLayout.                                                                    
  - Paid Classroom must remain untouched.                                                                      
  - Demo uses REST demo engine, not WebSocket.                                                                 
  - Demo has chat, teacher panel, task center, progress/result.                                                
                                                                                                               
  Current problems:                                                                                            
                                                                                                               
  1. Lesson feels too fast.                                                                                    
  Teacher jumps from answer to answer too quickly.                                                             
  User does not feel deeply taught.                                                                            
                                                                                                               
  2. Feedback is too generic.                                                                                  
  Bad:                                                                                                         
  User: “roblox”                                                                                               
  Teacher: “Yeah, exactly — that’s the right idea.”                                                            
                                                                                                               
  Better:                                                                                                      
  “Roblox — good topic. Small upgrade: say ‘I like Roblox’ or ‘I play Roblox because...’. Try one full         
  sentence.”                                                                                                   
                                                                                                               
  3. Spam/gibberish is accepted too positively.                                                                
  Bad:                                                                                                         
  User: “ewljfdnskjdnflj;sdnflk;sdnf”                                                                          
  Teacher: “Good effort! Score: 6/10”                                                                          
                                                                                                               
  Correct:                                                                                                     
  “I couldn’t understand that as English. Try one real English sentence.”                                      
                                                                                                               
  4. Voice flow is wrong.                                                                                      
  Current:                                                                                                     
  - microphone records too little                                                                              
  - transcript goes into text field                                                                            
  - user must manually press Send                                                                              
                                                                                                               
  Required:                                                                                                    
  - allow recording up to 50–60 seconds                                                                        
  - do not stop after a few words                                                                              
  - final transcript auto-submits                                                                              
  - manual text input still works                                                                              
                                                                                                               
  5. Center board behavior is rough.                                                                           
  The center “teacher board” should show the current task/exercise clearly.                                    
  It should not show ugly thinking/chat-like typing.                                                           
  Thinking should be subtle and not replace the exercise.                                                      
                                                                                                               
  6. Chat panel is slightly too narrow.                                                                        
  Increase it slightly without cropping teacher panel or destroying center board.                              
                                                                                                               
  7. Demo is hard to test                                                                                      
  ──── (329 lines hidden) ──────────────────────────────────────────────────────────────────────────────────── 
  hRecognition / webkitSpeechRecognition).                                                                     
    Transcript flows into setAnswer, same as production voice flow. Fully isolated — no WebSocket calls, no    
  paid                                                                                                         
    session interference                                                                                       
    - Voice state wired: BottomControls gets isListening={isDemoMode ? demoListening : isListening} and        
    onToggleMic={isDemoMode ? toggleDemoMic : toggle} — mic pulse ring and button state now work in demo       
    - TeacherPanel also updated to reflect demoListening state                                                 
                                                                                                               
    DemoStepCenter.tsx                                                                                         
                                                                                                               
    - Added import type { CSSProperties } from 'react' and replaced React.CSSProperties → CSSProperties — was  
  a                                                                                                            
    compile-time error without this                                                                            
                                                                                                               
    ---                                                                                                        
    Acceptance criteria confirmed                                                                              
                                                                                                               
    ┌────────────────────┬───────────────────────────────────────────────────────────────────────────────────┐ 
    │                    │                                                                                   │ 
    ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤ 
    │ No UI duplication  │ Chat, TeacherPanel, ProgressPanel each rendered exactly once                      │ 
    ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤ 
    │ Voice works in     │ Web Speech API → transcript → setAnswer → user presses Send →                     │ 
    │ demo               │ demo.handleTextSubmit()                                                           │ 
    ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤ 
    │ Demo isolated from │ useDemoSession guards on enabled: isDemoMode && authenticated; WebSocket skipped  │ 
    │  paid              │ via if (isDemoMode) return; voice uses separate state                             │ 
    ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤ 
    │ No min-length      │ handleTextSubmit only checks !answer.trim() — "A", "Yes", "No" all pass           │ 
    │ restriction        │                                                                                   │ 
    ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤ 
    │ Zero TypeScript    │ Verified with tsc --noEmit                                                        │ 
    │ errors             │                                                                                   │ 
    └────────────────────┴───────────────────────────────────────────────────────────────────────────────────┘ 

● I'll start by inspecting the current state of all relevant files before making any changes.

● 2 Explore agents finished (ctrl+o to expand)                                                                 
   ├ Inspect demo classroom files · 5 tool uses · 18.6k tokens    
   │ ⎿  Done                                                                                                   
   └ Inspect profile and auth files · 30 tool uses · 53.4k tokens
     ⎿  Done                                                                                                   
                                                                                                               
● Good overview. Now I need to read the actual file contents to make precise edits.                            
                                                                                                               
  Read 4 files (ctrl+o to expand)                                                                              
  ⎿  Loaded frontend\CLAUDE.md                                                                                 
                                                                                                               
● Good. Now let me read the remaining key files.                                                               
                                                                                                               
  Read 2 files (ctrl+o to expand)                                                                              
                                                                                                               
● Now let me check the auth routes and profile page.                                                           
                                                                                                               
  Read 2 files (ctrl+o to expand)                                                                              
  Read 1 file (ctrl+o to expand)
  ⎿  You've hit your limit · resets 9:20pm (Europe/Kiev)
     /upgrade to increase your usage limit.


DO NOT restart analysis.
DO NOT redesign architecture.
DO NOT rewrite backend.

Backend Demo Engine is already implemented and validated.

Your task:
FINALIZE Demo Lesson UX and conversion quality.

==================================================
GOAL
==================================================

Turn the demo lesson into a HIGH-CONVERSION experience.

User must feel:
- “I improved”
- “This AI understands me”
- “I want to continue”

==================================================
STRICT RULES
==================================================

DO NOT:
- increase AI calls
- add free chat
- touch paid lesson system
- touch existing Classroom core
- break limits or auth

==================================================
FOCUS TASKS
==================================================

1. Improve DemoClassroomPage UX:

- simulate real conversation
- teacher messages appear in chunks
- no dead states
- smooth progression between steps

2. Add strong correction moments:

Show clearly:

Before:
incorrect sentence

After:
correct sentence

Make improvement visible.

3. Use calibration data FULLY:

- interestArea → affects tasks
- teacherStyle → affects tone
- speakingConfidence → affects difficulty
- demoMission → affects feedback + result

User must feel personalization.

4. Improve speaking tasks:

- make them feel real (not textbook)
- short, natural prompts

5. Improve final result screen:

- not generic
- must feel personal
- highlight strengths + weaknesses
- show progress during lesson

6. Improve transition to pricing:

- smooth
- based on user performance
- motivating, not forced

==================================================
VALIDATION
==================================================

Ensure:

- all API calls use VITE_API_URL
- Authorization header is used
- no relative API calls
- no frontend AI calls
- demo limits enforced

==================================================
OUTPUT
==================================================

Return:

1. What you improved
2. Files changed
3. UX improvements added
4. Any small backend tweaks (if needed)
5. Build results
6. Git commands

Proceed directly.