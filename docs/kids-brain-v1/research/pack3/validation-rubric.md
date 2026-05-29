# Validation Rubric
## Mentium Kids — How We Know the Lesson Format Works

---

> This rubric defines what success looks like at every level: child, session, unit, and platform.
> All metrics must be observable or measurable — no subjective "feels engaging."
> Use this rubric during:
> - Internal QA of AI-generated lesson content
> - Real-child testing sessions
> - Weekly product review
> - Parent-facing progress reporting

---

## TIER 1: Child Engagement Metrics

### 1.1 Session Completion Rate
**Definition:** Percentage of sessions started that reach Phase 8 (Reward Moment)  
**Target:** ≥ 80% sessions completed to Phase 8  
**Warning threshold:** < 65%  
**Red flag:** < 50% — lesson format or pacing problem  
**Measurement:** Backend session event logging

---

### 1.2 Speaking Turn Count
**Definition:** Number of distinct child verbal outputs per session  
**Target:**
- Age 6: ≥ 12 speaking turns per session
- Age 7: ≥ 15 speaking turns
- Age 8: ≥ 15 speaking turns

**Warning threshold:** < 8 speaking turns — child is passive, not engaged  
**Red flag:** < 5 — child is not participating  
**Measurement:** STT event count per session

---

### 1.3 Session Return Rate (Streak)
**Definition:** Child returns within 48 hours of completing a session  
**Target:** ≥ 65% return within 48 hours  
**Warning threshold:** < 50%  
**Red flag:** < 35% — motivation/habit loop failing  
**Measurement:** Session start event within 48-hour window after completion

---

### 1.4 Mid-Session Drop Rate
**Definition:** Percentage of sessions abandoned before Phase 5  
**Target:** < 15%  
**Warning threshold:** > 25%  
**Red flag:** > 35% — early phases failing to hold attention  
**Measurement:** Phase-level event tracking

---

### 1.5 Recovery Activity Rate
**Definition:** Percentage of sessions that trigger a recovery activity  
**Target:** 20–40% (some recovery is healthy — means challenge is real)  
**Warning threshold:** < 10% (too easy) OR > 60% (too hard)  
**Red flag:** > 70% recovery rate — difficulty calibration failure  
**Measurement:** recovery_easiest_win event count per session

---

## TIER 2: Speaking Output Metrics

### 2.1 Target Word Production Rate
**Definition:** Percentage of target words produced by child (at least once) per session  
**Target:** ≥ 80% of target words produced by end of Lesson 2 in each unit  
**Warning threshold:** < 60%  
**Red flag:** < 40% — input phase insufficient or difficulty too high  
**Measurement:** STT word recognition events tagged to vocabulary list

---

### 2.2 Sentence Frame Completion Rate
**Definition:** Percentage of say_sentence activities where child produces the target frame  
**Target:** ≥ 70% of say_sentence prompts completed with at least partial production  
**Warning threshold:** < 50%  
**Red flag:** < 35% — production scaffolding insufficient  
**Measurement:** STT output matched against expected sentence frame pattern

---

### 2.3 Unprompted Production Rate [C]
**Definition:** Child produces a target word before teacher invites production  
**Target:** ≥ 1 instance per session at age 7–8  
**Note:** [C] This is a hypothesis requiring validation — may not be reliable at age 6  
**Measurement:** STT event occurring outside teacher-prompt window  
**Interpretation:** Leading indicator of word internalization

---

### 2.4 Choral-to-Solo Progression
**Definition:** Child who produces word only in choral (Phase 4) also produces solo (Phase 5)  
**Target:** ≥ 75% of words produced in choral are also produced solo in same session  
**Warning threshold:** < 55% — chant is not serving as bridge to production  
**Measurement:** Compare chant STT events to solo production events by word

---

### 2.5 L1 Response Rate
**Definition:** Percentage of child speaking turns delivered in L1  
**Target:** < 15% per session  
**Warning threshold:** > 30% — child defaulting to L1, not engaging English output  
**Red flag:** > 50% — lesson format not creating English-first habit  
**Measurement:** Language detection on STT output  
**Note:** Expected to be higher in first 2 units — trend matters more than absolute number

---

## TIER 3: Confusion Recovery Metrics

### 3.1 Recovery Success Rate
**Definition:** After recovery_easiest_win is triggered, does child produce a correct response?  
**Target:** ≥ 90% — recovery activities must always deliver a win  
**Warning threshold:** < 75%  
**Red flag:** < 60% — recovery activities are not easy enough; review activity selection  
**Measurement:** First child response after recovery_easiest_win event

