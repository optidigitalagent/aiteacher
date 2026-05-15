// Downgrade / Unsupported Type Handling QA Scenarios
// Covers: safe downgrade, skip behavior, no validator entry, no broken cursor.

export interface DowngradeScenario {
  readonly scenarioId: string
  readonly exerciseType: string
  readonly downgradeStrategy: string
  readonly title: string
  readonly description: string
  readonly expectedBehavior: {
    isSkipped: boolean
    downgradesTo: string | null
    teacherExplainsLimitation: boolean
    validatorNotEntered: boolean
    cursorNotBroken: boolean
    noHallucinatedContent: boolean
  }
  readonly forbiddenBehaviors: string[]
  readonly criticalChecks: string[]
}

export const LISTENING_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_001',
  exerciseType: 'listening',
  downgradeStrategy: 'skip',
  title: 'Listening — skip with explanation, offer speaking alternative',
  description: 'Listening requires textbook audio. Skip and optionally offer speaking_prompt.',
  expectedBehavior: {
    isSkipped: true,
    downgradesTo: null,
    teacherExplainsLimitation: true,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'hallucinate_audio_content',
    'break_cursor_on_unsupported',
    'pretend to play audio',
  ],
  criticalChecks: [
    'allowInCurrentRuntime === false for listening',
    'runtimeMode === "future_listening_mode"',
    'unsupportedProtocol selected by protocol-runner',
    'teacher says exercise requires audio and skips',
    'exerciseCursor advances past listening exercise',
  ],
}

export const LISTEN_CHECK_REPEAT_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_002',
  exerciseType: 'listen_check_repeat',
  downgradeStrategy: 'speaking_prompt',
  title: 'Listen/check/repeat — downgrade to speaking_prompt',
  description: 'listen_check_repeat can offer a speaking prompt instead.',
  expectedBehavior: {
    isSkipped: false,
    downgradesTo: 'speaking_prompt',
    teacherExplainsLimitation: true,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'hallucinate_audio_content',
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
    'run original listening exercise',
  ],
  criticalChecks: [
    'policy.downgradeStrategy === "speaking_prompt"',
    'teacher offers speaking alternative',
    'speaking soft protocol used for downgraded exercise',
  ],
}

export const WRITING_TASK_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_003',
  exerciseType: 'writing_task',
  downgradeStrategy: 'teacher_explanation',
  title: 'Writing task — teacher explains what good answer includes',
  description: 'writing_task cannot run as voice. Teacher describes task and skips.',
  expectedBehavior: {
    isSkipped: true,
    downgradesTo: null,
    teacherExplainsLimitation: true,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'run_writing_as_voice',
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
    'attempt to validate a 100-word essay via voice',
  ],
  criticalChecks: [
    'allowInCurrentRuntime === false for writing_task',
    'runtimeMode === "future_writing_mode"',
    'teacher explains task structure then advances cursor',
  ],
}

export const READING_LONG_TEXT_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_004',
  exerciseType: 'reading_long_text',
  downgradeStrategy: 'future_only',
  title: 'Reading long text — future_only, skip in current runtime',
  description: 'Paragraph mode not available. Skip entirely.',
  expectedBehavior: {
    isSkipped: true,
    downgradesTo: null,
    teacherExplainsLimitation: true,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
    'pretend to read text aloud from exercise data',
  ],
  criticalChecks: [
    'allowInCurrentRuntime === false',
    'cursor advances without runtime crash',
    'teacher briefly mentions reading topic, skips',
  ],
}

export const GAPPED_TEXT_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_005',
  exerciseType: 'gapped_text',
  downgradeStrategy: 'future_only',
  title: 'Gapped text — requires long text, skip',
  description: 'Gapped text needs full reading passage. Skip in current runtime.',
  expectedBehavior: {
    isSkipped: true,
    downgradesTo: null,
    teacherExplainsLimitation: true,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
    'invent text passage',
  ],
  criticalChecks: [
    'allowInCurrentRuntime === false',
    'unsupportedProtocol used',
    'no crash on exercise with long text content',
  ],
}

export const COMPLETE_TABLE_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_006',
  exerciseType: 'complete_table',
  downgradeStrategy: 'skip',
  title: 'Complete table — requires visual rendering, skip',
  description: 'Table exercises need a visual layout. Skip and discuss topic verbally.',
  expectedBehavior: {
    isSkipped: true,
    downgradesTo: null,
    teacherExplainsLimitation: true,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'hallucinate_image_content',
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
    'pretend to display a table',
  ],
  criticalChecks: [
    'requiresImage === true for complete_table',
    'allowInCurrentRuntime === false',
    'cursor advances cleanly',
  ],
}

export const COMPLETE_CARTOON_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_007',
  exerciseType: 'complete_cartoon_captions',
  downgradeStrategy: 'skip',
  title: 'Cartoon captions — requires image, skip',
  description: 'Cannot show cartoon image in voice chat. Skip.',
  expectedBehavior: {
    isSkipped: true,
    downgradesTo: null,
    teacherExplainsLimitation: true,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'hallucinate_image_content',
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
    'invent speech bubble content',
  ],
  criticalChecks: [
    'requiresImage === true',
    'allowInCurrentRuntime === false',
    'no runtime crash',
  ],
}

export const UNKNOWN_TYPE_DOWNGRADE: DowngradeScenario = {
  scenarioId: 'downgrade_008',
  exerciseType: 'unknown',
  downgradeStrategy: 'skip',
  title: 'Unknown type — safe skip, no crash',
  description: 'Any exercise type not in the registry falls through to unknown. Must skip safely.',
  expectedBehavior: {
    isSkipped: true,
    downgradesTo: null,
    teacherExplainsLimitation: false,
    validatorNotEntered: true,
    cursorNotBroken: true,
    noHallucinatedContent: true,
  },
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
    'runtime crash on unknown type',
    'throw unhandled exception',
  ],
  criticalChecks: [
    'classifyExerciseType("???") === "unknown"',
    'unsupportedProtocol selected for unknown',
    'lesson continues after unknown exercise',
  ],
}

export const ALL_DOWNGRADE_SCENARIOS: DowngradeScenario[] = [
  LISTENING_DOWNGRADE,
  LISTEN_CHECK_REPEAT_DOWNGRADE,
  WRITING_TASK_DOWNGRADE,
  READING_LONG_TEXT_DOWNGRADE,
  GAPPED_TEXT_DOWNGRADE,
  COMPLETE_TABLE_DOWNGRADE,
  COMPLETE_CARTOON_DOWNGRADE,
  UNKNOWN_TYPE_DOWNGRADE,
]
