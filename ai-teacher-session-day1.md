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