---

### 3.2 Post-Recovery Continuation Rate
**Definition:** After recovery, does child continue to Lesson Phase 6 or beyond?  
**Target:** ≥ 70%  
**Warning threshold:** < 50%  
**Measurement:** Phase tracking event after recovery event

---

### 3.3 Rescue Ladder Depth Distribution
**Definition:** At what level of the English-first rescue ladder does child respond?  
**Target distribution:**
- Level 1 (repeat): ≥ 30% of rescues resolve here
- Level 2 (gesture): ≥ 25%
- Level 3 (forced choice): ≥ 25%
- Level 4–5: ≤ 15%
- Level 6 (L1 word): ≤ 5%

**Warning signal:** If >25% of rescues reach Level 5+, input phase is insufficient  
**Measurement:** Rescue ladder event depth logging per trigger

---

### 3.4 Silence Event Rate
**Definition:** Number of child silence events (exceeding tolerance window) per session  
**Target:** < 5 per session  
**Warning threshold:** > 8  
**Red flag:** > 12 — child disengaged or questions too hard  
**Measurement:** STT "no input" event count

---

## TIER 4: Parent-Visible Progress

### 4.1 Vocabulary Growth Tracking
**Definition:** Number of words child can produce across sessions, tracked cumulatively  
**Parent facing:** "Lena knows 12 English words this week!"  
**Target:** ≥ 4 new mastered words per unit (3 lessons)  
**Red flag:** 0 new mastered words after completing a full unit  
**Measurement:** Mastery signal from assessment_signals (3 correct solo productions)

---

### 4.2 Session Streak Display
**Definition:** Consecutive days with at least one completed session  
**Parent facing:** "7-day streak!" with positive framing  
**Target:** N/A — this is a display metric, not a threshold  
**Important:** Framed only positively. No "you broke your streak" mechanics.

---

### 4.3 Unit Completion Milestones
**Definition:** Unit successfully completed (all target words mastered or near-mastered)  
**Parent facing:** "Lena completed the Animals unit! She knows: dog, cat, bird, fish, elephant, rabbit."  
**Target:** ≥ 80% of enrolled children complete 1 unit within their first month  
**Red flag:** < 50% — onboarding lesson pacing or difficulty problem

---

### 4.4 Speaking Confidence Proxy [C]
**Definition:** Average response time from teacher prompt to child production, trend over time  
**Parent facing:** "Lena is responding faster — her confidence is growing!"  
**Target:** Response latency decreases by ≥ 20% between Lesson 1 and Lesson 10  
**Note:** [C] This is a proxy metric — does not directly measure confidence  
**Measurement:** Time delta between teacher prompt event and STT input start

---

### 4.5 Session Summary Quality
**Definition:** After each session, parent receives a summary that is specific and meaningful  
**Required elements:**
- Words learned today (listed by name)
- Words reviewed (listed)
- One specific observation ("Lena said 'elephant' very clearly today!")
- Next session preview ("Next: she'll learn rabbit and review all animals!")

**Anti-pattern:** "Great session today! Lena is making progress." (too generic — provides no signal)

---

## TIER 5: Teacher Quality Rubric (AI Output QA)

### 5.1 Correction Method Compliance
**Pass:** 100% of corrections are implicit recasts — no explicit negative correction ever  
**Fail indicator:** Any instance of "No," "Try again," "That's wrong"  
**Testing method:** Manual review of generated transcripts + automated filter check  
**Target:** 0 explicit corrections per 100 reviewed sessions

---

### 5.2 English-First Compliance
**Pass:** L1 use ≤ 1 word per session, only when prescribed by rescue ladder Level 6  
**Fail indicator:** L1 explanation, L1 instruction, L1 translation task  
**Testing method:** Language detection on all teacher turns  
**Target:** 0 non-prescribed L1 utterances

---

### 5.3 Vocabulary Control Compliance
**Pass:** All teacher output uses only words from current lesson wordlist + core teacher language  
**Fail indicator:** Teacher uses vocabulary not in the approved lists  
**Testing method:** Token-level vocabulary audit against lesson wordlist  
**Target:** 0 out-of-vocabulary teacher utterances

---

### 5.4 Praise Specificity Score
**Definition:** Percentage of praise utterances that name a specific word or action  
**Target:** ≥ 80% of all praise utterances are specific  
**Anti-pattern rate:** ≤ 20% "Good job!" / "Well done!" / "Nice!" without specificity  
**Testing method:** Regex pattern match on praise events + manual review sample

