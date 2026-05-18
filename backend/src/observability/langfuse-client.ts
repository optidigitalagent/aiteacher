// Langfuse client initialization.
// Safe to import unconditionally — no-op when env vars are absent.

import { createHash } from 'node:crypto'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'

let _enabled = false
let _processor: LangfuseSpanProcessor | null = null

export function isObservabilityEnabled(): boolean {
  return _enabled
}

// One-way hash of user ID for privacy-safe tracing.
export function hashUserId(id: string | null): string | null {
  if (!id) return null
  return createHash('sha256').update(id).digest('hex').slice(0, 16)
}

// Call once at server startup (after dotenv is loaded).
// No-op and logs warning when LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are absent.
export function initObservability(): void {
  const pub  = process.env.LANGFUSE_PUBLIC_KEY
  const sec  = process.env.LANGFUSE_SECRET_KEY
  const host = process.env.LANGFUSE_HOST ?? process.env.LANGFUSE_BASE_URL

  if (!pub || !sec) {
    console.log('[observability] disabled — LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY not set')
    return
  }

  try {
    const processor = new LangfuseSpanProcessor({
      publicKey: pub,
      secretKey:  sec,
      baseUrl:    host ?? 'https://cloud.langfuse.com',
    })

    const sdk = new NodeSDK({
      spanProcessors:  [processor],
      instrumentations: [],   // manual-only — no auto-instrumentation
    })
    sdk.start()

    _processor = processor
    _enabled   = true
    console.log(`[observability] Langfuse tracing active — host=${host ?? 'cloud.langfuse.com'}`)
  } catch (err) {
    console.error('[observability] init failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

// Flush remaining spans to Langfuse (call on SIGTERM).
export async function flushObservability(): Promise<void> {
  if (!_processor) return
  try {
    await _processor.forceFlush()
    console.log('[observability] flush complete')
  } catch (err) {
    console.error('[observability] flush error (non-fatal):', err instanceof Error ? err.message : err)
  }
}
