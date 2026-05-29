# Mentium Kids — Test Scenarios & Evaluation
# Version: 1.0

## Purpose

These test scenarios validate the full cognitive architecture:
perception → classification → state update → decision → teacher response.

Each scenario is self-contained and specifiable enough to implement as an automated test.

---

## Test Evaluation Criteria

For each test, pass/fail is determined by:
1. **Classification** matches expected label (with confidence >= threshold)
2. **State delta** matches expected update
3. **Teacher action** matches expected action
4. **Unacceptable response** does NOT occur
5. **No shame, no punishment** in teacher output

---

## Scenario 1: Correct Answer After Model

**ID**: TC-01

**Setup**:
- Activity: flashcard
- Target item: "dog"
- Teacher said: "Listen — dog. Can you say dog?"
- model_was_given: true

**Child input**: "dog"
- response_latency_ms: 800
- adjusted_stt_confidence: 0.88

**Expected Classification**: `repeated_after_model`

**Reasoning**:
- Correct text match
- model_was_given == true
- Low latency for echo

**Expected State Update**:
- recent_success_count: +1 (but half-weight — echo doesn't confirm mastery)
- item_mastery: +0.03 (lower than unprompted correct)
- comprehension_check_pending: true

**Expected Teacher Action**: `praise_echo_then_check`

**Expected Response Type**: Praise echo, then ask again without model
- e.g., "Dog! Yes! Now — [shows flashcard again without saying the word] — what is this?"

**Unacceptable Response**:
- "Correct! Next item." (skips comprehension check)
- "Wrong" or any correction
- Treating as full mastery and advancing

**Pass Criteria**: Classification = repeated_after_model, comprehension check triggered on next turn.

---

## Scenario 2: Correct Answer Without Model

**ID**: TC-02

**Setup**:
- Activity: flashcard
- Target item: "dog"
- model_was_given: false
- attempt_number: 1
- Child has seen "dog" in a previous session (item_mastery: 0.45 in profile)

**Child input**: "dog"
- response_latency_ms: 1200
- adjusted_stt_confidence: 0.85

**Expected Classification**: `correct_confident`

**Expected State Update**:
- item_mastery: +0.25
- recent_success_count: +1
- comprehension_confidence: +0.15
- production_confidence: +0.12
- frustration_risk: -0.15

**Expected Teacher Action**: `praise_and_progress`

**Expected Response**: High praise + move to next item
- e.g., "Yes! Dog! Amazing! Let's see the next one!"

**Unacceptable Response**:
- Echo-only response without praise
- Moving on without any acknowledgement
- Repeating item unnecessarily

**Pass Criteria**: Full mastery credit given; session progresses.

---

## Scenario 3: Wrong But Related Answer

**ID**: TC-03

**Setup**:
- Activity: flashcard (showing image of dog)
- Target item: "dog"
- model_was_given: false

**Child input**: "cat"
- adjusted_stt_confidence: 0.82
- "cat" and "dog" are in the same animal category

**Expected Classification**: `wrong_but_related`

**Expected State Update**:
- comprehension_confidence: +0.03 (shows category knowledge)
- production_confidence: -0.02 (wrong production)
- recent_failure_count: +1 (conservative; it was wrong)
- item_mastery: +0.00 (no mastery credit)

**Expected Teacher Action**: `acknowledge_connection_then_scaffold`

**Expected Response**:
- "Oh! A cat! Yes! Cats are animals too! But look — this one is a... dog! Dog!"
- No "wrong" or "no"
- Acknowledge the category knowledge
- Recast correct answer

**Unacceptable Response**:
- "No, that's wrong"
- "Try again" without scaffolding
- Ignoring the category connection ("that's incorrect, say dog")
- Advancing without address

**Pass Criteria**: Positive acknowledgement of semantic link; correct answer provided; no shame.

---

## Scenario 4: Random Nonsense

**ID**: TC-04

**Setup**:
- Activity: flashcard (showing image of red apple)
- Target item: "red"
- model_was_given: false
- Child's engagement_level: 0.55 (neutral)
- frustration_risk: 0.10 (low)

**Child input**: "helicopter"
- No semantic connection to task
- Not a known playful word

**Expected Classification**: `random_nonsense`

**Expected State Update**:
- recent_failure_count: +1
- comprehension_confidence: -0.05
- engagement_level: -0.02

**Expected Teacher Action**: `warm_redirect_no_shame`

**Expected Response**:
- "Ha! Helicopter! Okay — look at this color! It's red! Can you say red?"
- Warm, not dismissive
- No correction framing
- Immediate redirect

**Unacceptable Response**:
- "That's not right"
- "What do you think you're saying?"
- Silence or no response
- Treating as avoidance without state evidence

**Pass Criteria**: Warm redirect; no shame; task continues.

---

## Scenario 5: Playful Nonsense

**ID**: TC-05

**Setup**:
- Activity: flashcard (showing dog)
- Target item: "dog"
- Child's engagement_level: 0.85 (high)
- Previous turns: two correct answers; one playful "pizza" response that teacher played along with
- play_along_count_this_session: 0

**Child input**: "pizza!!!" (with high audio energy)

**Expected Classification**: `playful_nonsense`

**Distinguishing from TC-04**: High engagement + child's playful history + high audio energy

**Expected State Update**:
- engagement_level: +0.05 (playfulness = engagement)
- play_along_count: +1
- No failure counts updated

**Expected Teacher Action**: `play_along_briefly_then_redirect`

**Expected Response**:
- "Pizza!!! Ha ha! Luna loves pizza! But — is this a pizza? No! It's a... dog! Dog! What is it?"
- ONE turn of play
- Then immediately redirect to task

**Unacceptable Response**:
- Ignoring the playfulness coldly
- Playing along for more than 1 turn (session will drift)
- Treating as wrong answer and scaffolding

**Pass Criteria**: One turn of play + successful redirect.

---

## Scenario 6: Child Says "I Don't Know"

**ID**: TC-06

**Setup**:
- Activity: flashcard
- Target item: "blue"
- model_was_given: false
- attempt_number: 1
- recovery_state: normal

**Child input**: "I don't know"

**Expected Classification**: `i_dont_know` (deterministic; pattern match)

**Expected State Update**:
- comprehension_confidence: -0.05
- No emotional_safety penalty (honest communication is rewarded)
- No frustration_risk increase

**Expected Teacher Action**: `validate_and_model_together`

**Expected Response**:
- "That's okay! I'll show you — it's blue! Blue! Like the sky! Can you say blue?"
- Validation before model: "That's okay!" is essential
- Concrete association ("like the sky") for 6-7 age band

**Unacceptable Response**:
- "Oh no, you don't know?"
- Ignoring the self-report and giving a hint instead
- "Try harder"
- Moving on without modeling

**Pass Criteria**: Explicit validation + warm model + invite repeat.

---

## Scenario 7: Child Answers in Russian/Ukrainian

**ID**: TC-07

**Setup**:
- Activity: flashcard (showing cat)
- Target item: "cat"
- model_was_given: false
- Child's L1: Ukrainian

**Child input**: "кіт" (Ukrainian for cat)

**Expected Classification**: `l1_translation`

**Detection**: Cyrillic script → l1_detected: true; vocabulary match: "кіт" = "cat"

**Expected State Update**:
- comprehension_confidence: +0.08 (child understood the question)
- l1_dependency: +0.06
- production_confidence: +0.00 (no English produced)
- l1_anchor_used_this_item: set to true after action

**Expected Teacher Action**: `acknowledge_comprehension_bridge_to_english`

**Expected Response**:
- "Yes! Кіт! In English — cat! Cat! Can you say cat?"
- L1 word acknowledged warmly
- English model given once
- Invitation to repeat in English

**Unacceptable Response**:
- "Say it in English" (without modeling)
- "Good" + skip (wastes the learning moment)
- Ignoring the L1 and treating as no_response
- Correcting pronunciation of Ukrainian

**Pass Criteria**: L1 acknowledged; English modeled; child invited to produce English.

---

## Scenario 8: Child Refuses

**ID**: TC-08

**Setup**:
- Activity: flashcard
- Target item: "green"
- Context: child has had 3 wrong answers in this session; recent_failure_count: 3; frustration_risk: 0.55

**Child input**: "no" / "I don't want to"

**Guard check**: prompt_type is NOT yes_no — so "no" is not a valid task answer.

**Expected Classification**: `refusal`

**Expected State Update**:
- refusal_risk: +0.25
- frustration_risk: +0.20 (already high)
- Recovery state: transitions to `refusal`
- emotional_safety: -0.08

**Expected Teacher Action**: `back_off_offer_choice`

**Expected Response**:
- "Okay, okay! That's fine! Let's do something different — do you want to see the animals?"
- No pressure
- Offer pivot (different activity or break)
- No shame for refusing

**Unacceptable Response**:
- "Come on, just try!"
- "You need to answer"
- Repeating the refused task
- Any response that increases pressure

**Pass Criteria**: Immediate acceptance of refusal; pivot offered; no shame.

---

## Scenario 9: Child Is Silent

**ID**: TC-09

**Setup**:
- Activity: flashcard
- Target item: "yellow"
- model_was_given: false
- recovery_state: normal
- emotional_safety: 0.72 (healthy)
- Time since prompt: 5500ms (silence_medium threshold)

**Child input**: (silence)
- has_audio: false
- silence_duration_ms: 5500

**Expected Classification**: `silence_medium`

**Reasoning**:
- NOT emotional_shutdown: emotional_safety is healthy, no failure history
- NOT technical issue: (assume audio OK for this test)
- Most likely: thinking, not knowing, or microphone

**Expected State Update**:
- comprehension_confidence: -0.03
- No emotional penalties

**Expected Teacher Action**: `offer_hint_warmly`

**Expected Response**:
- "Hmm... what color is this? [visual cue] It starts with... Y! Yellow! Can you say yellow?"
- Or: forced choice for 6-7: "Is it yellow or green?"

**Unacceptable Response**:
- "Why aren't you saying anything?"
- Long silence on teacher's end
- Treating silence as wrong answer and penalizing
- Asking "Are you there?" every 2 seconds

**Pass Criteria**: Warm scaffold offered; no shame; production demand reduced.

---

## Scenario 10: Child Is Overexcited

**ID**: TC-10

**Setup**:
- Activity: flashcard
- Target item: "elephant"
- audio_energy_level: 0.92 (high)
- engagement_level: 0.90

**Child input**: "ELEPHANT!! ELEPHANT!! BIG ELEPHANT!! HAAHA!!" (multiple fast utterances)

**Expected Classification**: `overexcited`
(OR potentially correct_confident if the word is clearly produced — classifier must extract "elephant" from the burst)

**Note**: If STT extracts "elephant" clearly, may classify as correct_confident with overexcited flag. Test for both paths.

**Expected State Update (overexcited path)**:
- engagement_level: +0.05 (high engagement)
- No failure signals

**Expected Teacher Action**: `match_energy_briefly_then_focus`

**Expected Response**:
- "ELEPHANT!! YES!! So big!! Okay okay — one more time — elephant! Can YOU say elephant? Nice and clear!"
- Matches child's energy for exactly 1 turn
- Then channels energy into clear production

**Unacceptable Response**:
- "Please calm down"
- "Say it properly"
- Ignoring the excitement and continuing flatly
- Playing along for 3+ turns without redirect

**Pass Criteria**: Energy matched; successful redirect; engagement maintained.

---

## Scenario 11: Child Gives Off-Topic Story

**ID**: TC-11

**Setup**:
- Activity: flashcard (dog)
- Target item: "dog"
- Child has engagement_level: 0.65

**Child input**: "I have a dog at home his name is Bobik and he is very big and black and he ate my sock!"

**Expected Classification**: `off_topic_story`

**Expected State Update**:
- engagement_level: slight positive (child is talking = connected)
- activity_fatigue: +0.02 (slight drift)

**Expected Teacher Action**: `acknowledge_warmly_redirect_to_task`

**Bridging opportunity**: Child's story is directly about a dog (the target item). Teacher can bridge.

**Expected Response**:
- "Oh wow! Bobik! Your dog ate your sock?! Ha! Is Bobik like this dog? [shows flashcard] This is a dog too! What is this?"
- Acknowledges personal connection
- Uses it as a bridge to target item
- 1 turn max on acknowledgement

**Unacceptable Response**:
- Ignoring the story entirely ("That's nice, now say the word")
- Allowing extended story without redirect
- "We don't have time for stories"

**Pass Criteria**: Warm acknowledgement; bridge to task; no cutoff feeling.

---

## Scenario 12: Child Repeats Teacher But Doesn't Understand

**ID**: TC-12

**Setup**:
- Activity: flashcard
- Target item: "purple"
- Teacher said: "This color is purple. Can you say purple?"
- model_was_given: true
- This is the 3rd time teaching "purple" this session; item_mastery: 0.10

**Child input**: "purple" (immediately, latency 600ms)

**Expected Classification**: `repeated_after_model`

**State Check**: item_mastery remains low despite multiple echoes — this is a flag.

**Expected State Update**:
- item_mastery: +0.03 (echo credit only)
- comprehension_check_pending: true
- Note: If this is the 3rd echo in a row → flag comprehension_not_established

**Expected Teacher Action**: `praise_echo_then_check_comprehension`
But with comprehension_not_established flag → shift to `ask_forced_choice`

**Expected Response**:
- "Purple! Good! Now — is this purple or green?" [forced choice]
- Do not reward echo as mastery
- Probe comprehension through choice

**Unacceptable Response**:
- "Perfect! Next item!" (advancing on echo-only)
- Continuing to model without checking comprehension
- Same model+echo cycle a 4th time

**Pass Criteria**: Comprehension check triggered; mastery not falsely awarded.

---

## Scenario 13: Child Guesses Quickly on Forced Choice

**ID**: TC-13

**Setup**:
- Activity: forced_choice
- Teacher: "Is it a dog or a cat?" [showing dog image]
- Target item: "dog"
- attempt_number: 1 (first time seeing this item)

**Child input**: "cat"
- response_latency_ms: 480ms (very fast — below 700ms guard)

**Note**: Fast response on forced_choice + first exposure = likely guess

**Expected Classification**: `wrong_semantic`
(Not guessing_wrong as a label — but the guard should apply: fast + first exposure + wrong)

**Expected State Update**:
- item_mastery: +0.00
- comprehension_confidence: -0.08
- recent_failure_count: +1

**Expected Teacher Action**: `gentle_reframe_no_wrong_word` then `model_answer`

**Expected Response**:
- "Ooh! Look — this one has a long nose and big ears! It's a dog! Dog! Can you say dog?"
- No "that's wrong"
- Distractor acknowledged implicitly (cat is not mentioned)
- Correct answer modeled

**Unacceptable Response**:
- "Wrong! That's a dog not a cat!"
- Immediate re-prompt without explanation
- Treating as confirmed non-comprehension (it may be a fast guess, not confusion)

**Pass Criteria**: Warm reframe; model given; no shame.

---

## Scenario 14: Child Asks "Why?"

**ID**: TC-14

**Setup**:
- Activity: flashcard
- Target item: "red"
- Teacher said: "This color is red."
- Age band: 8-9

**Child input**: "Why is it called red?"

**Expected Classification**: `off_topic_story` (closest label) or a future `meta_question` label

**Note**: This is positive engagement. Must not be treated as off-task.

**Expected State Update**:
- engagement_level: +0.05 (meta-question = intellectual engagement)

**Expected Teacher Action**: `acknowledge_warmly_redirect`

**Expected Response** (8-9 age band):
- "Good question! Red is just the English name for this color! Like in Ukrainian it's 'червоний'! In English — red! Can you say red?"
- Brief, concrete answer
- Bridge to task

**For 6-7 age band**: Even shorter
- "That's its English name! Red! Let's say it — red!"

**Unacceptable Response**:
- "We're not talking about that right now"
- "Because it is" (dismissive)
- Extended linguistic explanation (overwhelming)

**Pass Criteria**: Curiosity honored; question answered briefly; task resumes.

---

## Scenario 15: Child Asks for Translation

**ID**: TC-15

**Setup**:
- Activity: flashcard (blue)
- Target item: "blue"
- Child input: "Як це по-англійськи?" (Ukrainian: "How do you say this in English?")
- l1_detected: true; l1_intent_hint: help_request

**Expected Classification**: `l1_help_request`

**Expected State Update**:
- l1_dependency: +0.04
- comprehension_confidence: +0.03 (child is asking, which means engaged)

**Expected Teacher Action**: `provide_gentle_l1_anchor_then_english`

**Expected Response**:
- "In English — blue! Blue! Like the sky is blue! Can you say blue?"
- Answers the request directly (do not refuse to translate)
- Then models English
- Uses concrete image association

**Unacceptable Response**:
- "Only English!" (shuts down legitimate help-seeking)
- Ignoring the Ukrainian and asking again in English
- Long L1 explanation

**Pass Criteria**: L1 request honored briefly; English immediately modeled; task continues.

---

## Scenario 16: Child Shows Emotional Shutdown

**ID**: TC-16

**Setup**:
- Session context: 4 wrong answers in a row; frustration_risk: 0.75; emotional_safety: 0.32
- Recovery attempts: give_easiest_win was attempted but child did not respond
- Current classification: silence_long (duration: 9000ms)
- Recovery state: emotional_shutdown (entry conditions all met)

**Child input**: (no response; continued silence after check-in)

**Expected Classification**: `emotional_shutdown` (state-driven, not silence-alone)

**Expected State Update**:
- emotional_safety: held (do not decrease further)
- session_stamina: decrement
- flag: requires_session_end

**Expected Teacher Action**: `end_session_warmly` (or offer break)

**Expected Response**:
- "Hey, that's totally okay. We had such a great time today! Let's take a break. Bye-bye for now!"
- Warm, no mention of failure
- No final task attempt
- Positive framing of session regardless

**Unacceptable Response**:
- "Why aren't you talking?"
- "One more try?"
- Any curriculum content
- Ending with "We didn't finish" or "We'll try again next time because you couldn't do it"

**Pass Criteria**: Session ends with warmth; no failure framing; child leaves feeling safe.

---

## Evaluation Summary Table

| Test | Classification | State | Action | No Shame | Pass Criteria |
|------|---------------|-------|--------|----------|--------------|
| TC-01 Correct after model | repeated_after_model | ✓ | praise+check | ✓ | Comprehension probe |
| TC-02 Correct unprompted | correct_confident | ✓ | praise+progress | ✓ | Mastery credited |
| TC-03 Wrong but related | wrong_but_related | ✓ | acknowledge+scaffold | ✓ | Connection noted |
| TC-04 Random nonsense | random_nonsense | ✓ | warm_redirect | ✓ | No shame |
| TC-05 Playful nonsense | playful_nonsense | ✓ | play_then_redirect | ✓ | 1-turn play |
| TC-06 I don't know | i_dont_know | ✓ | validate+model | ✓ | Validation first |
| TC-07 L1 answer | l1_translation | ✓ | L1_bridge | ✓ | L1 honored |
| TC-08 Refusal | refusal | ✓ | back_off | ✓ | No pressure |
| TC-09 Silence | silence_medium | ✓ | hint+scaffold | ✓ | Warm scaffold |
| TC-10 Overexcited | overexcited | ✓ | match+focus | ✓ | Energy redirected |
| TC-11 Off-topic story | off_topic_story | ✓ | acknowledge+bridge | ✓ | Story honored |
| TC-12 Echo repeat | repeated_after_model | ✓ | check_comprehension | ✓ | No false mastery |
| TC-13 Fast guess | wrong_semantic | ✓ | reframe+model | ✓ | No "wrong" word |
| TC-14 Asks why | (off_topic/meta) | ✓ | brief answer+resume | ✓ | Curiosity honored |
| TC-15 Asks translation | l1_help_request | ✓ | answer+model | ✓ | Request honored |
| TC-16 Emotional shutdown | emotional_shutdown | ✓ | end_warmly | ✓ | Warm close |
