import type { ExerciseCard, SectionCard, Message } from '../../hooks/useLesson'
import { IdleStage }     from './stages/IdleStage'
import { TeacherStage }  from './stages/TeacherStage'
import { ExerciseStage } from './stages/ExerciseStage'
import { GrammarStage }  from './stages/GrammarStage'

export type StageType = 'IDLE' | 'EXERCISE' | 'GRAMMAR' | 'TEACHER_SPEECH'

export function deriveStage({
  started,
  connectionState,
  currentExercise,
  sectionCard,
  currentPhase,
}: {
  started:          boolean
  connectionState:  string
  currentExercise:  unknown | null
  sectionCard:      unknown | null
  currentPhase:     string
}): StageType {
  if (!started || connectionState !== 'connected') return 'IDLE'
  if (currentExercise) return 'EXERCISE'

  const grammarPhases = ['CONTEXT_INPUT', 'RULE_DISCOVERY']
  if (sectionCard && grammarPhases.includes(currentPhase)) return 'GRAMMAR'

  return 'TEACHER_SPEECH'
}

interface LessonStageProps {
  stageType:          StageType
  currentExercise:    ExerciseCard | null
  sectionCard:        SectionCard | null
  lastTeacherMessage: Message | null
  isTeacherSpeaking:  boolean
  isConfusionLoading: boolean
  connectionState:    string
  started:            boolean
  onSubmitAnswer?:    (answer: string) => void
}

export function LessonStage({
  stageType,
  currentExercise,
  sectionCard,
  lastTeacherMessage,
  isTeacherSpeaking,
  isConfusionLoading,
  connectionState,
  started,
  onSubmitAnswer,
}: LessonStageProps) {
  switch (stageType) {
    case 'EXERCISE':
      return currentExercise
        ? <ExerciseStage exercise={currentExercise} isTeacherSpeaking={isTeacherSpeaking} onSubmitAnswer={onSubmitAnswer} />
        : null

    case 'GRAMMAR':
      return sectionCard
        ? <GrammarStage sectionCard={sectionCard} />
        : null

    case 'TEACHER_SPEECH':
      return (
        <TeacherStage
          lastTeacherMessage={lastTeacherMessage}
          isTeacherSpeaking={isTeacherSpeaking}
          isConfusionLoading={isConfusionLoading}
        />
      )

    case 'IDLE':
    default:
      return <IdleStage connectionState={connectionState} started={started} />
  }
}

// Re-export phase label map for shared use
export const PHASE_LABELS: Record<string, string> = {
  DIAGNOSTIC:     'Diagnostic',
  CONTEXT_INPUT:  'Context',
  RULE_DISCOVERY: 'Rule Discovery',
  EXERCISES:      'Exercises',
  VOCABULARY:     'Vocabulary',
  DEEP_THINKING:  'Deep Thinking',
  WRAP_UP:        'Wrap-Up',
}
