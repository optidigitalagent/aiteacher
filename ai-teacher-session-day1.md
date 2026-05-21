Read CLAUDE.md first.                                            
                                                                   
  TASK:                                                            
  Implement Phase 2E.1 — Paid Correction Quality Alignment for AI  
  Teacher.                                                         
                                                                   
  CONTEXT:                                                         
  The paid lesson runtime audit is complete.                       
                                                                   
  Audit findings confirmed:                                        
  - runtime architecture is strong                                 
  - backend authority is correct                                   
  - WS orchestration is stable                                     
  - reconnect/resync is stable                                     
  - guards are strong                                              
  - teacher brain architecture is already sophisticated            
  - Golden Runtime Certification passes                            
                                                                   
  This task is NOT about:                                          
  - rewriting runtime                                              
  - redesigning teacher prompts                                    
  - adding memory systems                                          
  - adding freeform conversation                                   
  - changing lesson FSM                                            
  - changing WS protocol                                           
  - adding extra AI calls                                          
                                                                   
  PRIMARY AUDIT FINDING:                                           
  The biggest remaining quality gap in paid lessons is:            
  correction specificity asymmetry.                                
                                                                   
  Specifically:                                                    
                                                                   
  Legacy correction path already contains:                         
  - deriveAnswerContext()                                          
  - answer-aware correction hints                                  
  - smarter contextual guidance                                    
  - TYPE_TURN_A_SUPPLEMENT logic                                   
                                                                   
  BUT:                                                             
  main engine/orchestrator path often falls back to:               
  - generic correction phrasing                                    
  - weak retry guidance                                            
  - less exercise-aware specificity                                
                                                                   
  Result:                                                          
  paid lessons sometimes feel:                                     
  “technically correct but pedagogically flat.”                    
                                                                   
  ==================================================               
  PRIMARY GOAL                                                     
  ==================================================               
                                                                   
  Improve paid lesson correction quality                           
  WITHOUT changing runtime architecture.                           
                                                                   
  Goal:                                                            
  feed the existing teacher brain                                  
  better correction context.                                       
                                                                   
  NOT:                                                             
  make the AI “smarter” through more inference.                    
                                                                   
  ==================================================               
  VERY IMPORTANT PRODUCT RULE                                      
  ==================================================               
                                                                   
  Paid lessons are NOT demo lessons.                               
                                                                   
  DO NOT:                                                          
  - make teacher overly conversational                             
  - create free chat behavior                                      
  - increase teacher verbosity                                     
  - add emotional overreaction                                     
  - add personality-heavy dialogue                                 
                                                                   
  Paid runtime must remain:                                        
  exercise-authoritative.                                          
                                                                   
  Conversation exists:                                             
  to support the exercise,                                         
  not replace it.                                                  
                                                                   
  ==================================================               
  TARGET OUTCOME                                                   
  ==================================================               
                                                                   
  Corrections should become:                                       
  - more specific                                                  
  - more contextual                                                
  - more pedagogically useful                                      
  - more answer-aware                                              
  - less generic                                                   
  - less robotic                                                   
                                                                   
  WITHOUT:                                                         
  - becoming long                                                  
  - becoming chatty                                                
  - leaking answers too early                                      
  - increasing latency/cost                                        
                                                                   
  ==================================================               
  REASONING MODE REQUIRED                                          
  ==================================================               
                                                                   
  Before coding:                                                   
                                                                   
  1. Inspect all paid correction paths.                            
                                                                   
  Map:                                                             
  - engine submit flow                                             
  - correction generation flow                                     
  - retry/stay logic                                               
  - teacher context builder                                        
  - correction hint builder                                        
  - answer evaluation layer                                        
  - deriveAnswerContext() usage                                    
  - TYPE_TURN_A_SUPPLEMENT usage                                   
  - orchestrator prompt assembly                                   
  - AI correction examples                                         
                                                                   
  2. Compare:                                                      
  legacy correction path                                           
  vs                                                               
  main engine/orchestrator path.                                   
                                                                   
  3. Identify:                                                     
  - what contextual information is lost                            
  - where specificity disappears                                   
  - where generic retries appear                                   
  - where correction hints flatten                                 
  - where teacher loses exercise precision                         
                                                                   
  4. Explain:                                                      
  - safest integration points                                      
  - lowest-risk alignment improvements                             
  - which existing utilities should be reused                      
  - where runtime determinism must remain untouched                
                                                                   
  ==================================================               
  IMPLEMENTATION STRATEGY                                          
  ==================================================               
                                                                   
  DO NOT create:                                                   
  - new AI systems                                                 
  - new orchestration layers                                       
  - new runtime abstractions                                       
  - new memory systems                                             
  - giant prompts                                                  
                                                                   
  Instead:                                                         
  improve correction-context alignment                             
  inside the existing architecture.                                
                                                                   
  ==================================================               
  IMPLEMENTATION REQUIREMENTS                                      
  ==================================================               
                                                                   
  1. Align engine path with smarter correction context             
  ==================================================               
                                                                   
  Ensure main engine/orchestrator path receives:                   
  - contextual answer hints                                        
  - exercise-aware retry guidance                                  
  - item-specific correction framing                               
  - grammar/vocabulary focus context                               
  - expected-answer shape hints                                    
                                                                   
  WITHOUT:                                                         
  - leaking exact answers immediately                              
  - over-explaining                                                
  - adding extra inference calls                                   
                                                                   
  ==================================================               
  2. Reuse existing correction intelligence                        
  ==================================================               
                                                                   
  Audit showed useful logic already exists in legacy path.         
                                                                   
  Safely reuse where appropriate:                                  
  - deriveAnswerContext()                                          
  - answer-specific hint generation                                
  - TYPE_TURN_A_SUPPLEMENT behavior                                
  - contextual retry framing                                       
  - answer-shape guidance                                          
                                                                   
  Prefer:                                                          
  consolidation                                                    
  over duplication.                                                
                                                                   
  ==================================================               
  3. Improve retry guidance quality                                
  ==================================================               
                                                                   
  Current weak pattern examples:                                   
                                                                   
  - “Try again.”                                                   
  - “Not quite.”                                                   
  - generic retries                                                
  - flat correction loops                                          
                                                                   
  Target:                                                          
  teacher gives:                                                   
  - directional guidance                                           
  - conceptual nudges                                              
  - structure hints                                                
  - grammar focus hints                                            
  - contextual clarification                                       
                                                                   
  GOOD examples:                                                   
                                                                   
  Instead of:                                                      
  “Incorrect. Try again.”                                          
                                                                   
  Prefer:                                                          
  “Your idea is close — the tense is the part causing trouble      
  here.”                                                           
                                                                   
  Instead of:                                                      
  “Not quite.”                                                     
                                                                   
  Prefer:                                                          
  “You have the right vocabulary, but the word order sounds        
  unnatural here.”                                                 
                                                                   
  ==================================================               
  4. Preserve pacing                                               
  ==================================================               
                                                                   
  Paid lessons are long-form lessons.                              
                                                                   
  Corrections must remain:                                         
  - concise                                                        
  - fast                                                           
  - lightweight                                                    
  - exercise-focused                                               
                                                                   
  Avoid:                                                           
  - mini essays                                                    
  - long teaching paragraphs                                       
  - over-analysis                                                  
  - over-correction                                                
                                                                   
  ==================================================               
  5. Preserve answer progression integrity                         
  ==================================================               
                                                                   
  DO NOT:                                                          
  - bypass retry logic                                             
  - bypass stay/advance decisions                                  
  - auto-advance incorrectly                                       
  - leak hidden answers                                            
  - change engine authority                                        
                                                                   
  The engine remains:                                              
  single source of truth.                                          
                                                                   
  Teacher only:                                                    
  interprets and guides.                                           
                                                                   
  ==================================================               
  6. Improve correction precision by exercise type                 
  ==================================================               
                                                                   
  Ensure corrections reflect:                                      
  - grammar exercise type                                          
  - vocabulary exercise type                                       
  - fill-gap structure                                             
  - ordering tasks                                                 
  - free speaking tasks                                            
  - multiple choice tasks                                          
                                                                   
  Teacher should sound aware of:                                   
  what kind of exercise this is.                                   
                                                                   
  ==================================================               
  7. Cursor alignment safety                                       
  ==================================================               
                                                                   
  Audit identified possible stale-context risks.                   
                                                                   
  Verify:                                                          
  teacher correction always references:                            
  - canonical current cursor                                       
  - canonical current item                                         
  - canonical retry state                                          
                                                                   
  NEVER:                                                           
  previous item accidentally.                                      
                                                                   
  ==================================================               
  8. Runtime trace visibility                                      
  ==================================================               
                                                                   
  If ENABLE_RUNTIME_TRACE=1,                                       
  optionally emit:                                                 
                                                                   
  - correction_context_built                                       
  - answer_context_derived                                         
  - retry_guidance_selected                                        
  - exercise_type_correction_used                                  
  - correction_specificity_score                                   
                                                                   
  NO:                                                              
  - raw transcript storage                                         
  - secret logging                                                 
  - sensitive payload dumps                                        
                                                                   
  ==================================================               
  9. Cost safety                                                   
  ==================================================               
                                                                   
  REQUIRED:                                                        
  - added AI calls = 0                                             
  - no DB writes                                                   
  - no Redis writes                                                
  - minimal prompt increase                                        
  - no transcript memory                                           
  - no runtime inflation                                           
                                                                   
  ==================================================               
  10. TTS compatibility                                            
  ==================================================               
                                                                   
  Ensure improved corrections:                                     
  - still work with TTS                                            
  - are not too long for speech pacing                             
  - degrade gracefully if TTS unavailable                          
                                                                   
  ==================================================               
  11. Scope boundaries                                             
  ==================================================               
                                                                   
  DO NOT:                                                          
  - redesign teacher personality                                   
  - redesign prompts globally                                      
  - copy demo conversational flow                                  
  - introduce emotional companion behavior                         
  - create autonomous tutoring                                     
  - weaken certification guarantees                                
                                                                   
  This phase is:                                                   
  pedagogical alignment refinement.                                
                                                                   
  ==================================================               
  MANUAL QA TARGETS                                                
  ==================================================               
                                                                   
  Verify manually on paid lessons:                                 
                                                                   
  1. Wrong grammar answer                                          
  → correction identifies grammar issue naturally                  
                                                                   
  2. Wrong vocabulary answer                                       
  → correction hints meaning/context problem                       
                                                                   
  3. Partial answer                                                
  → teacher guides structure without leaking answer                
                                                                   
  4. Retry loop                                                    
  → retries feel progressive, not repetitive                       
                                                                   
  5. Multiple exercise types                                       
  → correction style adapts appropriately                          
                                                                   
  6. Reload/reconnect                                              
  → correction still matches current cursor/item                   
                                                                   
  ==================================================               
  ACCEPTANCE CHECKLIST                                             
  ==================================================               
                                                                   
  - engine path receives richer correction context                 
  - correction specificity improved                                
  - retry guidance improved                                        
  - exercise-type-aware corrections improved                       
  - generic retries reduced                                        
  - no stale-item corrections                                      
  - pacing preserved                                               
  - no extra AI calls                                              
  - no runtime regressions                                         
  - no WS regressions                                              
  - no lesson FSM rewrite                                          
  - Golden Runtime still passes                                    
  - backend build/typecheck passes                                 
                                                                   
  RUN:                                                             
  - backend build/typecheck                                        
  - Golden Runtime Certification                                   
  - paid lesson manual QA                                          
  - reconnect/resync QA                                            
                                                                   
  FINAL REPORT:                                                    
  Return:                                                          
  - files changed                                                  
  - correction-context improvements                                
  - legacy logic reused                                            
  - before/after correction examples                               
  - runtime alignment safeguards                                   
  - trace additions                                                
  - cost impact                                                    
  - Golden Runtime result                                          
  - manual QA observations                                         
  - remaining weak correction patternsIMPORTANT:                   
  This task should be a surgical correction-context alignment fix, 
   not a teacher personality rewrite.                              

