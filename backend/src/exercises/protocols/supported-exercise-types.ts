// Canonical exercise type registry
// All known Focus 2 exercise formats with their support status.

export const SUPPORTED_EXERCISE_TYPES = [
  'fill_gap',
  'choose_from_box',
  'complete_correct_form',
  'form_transformation',
  'rewrite_sentence',
  'write_sentences_from_prompts',
  'reconstruction',
  'write_questions',
  'error_correction',
  'matching',
  'vocabulary_matching',
  'collocations',
  'find_opposites',
  'replace_substitute_words',
  'tick_cross',
  'true_false',
  'multiple_choice',
  'speaking_prompt',
  'discussion',
  'roleplay',
  'show_interest_agree_disagree',
  'brainstorm_60_second',
  'show_what_you_know',
  'grammar_focus',
  'remember_this',
  // Text-based reading exercises (text visible in student textbook, options on screen)
  'gapped_text',
  'find_in_text',
  'read_and_answer',
  'read_and_write_names',
  'phrase_classification',
] as const

export type SupportedExerciseType = typeof SUPPORTED_EXERCISE_TYPES[number]

export const POSTPONED_EXERCISE_TYPES = [
  // Audio/listening: require audio track not available
  'listening',
  'gap_fill_from_audio',
  'listen_check_repeat',
  'pronunciation_focus',
  // Reading: requires displaying a long text passage (paragraph mode not yet available)
  'reading_long_text',
  // Writing: require composition mode not yet available
  'writing_task',
  'writing_focus_analyse_model',
  'writing_order_paragraphs',
  'writing_self_check',
  // Other unavailable types
  'complete_table',
  'complete_cartoon_captions',
  'exam_focus_unsupported',
] as const

export type PostponedExerciseType = typeof POSTPONED_EXERCISE_TYPES[number]

export type CanonicalExerciseType = SupportedExerciseType | PostponedExerciseType | 'unknown'

export const ALL_EXERCISE_TYPES: ReadonlyArray<string> = [
  ...SUPPORTED_EXERCISE_TYPES,
  ...POSTPONED_EXERCISE_TYPES,
]

// Alias map: variant names → canonical type
export const EXERCISE_TYPE_ALIASES: Record<string, CanonicalExerciseType> = {
  // fill_gap aliases
  fill_in_the_blank: 'fill_gap',
  fill_in:           'fill_gap',
  gap_fill:          'fill_gap',
  fill_gaps:         'fill_gap',
  // choose_from_box aliases
  choose_from_box:   'choose_from_box',
  use_the_words:     'choose_from_box',
  word_box:          'choose_from_box',
  // form aliases
  correct_form:      'complete_correct_form',
  verb_form:         'complete_correct_form',
  put_in_correct_form: 'complete_correct_form',
  // transformation aliases
  sentence_transformation: 'form_transformation',
  transformation:          'form_transformation',
  // rewrite aliases
  rewrite:           'rewrite_sentence',
  // reconstruction aliases
  word_order:        'reconstruction',
  put_in_order:      'reconstruction',
  sentence_building: 'reconstruction',
  // error correction aliases
  find_the_mistake:  'error_correction',
  correct_the_error: 'error_correction',
  find_and_correct:  'error_correction',
  spot_the_error:    'error_correction',
  // matching aliases
  match:             'matching',
  match_words:       'matching',
  link_words:        'matching',
  pair_words:        'matching',
  // vocabulary_matching aliases
  vocabulary:        'vocabulary_matching',
  word_match:        'vocabulary_matching',
  // speaking/discussion aliases
  speaking:          'speaking_prompt',
  free_speaking:     'speaking_prompt',
  talk:              'discussion',
  pair_discussion:   'discussion',
  // listening aliases
  listen:            'listening',
  listening_task:    'listening',
  audio_task:        'listening',
  // writing aliases
  writing:           'writing_task',
  write:             'writing_task',
  // reading aliases — generic 'reading' stays as reading_long_text (requires text display mode)
  reading:           'reading_long_text',
  read_text:         'reading_long_text',
  read_article:      'reading_long_text',
  // phrase classification aliases
  phrase_classification: 'phrase_classification',
  categorize:        'phrase_classification',
  sort_phrases:      'phrase_classification',
  classify_phrases:  'phrase_classification',
  // gapped text aliases
  gap_fill_text:     'gapped_text',
  choose_sentence:   'gapped_text',
  // find in text aliases
  find_in_text:      'find_in_text',
  underline_in_text: 'find_in_text',
  // read and answer aliases
  read_and_answer:   'read_and_answer',
  answer_questions:  'read_and_answer',
  // read and write names aliases
  read_and_write_names: 'read_and_write_names',
  who_said:          'read_and_write_names',
  // free_production (legacy validator type)
  free_production:   'speaking_prompt',
  // reading (legacy validator type)
  reading_legacy:    'reading_long_text',
}
