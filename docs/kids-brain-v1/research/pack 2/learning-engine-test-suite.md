# learning-engine-test-suite.md
# Realistic scenario tests for the Mentium Kids Learning Engine.
# Each scenario defines input state, expected decision, expected activity, and expected mastery update.
# All tests are deterministic: given the input, there is exactly one correct output.

---

## How to Use This Suite

Each scenario is a unit test for the backend progression engine.
Inputs map to the Child State Vector + Activity History.
Expected outputs map to the Decision Packet.
If the engine produces a different output, a rule is either missing, wrong, or mis-ordered.

---

## Scenario 01: Fast Learner — Consistent Correct Confident

### Description
Child has been responding correctly and confidently to "cat" across 3 activities. High confidence. Low frustration. Good engagement. Now on `sentence_frame_production`.

### Input State
```yaml
word: cat
current_activity: sentence_frame_production
classification_last_3: [correct_confident, correct_confident, correct_confident]
production_confidence: 78
comprehension_confidence: 75
engagement: 82
frustration: 12
fatigue: 20
consecutive_correct: 3
mastery_level: developing
session_time_elapsed_seconds: 420
```

### Expected Progression Decision
```yaml
progression: advance
rule_triggered: R20 (triple correct_confident)
```

### Expected Next Activity
```yaml
next_activity: sentence_production
next_item: same (cat)
difficulty: 5
```

### Expected Mastery Update
```yaml
mastery_delta: +6
new_production_confidence: 84  (78 + 8 * 0.75)
mastery_level: developing  (not yet secure; single session, insufficient cross-session evidence)
review_scheduled: true
```

### Expected Teacher Action
```yaml
teacher_action: calibrated_celebration
feedback_tone: warm
```

### Notes
Fast learners must not skip mastery levels. `developing → secure` requires cross-session evidence. Engine must advance activity demand but not mastery level.

---

## Scenario 02: Child Guesses — Fast Random Responses

### Description
Child is responding extremely quickly (under 400ms) with correct responses. Response speed indicates guessing rather than retrieval. Performance appears good but is unreliable.

### Input State
```yaml
word: dog
current_activity: forced_choice_4
classification_last_4: [correct_confident, correct_confident, correct_confident, correct_confident]
response_latency_ms_last_4: [310, 280, 320, 290]  # all below plausible processing time
production_confidence: 55
comprehension_confidence: 52
engagement: 74
frustration: 15
consecutive_correct: 4
mastery_level: emerging
```

### Expected Progression Decision
```yaml
progression: stay
rule_triggered: R_response_speed (too fast = guessing detected)
note: >
  Despite consecutive correct, response speed signals guessing.
  Engine must NOT advance. Move to activity that prevents guessing
  (e.g., supported_production requires actual production, not pointing).
```

### Expected Next Activity
```yaml
next_activity: supported_production
reason: forces genuine retrieval — guessing not possible
next_item: same (dog)
```

### Expected Mastery Update
```yaml
mastery_delta: 0
mastery_level: emerging (unchanged)
note: Guessing correct answers must NOT increment mastery signals.
```

### Expected Teacher Action
```yaml
teacher_action: demand_shift_to_production
```

### Notes
The guessing detection rule is not in progression-rules.yaml as a standard rule — it should be added as R83. This test identifies a gap in the current rule set. **[C] — requires response latency threshold calibration.**

---

## Scenario 03: Comprehension Present, Production Absent

### Description
Child understands "bird" perfectly (comprehension_confidence = 85) but cannot produce it (production_confidence = 28). Succeeds at all forced_choice activities, fails at all production activities.

### Input State
```yaml
word: bird
current_activity: supported_production
classification: no_response
classification_last_3: [correct_confident, correct_confident, no_response]
                    # last 2 were forced_choice_4 (reception), current is production
production_confidence: 28
comprehension_confidence: 85
engagement: 61
frustration: 38
consecutive_wrong: 1
mastery_level: developing
```

### Expected Progression Decision
```yaml
progression: lower_difficulty
rule_triggered: R50 (no_response → two levels down)
note: >
  Comprehension is strong but production demand is too high.
  Lower demand, do not penalize comprehension score.
```

### Expected Next Activity
```yaml
next_activity: forced_choice_4
reason: two levels below supported_production
next_item: same (bird)
```

### Expected Mastery Update
```yaml
production_confidence: 22  (28 - 6)
comprehension_confidence: 85  (unchanged — comprehension not in error)
mastery_level: developing  (unchanged)
```

### Expected Teacher Action
```yaml
teacher_action: model_and_invite
feedback_tone: gentle_correction
```

