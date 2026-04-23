import { Pinecone } from '@pinecone-database/pinecone'

const INDEX_NAME = process.env.PINECONE_INDEX ?? 'ai-teacher-textbooks'

let pinecone: Pinecone | null = null

function getClient(): Pinecone | null {
  if (!process.env.PINECONE_API_KEY) return null
  if (!pinecone) pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  return pinecone
}

// Query Pinecone using integrated inference (llama-text-embed-v2).
// No OpenAI embedding needed — Pinecone embeds the query text automatically.
// Returns empty string if Pinecone not configured — AI falls back to training data.
export async function queryRAG(
  grammarTarget: string,
  lessonTopic:   string,
  textbookUnit:  string,
  topK = 3,
): Promise<string> {
  const client = getClient()
  if (!client) return ''

  try {
    const queryText = `${grammarTarget} ${lessonTopic} ${textbookUnit} grammar rules examples vocabulary`

    const index   = client.index(INDEX_NAME)
    const results = await index.searchRecords({
      query: {
        inputs: { text: queryText },
        topK,
      },
      fields: ['content', 'chunk_type', 'grammar_point'],
    })

    if (!results.result?.hits?.length) return ''

    return results.result.hits
      .map((hit) => {
        const f       = hit.fields as Record<string, unknown>
        const label   = (f['chunk_type'] as string) ?? 'content'
        const content = (f['content']    as string) ?? ''
        return `[${label}]\n${content}`
      })
      .join('\n\n---\n\n')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[rag] query failed:', msg)
    return ''
  }
}
