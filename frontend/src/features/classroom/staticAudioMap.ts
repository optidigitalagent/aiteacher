// Maps audioKey (from lesson-engine / demo-routes) to the public URL of the pre-recorded file.
// Files live in frontend/public/audio/demo/ — served at /audio/demo/ by Vite.
// Keys MUST match the audioKey values in backend/src/demo/lesson-engine.ts and demo-routes.ts.
//
// MISSING KEYS (file not found on disk — will fall back to text-only):
//   intro_topic_games                          — 013_intro_topic_games.mp3 not found
//   warm_up_question_travel                    — 021_warm_up_question_travel.mp3 not found
//   grammar_explanation_real_conversation_mission — 035_grammar_explanation_real_conversation_mission.mp3 not found

const BASE = '/audio/demo'
const CC   = 'CapCut_TTS_Confident%20Guy_D20260505'

export const STATIC_DEMO_AUDIO_MAP: Record<string, string> = {
  // ── Intro: greeting ────────────────────────────────────────────────────────
  intro_greeting_friendly_coach:               `${BASE}/${CC}_T153644.mp3`,
  intro_greeting_older_friend:                 `${BASE}/${CC}_T153716.mp3`,
  intro_greeting_real_tutor:                   `${BASE}/${CC}_T153730.mp3`,
  intro_greeting_challenge_trainer:            `${BASE}/${CC}_T153740.mp3`,

  // ── Intro: mission ─────────────────────────────────────────────────────────
  intro_mission_real_conversation_mission:     `${BASE}/${CC}_T153750.mp3`,
  intro_mission_fix_mistakes:                  `${BASE}/${CC}_T153802.mp3`,
  intro_mission_listening_check:               `${BASE}/${CC}_T153812.mp3`,
  intro_mission_find_level:                    `${BASE}/${CC}_T153819.mp3`,

  // ── Intro: confidence ──────────────────────────────────────────────────────
  intro_confidence_freezes:                    `${BASE}/${CC}_T153837.mp3`,
  intro_confidence_can_try:                    `${BASE}/${CC}_T153846.mp3`,
  intro_confidence_okay:                       `${BASE}/${CC}_T154147.mp3`,
  intro_confidence_test_me:                    `${BASE}/${CC}_T154159.mp3`,

  // ── Intro: topic (games MISSING — no file on disk) ────────────────────────
  // intro_topic_games:                        — FILE MISSING
  intro_topic_movies_series:                   `${BASE}/${CC}_T154213.mp3`,
  intro_topic_travel:                          `${BASE}/${CC}_T154226.mp3`,
  intro_topic_school_life:                     `${BASE}/${CC}_T154239.mp3`,

  // ── Intro: start ──────────────────────────────────────────────────────────
  intro_start:                                 `${BASE}/${CC}_T154249.mp3`,

  // ── Warm-up ────────────────────────────────────────────────────────────────
  warm_up_intro:                               `${BASE}/${CC}_T154312.mp3`,
  warm_up_question_movies_series:              `${BASE}/${CC}_T154337.mp3`,
  warm_up_question_games:                      `${BASE}/${CC}_T154348.mp3`,
  // warm_up_question_travel:                  — FILE MISSING
  warm_up_question_school_life:                `${BASE}/${CC}_T154550.mp3`,

  // ── Warm-up follow-up ──────────────────────────────────────────────────────
  warm_up_followup_movies_series:              `${BASE}/${CC}_T154609.mp3`,
  warm_up_followup_games:                      `${BASE}/${CC}_T154616.mp3`,
  warm_up_followup_travel:                     `${BASE}/${CC}_T154625.mp3`,
  warm_up_followup_school_life:                `${BASE}/${CC}_T154631.mp3`,

  // ── Grammar: transition ───────────────────────────────────────────────────
  grammar_transition_friendly_coach:           `${BASE}/${CC}_T154639.mp3`,
  grammar_transition_older_friend:             `${BASE}/${CC}_T154646.mp3`,
  grammar_transition_real_tutor:               `${BASE}/${CC}_T154702.mp3`,
  grammar_transition_challenge_trainer:        `${BASE}/${CC}_T154838.mp3`,

  // ── Grammar: intro ────────────────────────────────────────────────────────
  grammar_intro_real_conversation_mission:     `${BASE}/${CC}_T154856.mp3`,
  grammar_intro_fix_mistakes:                  `${BASE}/${CC}_T154903.mp3`,
  grammar_intro_listening_check:               `${BASE}/${CC}_T155038.mp3`,
  grammar_intro_find_level:                    `${BASE}/${CC}_T155051.mp3`,

  // ── Grammar: explanation (real_conversation_mission MISSING) ──────────────
  // grammar_explanation_real_conversation_mission: — FILE MISSING
  grammar_explanation_fix_mistakes:            `${BASE}/${CC}_T155119.mp3`,
  grammar_explanation_listening_check:         `${BASE}/${CC}_T155102.mp3`,
  grammar_explanation_find_level:              `${BASE}/${CC}_T155308.mp3`,

  // ── Speaking ──────────────────────────────────────────────────────────────
  speaking_transition:                         `${BASE}/${CC}_T155333.mp3`,
  speaking_prompt_movies_series:               `${BASE}/${CC}_T155341.mp3`,
  speaking_prompt_games:                       `${BASE}/${CC}_T155350.mp3`,
  speaking_prompt_travel:                      `${BASE}/${CC}_T155357.mp3`,
  speaking_prompt_school_life:                 `${BASE}/${CC}_T155407.mp3`,

  // ── Speaking follow-up ────────────────────────────────────────────────────
  speaking_followup_movies_series:             `${BASE}/${CC}_T155413.mp3`,
  speaking_followup_games:                     `${BASE}/${CC}_T155424.mp3`,
  speaking_followup_travel:                    `${BASE}/${CC}_T155432.mp3`,
  speaking_followup_school_life:               `${BASE}/${CC}_T155625.mp3`,

  // ── Writing ───────────────────────────────────────────────────────────────
  writing_transition:                          `${BASE}/${CC}_T155634.mp3`,
  writing_prompt_movies_series:                `${BASE}/${CC}_T155653.mp3`,
  writing_prompt_games:                        `${BASE}/${CC}_T155700.mp3`,
  writing_prompt_travel:                       `${BASE}/${CC}_T155710.mp3`,
  writing_prompt_school_life:                  `${BASE}/${CC}_T155721.mp3`,

  // ── Final goodbye ─────────────────────────────────────────────────────────
  final_goodbye:                               `${BASE}/${CC}_T155736.mp3`,
}
