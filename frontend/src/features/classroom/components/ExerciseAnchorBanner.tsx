const TYPE_LABEL: Record<string, string> = {
  form_transformation: 'Transform',
  error_correction:    'Correct',
  reconstruction:      'Reconstruct',
  free_production:     'Produce',
  fill_gap:            'Fill in',
  grammar_transform:   'Transform',
  word_box:            'Word Box',
  reading:             'Reading',
  speaking_prompt:     'Speaking',
  vocabulary_matching: 'Vocabulary',
  unknown:             'Exercise',
}

interface Props {
  exerciseNum:  number
  exerciseType: string
  instruction:  string
}

export default function ExerciseAnchorBanner({ exerciseNum, exerciseType, instruction }: Props) {
  const typeLabel = TYPE_LABEL[exerciseType] ?? exerciseType

  return (
    <div style={{
      maxWidth: 720, width: '100%',
      background: 'rgba(255,255,255,0.65)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 14,
      border: '1px solid rgba(110,124,251,0.14)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 2px 12px rgba(110,124,251,0.06)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 800, color: '#9B8CFF',
        textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
      }}>
        Active task
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700, color: '#6E7CFB',
        background: 'rgba(110,124,251,0.1)', borderRadius: 6,
        padding: '2px 8px', flexShrink: 0,
      }}>
        Exercise {exerciseNum}
      </span>
      {typeLabel && (
        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>
          · {typeLabel}
        </span>
      )}
      <span style={{
        fontSize: 12.5, color: '#475569', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {instruction}
      </span>
      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>
        ↩ returning after answer
      </span>
    </div>
  )
}