● I'll start by reading the project rules and then thoroughly
  inspect all paid correction paths before touching any code.

  Read 2 files (ctrl+o to expand)

● Now let me do a thorough exploration of the correction paths.

● Explore(Map all paid correction paths in the backend)
  ⎿  In progress… · 20 tool uses · 23.3k tokens · (ctrl+o to 
     (ctrl+b to run 38 background) 82 6
●
✢ ForDone (39 tool uses · 91.5k tokens · 1m 45s)
  (ctrl+o to expand)o ask a quick side question without 

● Excellent mapping. Now let me read the actual key files to see
  the exact code before touching anything.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

● Now let me read the exercise teaching files and the legacy
  correction path in lesson-ws.ts.

  Searched for 1 pattern, read 3 files (ctrl+o to expand)

● Now let me see how teacherInput from the orchestrator and the
  exercise teaching context (in the system prompt) are combined.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

● Now I have the complete picture. The gap is crystal clear:

  Root cause: buildCorrectionBlock() in master-orchestrator.ts (the
   engine path) is type-agnostic — it generates generic TURN
  instructions like "Ask ONE guiding question..." regardless of
  exercise type. Meanwhile, exercise-format-registry.ts already has
   rich type-specific hintPolicy.turnA/B/C for every exercise type.
   The registry's guidance reaches the system prompt via
  buildExerciseTeachingBrainSection(), but the per-turn user 
  message (teacherInput) overrides it with the generic text — which
   is what the AI acts on.

  Fixes needed:
  1. buildCorrectionBlock() must use
  getHintPolicy(exerciseType).turnA/B/C instead of generic text
  2. buildTeacherContextFromResult() must pass etr.exerciseType to
  buildCorrectionBlock()
  3. Add a lightweight deriveAnswerShapeHint() (mirrors legacy
  deriveAnswerContext()) for grammar-form answers
  4. Add trace log when ENABLE_RUNTIME_TRACE=1

  Read 1 file (ctrl+o to expand)
  ⎿  You've hit your session limit · resets 2:20pm (Europe/Kiev)
     /upgrade to increase your usage limit.
Continue from the identified root cause and implementation plan.

You already completed:

* full paid runtime audit
* correction-path mapping
* legacy vs engine-path comparison
* root-cause identification

DO NOT restart exploration.

Resume directly from the identified fixes:

1. buildCorrectionBlock()
   → replace generic correction guidance with exercise-type-aware guidance using:
   getHintPolicy(exerciseType).turnA/B/C

2. buildTeacherContextFromResult()
   → pass canonical exerciseType into correction-context generation

3. Implement lightweight deriveAnswerShapeHint()
   → grammar/vocabulary/order-aware answer-shape guidance
   → inspired by legacy deriveAnswerContext()
   → no transcript memory
   → no extra AI calls

4. Add optional runtime trace events when ENABLE_RUNTIME_TRACE=1:

* correction_context_built
* answer_context_derived
* retry_guidance_selected
* exercise_type_correction_used

IMPORTANT:
This is a surgical correction-context alignment fix.
Do NOT:

* redesign prompts
* rewrite orchestrator
* add freeform conversation
* add extra AI calls
* weaken runtime determinism
* modify lesson FSM
* modify WS protocol

After implementation:

* run backend typecheck
* run Golden Runtime Certification
* run paid lesson QA
* verify correction specificity improved without verbosity increase

Then return final report:

* files changed
* exact alignment fixes implemented
* before/after correction examples
* runtime safety safeguards
* trace additions
* Golden Runtime result
* remaining weak correction patterns
