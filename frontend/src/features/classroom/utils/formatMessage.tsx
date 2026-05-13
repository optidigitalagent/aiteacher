import React from 'react'

/**
 * Parses inline markdown: **bold** and *italic*.
 * Uses a regex split so unmatched markers are treated as plain text.
 */
function parseInline(text: string): React.ReactNode[] {
  // Split on **...** (bold) OR *...* (italic, no asterisks inside)
  const tokens = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return <strong key={i}>{tok.slice(2, -2)}</strong>
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return <em key={i}>{tok.slice(1, -1)}</em>
    }
    return tok || null
  })
}

/**
 * Converts AI response text (with basic markdown) into readable React nodes.
 * Handles: **bold**, *italic*, bullet lines (• or -), blank-line paragraph breaks.
 * Does NOT introduce external dependencies.
 */
export function formatAIMessage(text: string): React.ReactNode {
  if (!text) return null

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let bulletBuffer: string[] = []
  let k = 0

  const flushBullets = () => {
    if (!bulletBuffer.length) return
    elements.push(
      <ul key={k++} style={{
        margin: '4px 0', paddingLeft: 18,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        {bulletBuffer.map((b, i) => (
          <li key={i} style={{ lineHeight: 1.55, fontSize: 'inherit', color: 'inherit' }}>
            {parseInline(b)}
          </li>
        ))}
      </ul>
    )
    bulletBuffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Blank line → paragraph spacer
    if (!trimmed) {
      flushBullets()
      elements.push(<div key={k++} style={{ height: 5 }} />)
      continue
    }

    // Bullet line: starts with •, -, or digit+dot
    const bulletMatch = trimmed.match(/^([•\-]|\d+\.)\s+(.*)$/)
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[2]!)
      continue
    }

    flushBullets()
    elements.push(
      <div key={k++} style={{ lineHeight: 1.6 }}>
        {parseInline(trimmed)}
      </div>
    )
  }

  flushBullets()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {elements}
    </div>
  )
}
