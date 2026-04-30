import type { ExerciseCard } from '../../../hooks/useLesson'

const DIFF_DOTS  = ['●○○', '●●○', '●●●'] as const
const DIFF_COLOR = ['text-emerald-500', 'text-amber-500', 'text-orange-500'] as const
function di(d: number) { return d < 0.35 ? 0 : d < 0.65 ? 1 : 2 }

export function ExerciseCardView({ exercise }: { exercise: ExerciseCard }) {
  const idx = di(exercise.difficulty)

  return (
    <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {exercise.exerciseNumber !== undefined && (
            <span className="text-xs font-bold text-cls-accent">
              Exercise {exercise.exerciseNumber}
            </span>
          )}
          {exercise.skillFocus && (
            <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
              {exercise.skillFocus}
            </span>
          )}
        </div>
        <span className={`text-xs font-mono ${DIFF_COLOR[idx]} shrink-0`}>
          {DIFF_DOTS[idx]}
        </span>
      </div>

      {exercise.instruction && (
        <p className="text-xs text-gray-500 italic mb-3 pb-2 border-b border-gray-100">
          {exercise.instruction}
        </p>
      )}

      {exercise.items && exercise.items.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {exercise.items.map((item, i) => {
            const itemBody = item.replace(/^\d+[\.\)]\s*/, '').trim()
            const isCurrent =
              exercise.question === itemBody ||
              exercise.question.includes(itemBody) ||
              itemBody.includes(exercise.question)
            return (
              <p
                key={i}
                className={`text-xs leading-relaxed rounded px-2 py-0.5 ${
                  isCurrent
                    ? 'text-gray-900 font-medium bg-cls-accent-lgt -mx-2'
                    : 'text-gray-500'
                }`}
              >
                {item}
              </p>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-900 mb-2">{exercise.question}</p>
      )}

      {exercise.items && exercise.items.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Now answering:</p>
          <p className="text-sm text-gray-900 font-medium">{exercise.question}</p>
        </div>
      )}

      {exercise.hint && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
          <span className="font-semibold">Hint: </span>{exercise.hint}
        </p>
      )}
    </div>
  )
}