### Notes
Comprehension ≠ production ability. Engine must track and update these separately. Never penalize comprehension for production failure. **[A]**

---

## Scenario 04: Repeated Failure — Consecutive Wrong

### Description
Child has failed "fish" three consecutive times with wrong_random responses. High frustration. Current activity is sentence_frame_production.

### Input State
```yaml
word: fish
current_activity: sentence_frame_production
classification_last_3: [wrong_random, wrong_random, wrong_random]
production_confidence: 22
comprehension_confidence: 30
engagement: 38
frustration: 72
consecutive_wrong: 3
mastery_level: emerging
```

### Expected Progression Decision
```yaml
progression: lower_difficulty + easiest_win
rule_triggered: R10 (frustration >= 75) → easiest_win first; R52 (triple wrong → listen_and_point)
execution_order:
  1. Insert easiest_win (known-mastered item at forced_choice_2)
  2. After easiest_win success: return to fish at listen_and_point
```

### Expected Next Activity
```yaml
step_1_next_activity: easiest_win (forced_choice_2 with mastered item)
step_2_next_activity: listen_and_point (fish)
```

### Expected Mastery Update
```yaml
mastery_delta: -8  (triple wrong_random)
production_confidence: 14
comprehension_confidence: 24
mastery_level: emerging  (already at floor)
review_due_shortening: reschedule review sooner
```

### Expected Teacher Action
```yaml
teacher_action: full_reset_warm (on fish return)
feedback_tone: warm (never punitive)
```

### Notes
The engine must NOT continue with fish at the same demand level. Full reset to reception. Easiest win protects child emotional state before re-engaging. **[B]**

---

## Scenario 05: Child Disengages Mid-Session

### Description
After 8 minutes of lessons, child's engagement has dropped sharply. Responses are increasingly slow. Some off_task responses. Correct response rate normal but latency high.

### Input State
```yaml
current_activity: sentence_production
classification_last_5: [correct_hesitant, off_task, correct_hesitant, off_task, no_response]
production_confidence: 62
comprehension_confidence: 68
engagement: 28
frustration: 30
fatigue: 55
session_time_elapsed_seconds: 510
consecutive_same_activity: 4
```

### Expected Progression Decision
```yaml
progression: switch_activity + decrease_challenge
rule_triggered: R70 (engagement < 35, consecutive_same >= 3)
secondary: R80 (off_task events do not update mastery)
```

### Expected Next Activity
```yaml
next_activity: forced_choice_4  (two levels below sentence_production — decrease demand)
insert_novelty: true
teacher_action: novelty_introduction
```

### Expected Mastery Update
```yaml
mastery_delta: 0 for off_task events
mastery_delta: +2 for correct_hesitant events (already applied)
```

### Expected Teacher Action
```yaml
teacher_action: engagement_boost
feedback_tone: warm
```

### Notes
This child is not failing — they're drifting. Reducing demand AND switching activity format is the correct response. Do not close lesson yet (engagement = 28, above critical). **[B]**

---

## Scenario 06: Child Answers Randomly

### Description
All recent responses have been wrong_random. Pattern suggests the child is not processing stimuli — possibly distracted or struggling to understand the task itself.

### Input State
```yaml
word: tree
current_activity: forced_choice_4
classification_last_5: [wrong_random, wrong_random, wrong_random, wrong_random, wrong_random]
production_confidence: 15
comprehension_confidence: 18
engagement: 22
frustration: 65
consecutive_wrong: 5
mastery_level: emerging
```

### Expected Progression Decision
```yaml
progression: emotional_stop consideration
rule_triggered: R52 (triple wrong → listen_and_point) → but with 5 consecutive wrong_random
              AND ES03 (wrong_random_last_5 >= 4 AND engagement < 25) → behavioral_stop
execution_order:
  1. Insert easiest_win at absolute lowest demand
  2. Execute cheerful_early_close
```

### Expected Next Activity
```yaml
next_activity: easiest_win (listen_and_point with automatic-mastery item)
then: lesson close
```

### Expected Mastery Update
```yaml
mastery_delta: accumulated from session
mastery_level: emerging (no advancement)
progress_saved: partial
```

### Expected Teacher Action
```yaml
teacher_action: cheerful_early_close
note: "No punitive language. Celebrate what WAS done."
```

---

## Scenario 07: Child Becomes Overexcited

### Description
Child is very fast, energetic, calling out answers before teacher finishes prompt. Response latency is extremely low. Despite high correct rate, accuracy on repeated exposure shows inconsistency.