---

### 5.5 Sentence Complexity Compliance
**Definition:** Teacher sentences conform to age-appropriate length limits  
**Target:** 0% of teacher turns exceed 15 words for age 6, 18 words for age 7–8  
**Testing method:** Token count on all teacher utterances

---

### 5.6 Transition Quality Score [C]
**Definition:** Percentage of activity transitions embedded in narrative vs announced  
**Target:** ≥ 90% of transitions use story framing  
**Fail indicator:** "Now let's do activity 2." / "OK, that's done."  
**Testing method:** Manual review of transition utterances (10% sample)

---

## TIER 6: Red Flags — What Must Be Investigated Immediately

| Red Flag | Threshold | Likely Cause |
|----------|-----------|-------------|
| Session completion rate below 50% | 1 week sustained | Pacing too slow / lesson too long / story hook not engaging |
| Speaking turns below 8 per session | > 20% of sessions | Questions too hard / silence handling failure |
| L1 response rate above 50% | Any unit | English-first mechanics failing / vocabulary too hard |
| Recovery rate above 70% | Any unit | Vocabulary load too high / input insufficient before production |
| Parent session summary flagged as unhelpful | > 30% parent feedback | Summary template too generic |
| L6 rescue ladder used in > 10% of sessions | Any unit | Vocabulary not matched to CEFR level |
| Mid-session dropout before Phase 5 | > 30% of sessions | Story hook not landing / first activities too hard |
| Explicit correction appearing in generated output | Any instance | LLM constraint failure — must be fixed immediately |

---

## TIER 7: Real-Child Testing Protocol

### What Must Be Observed Before Launch

**Minimum viable test:** 20 children, ages 6–8, across 3 complete units (9+ lessons)

#### Session Observations (Researcher-Observed)
Researcher watches live session (or recording) and notes:

- [ ] Does child understand what to do in Phase 0 (greeting)?
- [ ] Does child engage with the story hook (Phase 1)?
- [ ] Does child show recognition of target words in Phase 3?
- [ ] Does child produce target words in Phase 5?
- [ ] Does child show signs of wanting to continue (Phase 9 cliffhanger landed)?
- [ ] Does child show distress at any correction moment?
- [ ] Does child show enjoyment or pleasure at any point?
- [ ] Does child seem bored? (Look for: looking away, playing with objects, monosyllabic responses)

#### Post-Session Child Interview (Age-Appropriate)
Researcher (not teacher) asks child:
- "What animals did you learn today?" (free recall — not prompted)
- "Who did you help today?" (character recall)
- "Was it fun? Was it hard?"
- "Do you want to do it again tomorrow?" (key retention signal)

**Target:** ≥ 70% of children want to return immediately or the next day

#### Post-Session Parent Interview
- "Did your child mention the lesson afterwards unprompted?"
- "Did your child say any English words after the lesson?" (transfer to real life — highest quality signal)
- "Were there any moments that seemed hard or frustrating?"
- "Was the session summary useful? Did it tell you something new?"

---

### Definition of "Format Working"

The Mentium Kids lesson format is validated when:

1. **≥ 80% session completion rate** across 20 test children over 3 units
2. **≥ 15 speaking turns per session average** at age 7–8, ≥ 12 at age 6
3. **≥ 4 new words mastered per unit** (3 solo correct productions)
4. **≥ 65% return rate within 48 hours** of a completed session
5. **≥ 70% of test children want to return** (post-session interview)
6. **Zero instances of visible child distress** attributable to correction or test framing
7. **At least 1 parent reports** child used an English word from the lesson in real life per 5 children tested

---

## Appendix: Evidence Classification Summary

All metrics in this rubric are classified:

**[A] Strong evidence:** The metric is rooted in established learning science (e.g., speaking turn count as proxy for engagement, mastery defined by multiple-context production).

**[B] Expert consensus:** The metric is widely used in elite YL classrooms and EdTech assessment, though large-scale controlled studies for AI-specific contexts are limited (e.g., return rate as a retention proxy).

**[C] Product hypothesis:** The metric is a reasonable hypothesis specific to Mentium Kids' design that requires validation (e.g., response latency as a confidence proxy, unprompted production as internalization signal).

All [C] metrics should be actively tested and either promoted to [B] or discarded after 3-month validation cycle.
