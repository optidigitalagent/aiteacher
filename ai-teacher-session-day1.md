# MENTIUM KIDS V1 —        
  IMPLEMENTATION MASTER      
  PROMPT                     
                             
  You are a senior AI        
  systems architect and      
  backend-first product      
  engineer working on a      
  production-grade AI        
  English learning platform. 
                             
  Your task is to build the  
  FIRST experimental runtime 
   for:                      
                             
  # Mentium Kids             
                             
  inside an already existing 
   AI learning platform.     
                             
  ---                        
                             
  ## IMPORTANT CONTEXT       
                             
  The platform already has:  
                             
  * authentication           
  * classroom infrastructure 
  * realtime voice stack     
  * AI teacher system        
  * websocket sessions       
  * TTS/STT                  
  * adult learning runtime   
  * lesson/session           
  architecture               
                             
  DO NOT break or replace    
  the adult system.          
                             
  DO NOT modify the existing 
   adult Obsidian brain.     
                             
  We are building:           
  a completely separate      
  experimental kids runtime. 
                             
  ---                        
                             
  ## HIGH LEVEL PRODUCT IDEA 
                             
  Mentium Kids is NOT:       
                             
  * an AI chatbot            
  * textbook pages           
  * grammar exercises        
  * typing-based learning    
  * translation-heavy        
  learning                   
                             
  Mentium Kids IS:           
                             
  * a realtime AI teacher    
  companion                  
  * emotionally safe         
  * attention-preserving     
  * English-first            
  * interaction-driven       
  * recovery-oriented        
  * speaking-focused         
                             
  The child should feel:     
  “I’m playing/interacting/a 
  dventuring.”               
                             
  NOT:                       
  “I’m studying English.”    
                             
  ---                        
                             
  ## PRIMARY PRODUCT GOAL    
                             
  The most important thing   
  is NOT curriculum          
  correctness.               
                             
  The most important thing   
  is:                        
                             
  * emotional safety         
  * engagement retention     
  * confidence preservation  
  * voluntary participation  
  * natural interaction      
                             
  The AI teacher MUST:       
                             
  * prevent frustration      
  * prevent emotional        
  shutdown                   
  * recover confusion        
  naturally                  
  * keep interaction moving  
  * maintain English-first   
  immersion                  
                             
  ---                        
                             
  ## ABSOLUTE CONSTRAINTS    
                             
  DO NOT:                    
                             
  * redesign the frontend    
  globally                   
  * touch adult runtime      
  behavior                   
  * replace the existing     
  classroom                  
  * build giant architecture 
  * overengineer             
  abstractions               
  * create complex reward    
  economies                  
  * create multiplayer       
  systems                    
  * create full curriculum   
  systems                    
  * build long chatbot       
  conversations              
  * create grammar           
  explanation systems        
  * create translation-first 
   teaching                  
                             
  DO NOT build:              
                             
  * worlds                   
  * inventory systems        
  * coins/economy systems    
  * advanced memory systems  
  * social systems           
                             
  This is NOT a production   
  release.                   
                             
  This is:                   
                             
  # a runtime prototype for  
  validating interaction     
  quality.                   
                             
  ---                        
                             
  ## IMPLEMENTATION TARGET   
                             
  Create:                    
                             
  # Mentium Kids Prototype   
  Runtime                    
                             
  inside:                    
                             
  /experimental/kids-brain-v 
  1                          
                             
  ---                        
                             
  ## EXISTING CORE FILES     
                             
  Inside:                    
                             
  /experimental/kids-brain-v 
  1/core                     
                             
  there are already          
  operational brain          
  specification files:       
                             
  * teacher-policy.md        
  * dialogue-rules.yaml      
  * recovery-engine.yaml     
  * immersion-engine.yaml    
  * learning-object.schema.j 
  son                        
  *                          
  session-state.schema.json  
  * example-transcripts.yaml 
                             
  These files are the SOURCE 
   OF TRUTH.                 
                             
  Your runtime must FOLLOW   
  them.                      
                             
  DO NOT replace them.       
                             
  ---                        
                             
  ## YOUR TASK               
                             
  Build ONLY the minimal     
  execution/runtime layer    
  required to validate:      
                             
  1. Emotional safety        
  2. Freeze/confusion        
  recovery                   
  3. English-first           
  interaction                
  4. Attention preservation  
  5. Natural teacher         
  interaction                
  6. Low-latency reactions   
                             
  ---                        
                             
  ## RUNTIME MODULES TO      
  CREATE                     
                             
  Create:                    
                             
  /experimental/kids-brain-v 
  1/runtime                  
                             
  with:                      
                             
  * orchestrator.ts          
  * recovery-manager.ts      
  * dialogue-manager.ts      
  * immersion-manager.ts     
  * session-engine.ts        
                             
  Keep implementation:       
                             
  * ultra-simple             
  * understandable           
  * testable                 
  * backend-authoritative    
                             
  ---                        
                             
  ## WHAT THE MVP MUST DO    
                             
  The prototype only needs   
  ONE topic:                 
                             
  # animals                  
                             
  Example vocabulary:        
                             
  * tiger                    
  * lion                     
  * elephant                 
  * monkey                   
  * dog                      
  * cat                      
                             
  The runtime must support:  
                             
  1. Start session           
  2. Teacher greeting        
  3. Tiny speaking task      
  4. Child response          
  classification             
  5. Recovery/scaffolding    
  6. Continue interaction    
  loop                       
  7. End session naturally   
                             
  ---                        
                             
  ## EXAMPLE FLOW            
                             
  Teacher:                   
  “Hi Alex! Today we’re      
  going to the zoo!”         
                             
  Teacher:                   
  “What animal do you see?”  
                             
  Child:                     
  “I don’t know.”            
                             
  Runtime:                   
                             
  * detect confusion         
  * trigger Recovery Engine  
  * use immersion ladder     
  * avoid immediate          
  translation                
  * simplify                 
  * gesture/model/hint       
  * preserve confidence      
  * continue naturally       
                             
  ---                        
                             
  ## VERY IMPORTANT          
                             
  The AI teacher must NEVER: 
                             
  * sound like ChatGPT       
  * produce long             
  explanations               
  * lecture grammar          
  * overwhelm the child      
  * wait too long before     
  reacting                   
  * shame mistakes           
  * aggressively correct     
                             
  ---                        
                             
  ## FAST REACTION PIPELINE  
                             
  This is CRITICAL.          
                             
  When the child responds:   
  the system must produce:   
                             
  * immediate emotional      
  acknowledgement            
    BEFORE                   
    full LLM reasoning       
  completes.                 
                             
  Example:                   
  “Awesome!”                 
  “Great try!”               
  “Wow!”                     
                             
  This should happen         
  independently of LLM       
  latency.                   
                             
  ---                        
                             
  ## BACKEND AUTHORITY RULES 
                             
  Backend must remain        
  authoritative.             
                             
  Frontend is only:          
                             
  * UI                       
  * audio input/output       
  * animation layer          
                             
  Frontend must NOT:         
                             
  * decide recovery states   
  * decide immersion levels  
  * track authoritative      
  confidence                 
  * bypass limits            
  * generate prompts         
                             
  ---                        
                             
  ## PROTOTYPE LIMITS        
                             
  Hard limits:               
                             
  * max session length: 15   
  min                        
  * max LLM calls: 20        
  * max TTS chars: 2000      
  * max STT duration: 60 sec 
                             
  If limits are reached:     
  fallback gracefully into   
  scripted mode.             
                             
  ---                        
                             
  ## IMPORTANT               
  IMPLEMENTATION PRIORITIES  
                             
  Priority order:            
                             
  1. emotional safety        
  2. natural interaction     
  3. low latency             
  4. recovery quality        
  5. immersion quality       
  6. curriculum correctness  
                             
  NOT the reverse.           
                             
  ---                        
                             
  ## LOGGING REQUIREMENTS    
                             
  Log:                       
                             
  * silence duration         
  * recovery triggers        
  * recovery success/failure 
  * confidence changes       
  * L1 rescue usage          
  * response latency         
  * child response type      
                             
  These logs are REQUIRED.   
                             
  ---                        
                             
  ## DO NOT OVERENGINEER     
                             
  Avoid:                     
                             
  * giant abstractions       
  * enterprise architecture  
  * premature optimization   
  * plugin systems           
  * generic frameworks       
                             
  This is an EXPERIMENTAL    
  runtime.                   
                             
  Clarity > scalability.     
                             
  ---                        
                             
  ## IMPLEMENTATION ROADMAP  
                             
  STEP 1                     
  Create runtime structure.  
                             
  STEP 2                     
  Implement session state    
  handling.                  
                             
  STEP 3                     
  Implement Recovery Engine  
  first.                     
                             
  STEP 4                     
  Implement immersion ladder 
   behavior.                 
                             
  STEP 5                     
  Implement dialogue         
  orchestration.             
                             
  STEP 6                     
  Implement fast-track       
  reactions.                 
                             
  STEP 7                     
  Implement one complete     
  interaction loop.          
                             
  STEP 8                     
  Add                        
  logging/instrumentation.   
                             
  STEP 9                     
  Test with scripted child   
  scenarios.                 
                             
  STEP 10                    
  Document known             
  limitations.               
                             
  ---                        
                             
  ## TEST SCENARIOS          
                             
  Must support:              
                             
  * child answers correctly  
  * child silent             
  * child confused           
  * child says “I don’t      
  know”                      
  * child answers in         
  Russian/Ukrainian          
  * child distracted         
  * child repeats wrong      
  answer twice               
                             
  ---                        
                             
  ## SUCCESS CRITERIA        
                             
  The prototype succeeds if: 
                             
  * interaction feels        
  emotionally safe           
  * recovery feels natural   
  * child never gets stuck   
  permanently                
  * interaction remains      
  mostly English-first       
  * latency feels responsive 
  * runtime stays            
  stable/simple              
                             
  ---                        
                             
  ## FINAL IMPORTANT RULE    
                             
  If architecture complexity 
   starts increasing         
  rapidly:                   
  ## FINAL IMPORTANT RULE                                       
                                                                
  If architecture complexity starts increasing rapidly:         
  STOP and simplify.                                            
                                                                
  The goal is:                                                  
                                                                
  # validating interaction intelligence                         
                                                                
  NOT building a massive platform.                              
                                                                