### Input State
```yaml
current_activity: repeat_after_me
classification_last_5: [correct_confident, correct_confident, correct_confident, correct_confident, imitation_only]
response_latency_ms_last_5: [250, 210, 180, 230, 150]  # consistently below threshold
engagement: 92
frustration: 5
consecutive_correct: 4
production_confidence: 55
comprehension_confidence: 48
```

### Expected Progression Decision
```yaml
progression: stay (do not advance despite apparent performance)
rule_triggered: over_excitement detection (response_too_fast x3)
note: >
  Apparent engagement (92) is excitement, not productive engagement.
  Must shift to an activity that cannot be gamed by speed.
```

### Expected Next Activity
```yaml
next_activity: forced_choice_4
reason: requires deliberate point/select — not beatable by calling out
teacher_action: slow_activity_pacing
note: Do not increase reward frequency.
```

### Expected Mastery Update
```yaml
mastery_delta: 0 for guessing events
mastery_delta: +2 for genuine imitation_only
production_confidence: 57
```

### Notes
Over-excitement masquerades as high engagement. The engine must detect it via response latency. **[C] — threshold requires calibration.** This is a gap in current progression-rules.yaml.

---

## Scenario 08: Child Masters Vocabulary Quickly (Genuine)

### Description
Child has worked through "sun" across 2 sessions with consistent correct_confident responses. Now in session 3 with very high confidence. Has succeeded in 3 activity types. Mastery evidence is genuinely strong.

### Input State
```yaml
word: sun
sessions_with_correct_production: 3
correct_production_count: 8
correct_comprehension_count: 11
activity_types_succeeded_in: [forced_choice_4, supported_production, sentence_frame_production]
production_confidence: 88
comprehension_confidence: 86
classification_last_3: [correct_confident, correct_confident, correct_confident]
mastery_level: developing
consecutive_correct: 3
weeks_since_introduction: 2
```

### Expected Mastery Update
```yaml
mastery_delta: +8
new_mastery_level: secure
note: >
  All developing → secure criteria met:
  - correct_production >= 3 across ≥2 sessions ✓
  - correct_comprehension >= 5 ✓
  - activity_diversity >= 2 ✓
  - consecutive_correct_final >= 2 ✓
  (weeks_since_introduction not required for developing → secure)
```

### Expected Progression Decision
```yaml
progression: advance_item
next_item: next unmastered vocabulary item in lesson
next_activity: introduction demand level (reset for new item)
review_schedule: set secure review intervals [7, 14, 30 days]
```

### Expected Teacher Action
```yaml
teacher_action: celebratory_transition
reward_trigger: true
feedback_tone: celebratory
```

### Notes
This is the one scenario where the engine CAN advance mastery level to `secure`. Evidence is genuine and cross-session. **[A]**

---

## Scenario 09: Review Failure — Previously Mastered Item

### Description
Item "hat" was at `secure` mastery. Child fails it in review_production after a 10-day gap. Two wrong responses.

### Input State
```yaml
word: hat
mastery_level: secure
current_activity: review_production
classification_last_2: [wrong_semantic, wrong_semantic]
days_since_last_correct: 10
production_confidence: 68  (was 82 before this session)
comprehension_confidence: 75
```

### Expected Mastery Update
```yaml
mastery_delta: -8  (two wrong_semantic in review)
new_production_confidence: 60
mastery_check_triggered: true
mastery_decay_check: secure → potential decay_to_developing (if confidence below threshold)
new_mastery_level: developing  (confidence below 70 threshold for secure retention)
review_rescheduled: true
next_review: in 2 days (failed retrieval shortening)
```

### Expected Progression Decision
```yaml
progression: scaffold
next_activity: sentence_production (one level below review_production)
```

### Expected Teacher Action
```yaml
teacher_action: return_with_support
feedback_tone: neutral  (no punishment for review failure — it is expected and normal)
```

### Notes
Review failure is **not a failure of the system or child.** It is information about forgetting. The engine must respond by scheduling earlier re-review and downgrading mastery, not by signaling failure to child. **[A]**

---

## Gap Analysis

The following behaviors identified in test scenarios are NOT currently covered by explicit rules in progression-rules.yaml and should be added:

| Gap | Description | Suggested Rule ID | Evidence |
|-----|-------------|------------------|----------|
| Guessing detection | Response_too_fast consistently = guessing | R83 | C |
| Over-excitement detection | response_too_fast x3 → slow down, no advance | R84 | C |
| Review failure mastery decay | wrong in review → mastery check + level possible drop | Already in mastery-model.yaml; needs explicit rule trigger | B |
| Latency-based mastery skepticism | Fast correct at forced_choice = no mastery delta | R85 | C |

All three new rules require empirical calibration of response latency thresholds with real user data before deployment.
