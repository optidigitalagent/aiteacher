import { useState } from 'react'
import type { ExerciseCard } from '../../../hooks/useLesson'

interface ExerciseStageProps {
  exercise:          ExerciseCard
  isTeacherSpeaking: boolean
  onSubmitAnswer?:   (answer: string) => void
}

const TYPE_LABEL: Record<string, string> = {
  form_transformation: 'Form',
  error_correction:    'Fix the error',
  reconstruction:      'Reconstruct',
  free_production:     'Free answer',
}

// Renders a sentence that contains `___` blanks as interactive inputs
function SentenceWithBlank({
  text,
  value,
  onChange,
}: {
  text: string
  value: string
  onChange: (v: string) => void
}) {
  const parts = text.split(/_{3,}/)

  if (parts.length < 2) {
    return <span className="text-xl text-gray-800 leading-relaxed">{text}</span>
  }

  return (
    <span className="text-xl text-gray-800 leading-relaxed">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              autoFocus={i === 0}
              className="
                inline-block border-b-2 border-cls-accent bg-transparent
                text-cls-accent font-semibold text-center
                w-36 mx-1 px-1 pb-0.5
                focus:outline-none placeholder-cls-accent/40
                transition-colors
              "
              placeholder="..."
            />
          )}
        </span>
      ))}
    </span>
  )
}

// Main exercise card matching reference layout
export function ExerciseStage({ exercise, isTeacherSpeaking, onSubmitAnswer }: ExerciseStageProps) {
  const [answer, setAnswer]         = useState('')
  const [hintDismissed, setHintDismissed] = useState(false)
  const [hintExpanded, setHintExpanded]   = useState(false)

  const total = exercise.items?.length ?? 8
  const num   = exercise.exerciseNumber ?? 4

  function handleCheck() {
    const text = answer.trim()
    if (!text && exercise.exerciseType !== 'free_production') return
    onSubmitAnswer?.(text || exercise.question)
    setAnswer('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCheck() }
  }

  // Rule pill text derived from skillFocus
  const rulePill = exercise.skillFocus ? `Use ${exercise.skillFocus}.` : null

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-xl">

        {/* Exercise counter pill */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center text-xs font-semibold text-cls-accent bg-cls-accent-lgt border border-cls-accent/20 px-4 py-1.5 rounded-full">
            {exercise.exerciseType && (
              <span className="mr-1.5 text-cls-accent/60">{TYPE_LABEL[exercise.exerciseType] ?? exercise.exerciseType} ·</span>
            )}
            Exercise {num} of {total}
          </span>
        </div>

        {/* Main white card */}
        <div className="bg-white rounded-3xl shadow-md border border-[rgba(0,0,0,0.06)] px-8 py-8">

          {/* Instruction */}
          <h2 className="text-2xl font-semibold text-gray-900 leading-snug mb-6 text-center">
            {exercise.instruction ?? 'Complete the sentence with the correct form of the verb.'}
          </h2>

          {/* Rule hint pill — dismissable */}
          {rulePill && !hintDismissed && (
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 bg-cls-accent-lgt border border-cls-accent/20 rounded-full px-4 py-1.5">
                <span className="text-xs font-medium text-cls-accent">{rulePill}</span>
                <button
                  onClick={() => setHintDismissed(true)}
                  className="text-cls-accent/50 hover:text-cls-accent/80 transition-colors text-xs leading-none"
                  title="Dismiss rule"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Exercise content */}
          <div className="mb-8">
            {exercise.items && exercise.items.length > 0 ? (
              /* Multi-item list exercises */
              <div className="space-y-1.5">
                {exercise.items.map((item, i) => {
                  const itemBody  = item.replace(/^\d+[\.\)]\s*/, '').trim()
                  const isCurrent =
                    exercise.question === itemBody ||
                    exercise.question.includes(itemBody) ||
                    itemBody.includes(exercise.question)
                  return (
                    <div
                      key={i}
                      className={`
                        flex items-start gap-3 rounded-xl px-4 py-3 transition-all
                        ${isCurrent ? 'bg-cls-accent-lgt border border-cls-accent/20' : 'hover:bg-gray-50'}
                      `}
                    >
                      <span className={`text-xs font-mono mt-0.5 shrink-0 w-4 ${isCurrent ? 'text-cls-accent font-bold' : 'text-gray-300'}`}>
                        {i + 1}.
                      </span>
                      <p className={`text-sm leading-relaxed ${isCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        {itemBody}
                      </p>
                    </div>
                  )
                })}
                {/* Current question call-out */}
                <div className="pt-4 border-t border-gray-100 mt-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono mb-2">Answer now:</p>
                  <div className="text-center py-2">
                    <SentenceWithBlank text={exercise.question} value={answer} onChange={setAnswer} />
                  </div>
                </div>
              </div>
            ) : (
              /* Single fill-in-blank sentence */
              <div className="text-center py-2">
                <SentenceWithBlank text={exercise.question} value={answer} onChange={setAnswer} />
              </div>
            )}
          </div>

          {/* Check answer button */}
          <button
            onClick={handleCheck}
            onKeyDown={handleKeyDown}
            disabled={isTeacherSpeaking}
            className="
              w-full py-3.5 rounded-xl font-semibold text-sm text-white mb-3
              bg-gradient-to-r from-[#5B73E8] to-[#3D55C9]
              hover:from-[#6B83F8] hover:to-[#4D65D9]
              active:scale-[0.99] transition-all duration-150
              shadow-md shadow-cls-accent/20
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isTeacherSpeaking ? 'Alex is speaking…' : 'Check answer'}
          </button>

          {/* Hint link — centered below button */}
          {exercise.hint && (
            <div className="text-center">
              <button
                onClick={() => setHintExpanded(v => !v)}
                className="text-xs text-gray-400 hover:text-cls-accent transition-colors"
              >
                {hintExpanded ? 'Hide hint' : 'Need a hint?'}
              </button>
            </div>
          )}

          {/* Expanded hint */}
          {hintExpanded && exercise.hint && (
            <div className="mt-4 p-3.5 bg-amber-50 border border-amber-100 rounded-xl animate-fade-in">
              <p className="text-xs text-amber-700 leading-relaxed">
                <span className="font-semibold">Hint: </span>
                {exercise.hint}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
