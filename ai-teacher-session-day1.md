<<<<<<< HEAD
You are a Senior Full-Stack Debugging Engineer.                                                              
                                                                                                               
  Fix ONLY the production "Start Lesson" failure in AI Teacher.                                                
                                                                                                               
  ==================================================                                                           
  CONTEXT                                                                                                      
  ==================================================                                                           
                                                                                                               
  AI Teacher is deployed on Railway.                                                                           
                                                                                                               
  Backend:                                                                                                     
  https://aiteacher-production-bda7.up.railway.app                                                             
                                                                                                               
  Frontend:                                                                                                    
  https://fortunate-miracle-production-0854.up.railway.app                                                     
                                                                                                               
  Current working systems:                                                                                     
  - Railway backend is online                                                                                  
  - Railway frontend is online                                                                                 
  - PostgreSQL works                                                                                           
  - Redis works                                                                                                
  - Google OAuth works                                                                                         
  - JWT login works                                                                                            
  - user stays authenticated                                                                                   
  - /api/me works                                                                                              
  - profile works                                                                                              
                                                                                                               
  Current broken system:                                                                                       
  Clicking "Start Lesson" fails.                                                                               
                                                                                                               
  Browser Network shows:                                                                                       
  - request name: start                                                                                        
  - status: 405                                                                                                
  - type: fetch                                                                                                
                                                                                                               
  User sees:                                                                                                   
  "Failed to start lesson. Please try again."                                                                  
                                                                                                               
  Backend logs do NOT show lesson start handling.                                                              
                                                                                                               
  ==================================================                                                           
  PROBLEM                                                                                                      
  ==================================================                                                           
                                                                                                               
  This is likely an API route mismatch.                                                                        
                                                                                                               
  Possible causes:                                                                                             
  1. frontend calls wrong endpoint                                                                             
  2. frontend calls correct path but wrong HTTP method                                                         
  3. backend route exists but is mounted under different prefix                                                
  4. backend returns 405 because route/method is not aligned                                                   
  5. frontend still uses relative URL for lesson start instead of VITE_API_URL                                 
  6. lesson start API helper does not send Authorization token                                                 
                                                                                                               
  ==================================================                                                           
  STRICT RULES                                                                                                 
  ==================================================                                                           
                                                                                                               
  DO NOT:                                                                                                      
  - change Google OAuth                                                                                        
  - change AuthContext unless directly required for token usage                                                
  - change Profile page                                                                                        
  - change UI design                                                                                           
  - change Classroom UX                                                                                        
  - change lesson FSM                                                                                          
  - change AI prompts                                                                                          
  - touch STT/TTS/RAG                                                                                          
  - change database schema                                                                                     
  - implement payments                                                                                         
  - implement demo lesson                                                                                      
  - add anti-abuse now                                                                                         
  - create duplicate uncontrolled lesson endpoints                                                             
                                                                                                               
  ONLY fix Start Lesson API wiring.                                                                            
                                                                                                               
  ==================================================                                                           
  MANDATORY INVESTIGATION                                                                                      
  ==================================================                                                           
                                                                                                               
  1. Inspect frontend lesson start call:                                                                       
     - Learning page                                                                                           
     - lessonStartApi                                                                                          
     - any api/client helper                                                                                   
                                                                                                               
  Find:                                                                                                        
  - exact URL used                                                                                             
  - exact method used                                                                                          
  - whether API_BASE / VITE_API_URL is used                                                                    
  - whether Authorization: Bearer <token> is sent                                                              
  - request payload shape                                                                                      
                                                                                                               
  2. Inspect backend lesson start route:                                                                       
     - route file                                                                                              
     - method                                                                                                  
     - mounted prefix                                                                                          
     - auth middleware                                                                                         
     - expected payload                                                                                        
                                                                                                               
  Find final real endpoint, for example:                                                                       
  - POST /lesson/start                                                                                         
  - POST /api/lesson/start                                                                                     
  - POST /start                                                                                                
  - something else                                                                                             
                                                                                                               
  3. Compare frontend vs backend:                                                                              
     - path                                                                                                    
     - method                                                                                                  
     - headers                                                                                                 
     - body                                                                                                    
                                                                                                               
  4. Fix the smallest mismatch.                                                                                
                                                                                                               
  ==================================================                                                           
  REQUIRED BEHAVIOR                                                                                            
  ==================================================                                                           
                                                                                                               
  When authenticated user clicks Start Lesson:                                                                 
                                                                                                               
  Frontend must call the real backend endpoint using production API base:                                      
                                                                                                               
  `${VITE_API_URL}/...correct-path...`                                                                         
                                                                                                               
  Request must include:                                                                                        
                                                                                                               
  Authorization: Bearer <auth_token>                                                                           
  Content-Type: application/json                                                                               
                                                                                                               
  Payload must include selected lesson metadata:                                                               
  - mode                                                                                                       
  - bookId                                                                                                     
  - bookTitle if available                                                                                     
  - sectionId                                                                                                  
  - sectionNumber                                                                                              
  - sectionTitle/topic                                                                                         
  - teacherId                                                                                                  
  - teacherName                                                                                                
  - voiceId                                                                                                    
  - exerciseCount if available                                                                                 
                                                                                                               
  Backend must:                                                                                                
  - require auth                                                                                               
  - use userId from JWT/session                                                                                
  - create lesson session owned by authenticated user                                                          
  - return sessionId                                                                                           
  - not trust frontend userId                                                                                  
  - return structured error if blocked                                                                         
                                                                                                               
  Frontend must:                                                                                               
  - navigate to /classroom/:sessionId on success                                                               
  - show safe error on failure                                                                                 
  - not infinitely retry                                                                                       
                                                                                                               
  ==================================================                                                           
  IMPORTANT SECURITY RULE                                                                                      
  ==================================================                                                           
                                                                                                               
  Do NOT loosen auth to make the request pass.                                                                 
                                                                                                               
  If 401/403 appears, fix token/header wiring.                                                                 
  Do not make lesson start public.                                                                             
                                                                                                               
  NO AUTH = NO LESSON SESSION.                                                                                 
                                                                                                               
  ==================================================                                                           
  ACCEPTANCE CHECKLIST                                                                                         
  ==================================================                                                           
                                                                                                               
  - Network request is no longer 405                                                                           
  - Start Lesson sends request to backend domain, not frontend domain                                          
  - request uses POST                                                                                          
  - Authorization header is present                                                                            
  - backend logs show lesson start handling                                                                    
  - backend returns sessionId                                                                                  
  - frontend navigates to /classroom/:sessionId                                                                
  - unauthenticated user still sees AuthGate                                                                   
  - direct unauthenticated POST remains blocked                                                                
  - no UI redesign                                                                                             
  - no unrelated changes                                                                                       
                                                                                                               
  ==================================================                                                           
  OUTPUT REQUIRED                                                                                              
  ==================================================                                                           
                                                                                                               
  Report:                                                                                                      
  1. Exact root cause                                                                                          
  2. Frontend URL/method before fix                                                                            
  3. Backend real endpoint                                                                                     
  4. Files changed                                                                                             
  5. Whether Authorization header was fixed                                                                    
  6. Git commands to push  here is what already done  Report                                                   
                                                                                                               
                                                                                                               
                                                                                                               
    1. Root cause                                                                                              
                                                                                                               
                                                                                                               
    AuthContext.tsx:53 called fetch('/api/me', ...) — a relative URL. In local dev, Vite's proxy               
  (vite.config.ts                                                                                              
    lines 8-11) silently forwarded /api/* to localhost:4000. In production, the frontend is a static build on  
  a                                                                                                            
    separate Railway domain with no proxy — so /api/me hit the frontend nginx and returned 404. fetchMe        
  returned                                                                                                     
    false, and refreshUser then deleted the token it had just stored, leaving localStorage empty and the user  
    unauthenticated.                                                                                           
                                                                                                               
    Same bug existed in ProfilePage.tsx for /api/profile (two calls).                                          
                                                                                                               
    2. Files changed                                                                                           
                                                                                                               
                                                                                                               
  ┌─────────────────────────────────────────┬───────────────────────────────────────────────────────────────┐  
    │                  File                   │                            Change                              
  │                                                                                                            
                                                                                                               
  ├─────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤  
    │ frontend/src/context/AuthContext.tsx    │ Added API_BASE = import.meta.env.VITE_API_URL ?? '', prefixed  
  │                                                                                                            
    │                                         │  /api/me                                                       
  │                                                                                                            
                                                                                                               
  ├─────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤  
    │ frontend/src/pages/ProfilePage.tsx      │ Added API_BASE, prefixed both /api/profile calls               
  │                                                                                                            
                                                                                                               
  ├─────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤  
    │ frontend/src/pages/AuthCallbackPage.tsx │ Added console.log('[auth] callback token found:', !!token)     
  │                                                                                                            
                                                                                                               
  ├─────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤  
    │ backend/src/api/auth-routes.ts          │ Added safe success log (no token printed)                      
  │                                                                                                            
                                                                                                               
  └─────────────────────────────────────────┴───────────────────────────────────────────────────────────────┘  
                                                                                                               
    3. Redirect chain (unchanged — was already correct)                                                        
                                                                                                               
    /auth/google → Google → /auth/google/callback → FRONTEND_URL/auth/callback?token=<jwt>                     
                                                                                                               
    4. Token storage key                                                                                       
                                                                                                               
    auth_token (localStorage) — identical in AuthContext, storeToken, and AuthCallbackPage.                    
                                                                                                               
    5. Required Railway action (mandatory before fix works)                                                    
                                                                                                               
    In Railway → Frontend service → Variables, add a build-time env var:                                       
                                                                                                               
    VITE_API_URL = https://aiteacher-production-bda7.up.railway.app                                            
                                                                                                               
    Then trigger a redeploy of the frontend service (Railway must rebuild with this var so Vite bakes it into  
  the                                                                                                          
     bundle). Without this, import.meta.env.VITE_API_URL is undefined, API_BASE falls back to '', and the      
    relative-URL bug remains.                                                                                  
  ⎿  ⧉ Selected 1 lines from c:\Users\Admin\Downloads\aiteacher\backend\.env in Visual Studio Code

● Let me investigate the frontend lesson start code and backend routes simultaneously.

● Explore(Investigate lesson start API wiring)                                                                 
  ⎿  Done (24 tool uses · 58.9k tokens · 52s)                                                                
  (ctrl+o to expand)                                                                                           
                                                                                                             
● Good analysis. Let me read the key files directly to confirm before making any changes.                      
                                                                                                               
  Searched for 1 pattern, read 2 files (ctrl+o to expand)                                                      
                                                                                                               
● Root cause confirmed. Line 21 of lessonStartApi.ts uses a bare /lesson/start — no base URL. In production,   
  that POST hits the frontend nginx (which only handles GET for SPA routing) → 405. Let me verify the backend  
  route path quickly, then apply the fix.                                                                      
                                                                                                               
  Searched for 1 pattern (ctrl+o to expand)                                                                    
                                                                                                               
● Backend is POST /lesson/start mounted at root — path matches. The only bug is the missing API_BASE prefix in 
  lessonStartApi.ts. Applying the fix now.                                                                     
                                                                                          
● Update(frontend\src\services\lessonStartApi.ts)                                                              
  ⎿  Added 2 lines                                                                                             
      1  import { getStoredToken } from '../context/AuthContext'                                               
      2                                                                                                        
      3 +const API_BASE = import.meta.env.VITE_API_URL ?? ''                                            
      4 +                                                                                                      
      5  export interface LessonStartPayload {
      6    mode:          'textbook' | 'topic'                                                                 
      7    bookId:        string                            
  ⎿  You've hit your limit · resets 5:20pm (Europe/Kiev)                                                     
     /upgrade to increase your usage limit.      

     You are continuing an interrupted coding session.

==================================================
CONTEXT (CRITICAL)
==================================================

Below is the FULL terminal log from the previous session.

It includes:
- all commands executed
- all files modified
- all code changes
- reasoning steps

This is NOT a new task.
This is a CONTINUATION.

==================================================
PREVIOUS SESSION LOG
==================================================

[PASTE FULL TERMINAL OUTPUT HERE — EXACTLY AS IS]

==================================================
CURRENT STATE
==================================================

The system is partially fixed.

Already working:
- deployment (Railway)
- auth (Google OAuth + JWT)
- /api/me works
- frontend ↔ backend connection fixed (VITE_API_URL)
- user authentication persists

Current problem NOT fixed yet:

👉 Start Lesson fails (HTTP 405)

We already determined:
- backend is alive
- request reaches server
- endpoint mismatch exists OR wrong method OR wrong path

==================================================
TASK
==================================================

Continue EXACTLY from where you left off.

DO NOT restart analysis from scratch.

DO:

1. Identify where you stopped in the previous log
2. Continue debugging the Start Lesson failure
3. Finish aligning frontend ↔ backend API

==================================================
STRICT RULES
==================================================

DO NOT:
- redo auth system
- change OAuth
- modify unrelated files
- refactor project
- redesign UI
- touch working endpoints (/api/me etc.)
- introduce new architecture

ONLY:
- fix lesson start API mismatch

==================================================
EXPECTED OUTPUT
==================================================

1. What was already done (short recap)
2. What exact step you are continuing from
3. Exact root cause (if now clear)
4. Minimal code changes required
5. Exact files to edit
6. Git commands

==================================================
IMPORTANT
==================================================

Treat previous log as SOURCE OF TRUTH.

Do NOT guess project structure.
Use what is shown in logs.

Continue step-by-step until Start Lesson works.If you restart analysis from scratch, you are doing it wrong.
Continue from last meaningful step in the log.
=======
name my frontend file AI_Classroom.html You are a Principal Frontend Architect.                              
                                                                                                               
  I added the finished Classroom UI HTML file to the project root.                                             
                                                                                                               
  Your task:                                                                                                   
  Prepare this frontend for backend integration.                                                               
                                                                                                               
  DO NOT connect backend yet.                                                                                  
  DO NOT redesign UI.                                                                                          
  DO NOT change visual layout.                                                                                 
  DO NOT add features.                                                                                         
                                                                                                               
  What to do:                                                                                                  
                                                                                                               
  1. Find the Classroom HTML file in the project root.                                                         
  2. Analyze it.                                                                                               
  3. Extract it into proper React structure inside the existing frontend app.                                  
                                                                                                               
  Create / update:                                                                                             
                                                                                                               
  frontend/src/features/classroom/                                                                             
    components/                                                                                                
      ClassroomLayout.tsx                                                                                      
      ClassroomHeader.tsx                                                                                      
      TeacherPanel.tsx                                                                                         
      TeacherAvatar.tsx                                                                                        
      ExercisePanel.tsx                                                                                        
      SectionProgressPanel.tsx                                                                                 
      ChatPanel.tsx                                                                                            
      BottomControls.tsx                                                                                       
      TeachingOverlay.tsx                                                                                      
    hooks/                                                                                                     
      useLessonSession.ts                                                                                      
      useClassroomChat.ts                                                                                      
      useVoiceSession.ts                                                                                       
    services/                                                                                                  
      lessonApi.ts                                                                                             
      classroomSocket.ts                                                                                       
      voiceApi.ts                                                                                              
    types.ts                                                                                                   
    mockData.ts                                                                                                
                                                                                                               
  Rules:                                                                                                       
  - Keep UI visually identical to the HTML mock.                                                               
  - Keep mock data working for now.                                                                            
  - Remove duplicate/old classroom components only if they conflict.                                           
  - Do not break existing Vite app.                                                                            
  - Do not touch backend.                                                                                      
  - Add TODO comments where backend will connect later.                                                        
                                                                                                               
  Important product rules:                                                                                     
  - One input only: BottomControls.                                                                            
  - Chat is read-only; no chat input inside ChatPanel.                                                         
  - Frontend is passive; backend will control lesson flow later.                                               
  - Mic button = voice mode toggle.                                                                            
  - I don’t understand will later request teaching_card from backend.                                          
                                                                                                               
  Output:                                                                                                      
  1. Files created/changed                                                                                     
  2. Where the route/page is mounted                                                                           
  3. How to run/test frontend                                                                                  
  4. Backend TODO points                                                                                       

● Let me start by reading the HTML file and exploring the existing frontend structure.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)                                                       
                        
● Now let me read the key existing frontend files to understand the current structure.                         
                                                 
  Read 4 files (ctrl+o to expand)                                                                              
                                                                                                               
● Now let me read the remaining existing components.                                                           
                                                                                                               
  Read 4 files (ctrl+o to expand)                                                                              
                                                                                                               
● Let me read a few more files to complete my understanding.                                                   
                                                                                                               
  Read 4 files (ctrl+o to expand)                                                                              
                                                                                                               
● I have a complete picture of both the HTML mock and the existing frontend. Let me now create all the files.  
  I'll batch the writes to run in parallel.                                                                    
                                                                                                               
───────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Create file                                                                                                   
 frontend\src\features\classroom\types.ts                                                                      
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
   1 export type AvatarState = 'listening' | 'speaking' | 'thinking'
   2                                                                                                           
   3 export type StepStatus = 'done' | 'active' | 'upcoming'
   4                                                       
   5 export type FeedbackState = 'correct' | 'wrong' | null
   6 
   7 export interface Exercise {
   8   id:       string       
   9   index:    number
  10   total:    number
  11   prompt:   string
  12   hint:     string
  13   sentence: string  // contains "________" placeholder
  14   answer:   string
  15 }
  16
  17 export interface LessonStep {
  18   id:     string
  19   label:  string
  20   status: StepStatus
  21 }
  22
  23 export type MessageSender = 'ai' | 'user'
  24
  25 export interface ChatMessage {
  26   id:        string
  25 export interface ChatMessage {
  26   id:        string
  27   sender:    MessageSender
  28   text?:     string
  29   isTyping?: boolean
  30 }                            
  31                       
  32 export interface VoiceState {
  33   isListening: boolean
  34   isSpeaking:  boolean
  35   transcript:  string
  36 }                                  
  37                     
  38 export interface TeachingCardData {
  39   title:      string    
  40   body:       string  
  41   ruleTable?: string[][]
  42   examples?:  string[]                                                                                    
  43 }                          
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Do you want to create types.ts?                          
 ❯ 1. Yes
   2. Yes, allow all edits during this session (shift+tab)
   3. No                     

 Esc to cancel · Tab to amend
● Now let me read the key existing frontend files to understand the current structure.

  Read 4 files (ctrl+o to expand)

● Now let me read the remaining existing components.

  Read 4 files (ctrl+o to expand)

● Let me read a few more files to complete my understanding.

  Read 4 files (ctrl+o to expand)

● I have a complete picture of both the HTML mock and the existing frontend. Let me now create all the files.
  I'll batch the writes to run in parallel.

● Write(frontend\src\features\classroom\types.ts)
  ⎿  Wrote 43 lines to frontend\src\features\classroom\types.ts
       1 export type AvatarState = 'listening' | 'speaking' | 'thinking'
       2                                                                                  
       3 export type StepStatus = 'done' | 'active' | 'upcoming'
       4                                                                                                       
       5 export type FeedbackState = 'correct' | 'wrong' | null
       6                                                                                                       
       7 export interface Exercise {                                                                         
       8   id:       string
       9   index:    number
      10   total:    number
     … +33 lines (ctrl+o to expand)
  ⎿  You've hit your limit · resets 8:30pm (Europe/Kiev)
     /upgrade to increase your usage limit.     

     Continue from the last state.

You were working on integrating the Classroom frontend into a proper React architecture.

DO NOT restart.
DO NOT redesign.
DO NOT repeat analysis.

Pick up exactly where you stopped.

Current goal:

* finish extracting Classroom HTML into React components
* ensure structure is under /features/classroom/
* keep UI identical
* keep mock logic working

Then prepare next step:

* mark all backend integration points with TODO
* ensure single input system (BottomControls only)
* ensure ChatPanel has NO input

Work step-by-step until the frontend structure is complete and stable.

Output only:

* what you completed
* what remains (if anything)
>>>>>>> production/main