● Let me first explore what's already in the experimental
  directory before building anything.

  Searched for 2 patterns, read 1 file (ctrl+o to expand)

● Now let me read all the core spec files to understand the
  source of truth before building.

  Read 7 files (ctrl+o to expand)

● Now I have a complete picture of all spec files. Building the
  runtime in structured pieces.

  Piece 1 of 4 — types + curriculum data + logger

● Write(experimental\kids-brain-v1\runtime\types.ts)
  ⎿  Wrote 166 lines to
     experimental\kids-brain-v1\runtime\types.ts
       2   | 'CORRECT_CONFIDENT'nal =
       3   | 'CORRECT_HESITANT'
       4   | 'INCORRECT_ATTEMPT'
       5   | 'NO_RESPONSE'
       6   | 'L1_SWITCH'
       8   | 'EMOTIONAL_SHUTDOWN';
       9 
      10 export type QuestionType = 'RECOGNITION' | 'FORC
         ED_CHOICE' | 'SUPPORTED_PRODUCTION' | 'FREE_PROD
         UCTION';
     … +167 lines (ctrl+o to expand)

● Write(experimental\kids-brain-v1\runtime\animals-curriculum.ts
       )
  ⎿  Wrote 125 lines to experimental\kids-brain-v1\runtime\
     animals-curriculum.ts
         ;mport type { LearningObject } from './types.js'
       2 
       3 export const ANIMALS: LearningObject[] = [
       4   {
       5     id: 'SMS-U4-N001',
       6     word: 'cat',
       7     topic: 'Animals',
       8     forms: ['a cat', 'the cat', 'cats'],
       9     soundCueId: 'sfx_meow',
      10     visualCueId: 'img_cat_001',
     … +131 lines (ctrl+o to expand)

● Write(experimental\kids-brain-v1\runtime\logger.ts)
  ⎿  Wrote 35 lines to
     experimental\kids-brain-v1\runtime\logger.ts
         /types.js'; { SessionLog, SessionState } from '.
       2 
       3 const sessionLogs = new Map<string, SessionLog[]
         >();
       4 
       6   state: SessionState,
       7   type: SessionLog['type'],
       8   data: Record<string, unknown>
       9 ): void {
      10   const entry: SessionLog = {
     … +32 lines (ctrl+o to expand)

● Piece 2 of 4 — session-engine + recovery-manager

● Write(experimental\kids-brain-v1\runtime\session-engine.ts)
  ⎿  Wrote 194 lines to
     experimental\kids-brain-v1\runtime\session-engine.ts
      2 import type { SessionState, ItemState, QuestionTy
        pe, StartSessionParams } from './types.js';
      3 import { ANIMALS } from './animals-curriculum.js'
        ;
      4 import { log } from './logger.js';
      5 
      6 const SESSION_MAX_SECONDS = 15 * 60;
      7 export const LLM_CALL_CAP = 20;
      8 export const TTS_CHAR_CAP = 2000;
      9 const STARTING_CONFIDENCE = 30;
     … +222 lines (ctrl+o to expand)

● Write(experimental\kids-brain-v1\runtime\recovery-manager.ts)
  ⎿  Wrote 348 lines to
     experimental\kids-brain-v1\runtime\recovery-manager.ts
         veryLevel } from './types.js';sponseSignal, Reco
       2 import { applyConfidenceDelta, flagItem } from '
         ./session-engine.js';
       4 import { log } from './logger.js';
       5 // ─── Scripted script pools with rotation track
         ing ─────────────────────────────
       7 const EFFORT_PRAISE = [
       8   'Ooh, good try! Listen — ',
       9   'I love that you tried! It\'s ',
      10   'Great thinking! Did you hear? ',
     … +416 lines (ctrl+o to expand)
  ⎿  You've hit your monthly spend limit.
     /usage-credits to adjust your monthly spend limit.

✻ Cogitated for 11m 45s
   Continue ONLY the minimal runtime prototype.

Do NOT expand architecture.
Do NOT add new systems.
Do NOT add rewards/economy/multiplayer/features.

Finish ONLY:

* dialogue-manager.ts
* immersion-manager.ts
* orchestrator.ts

Then:

* wire the runtime together
* create one runnable interaction flow
* add simple test harness/scripts
* validate the complete ask → listen → recover → continue loop

Keep everything:

* simple
* testable
* backend-authoritative
* low-latency

Focus ONLY on:
interaction quality and recovery behavior.
