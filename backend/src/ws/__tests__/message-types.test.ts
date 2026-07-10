import { describe, expect, it } from 'vitest'

import { InboundMessageSchema } from '../message-types.js'

describe('lesson websocket inbound message contract', () => {
  it('accepts optional adult mic language on mic_start', () => {
    expect(InboundMessageSchema.safeParse({ type: 'mic_start', language: 'ru' }).success).toBe(true)
    expect(InboundMessageSchema.safeParse({ type: 'mic_start', language: 'uk' }).success).toBe(true)
    expect(InboundMessageSchema.safeParse({ type: 'mic_start', language: 'multi' }).success).toBe(true)
  })

  it('rejects unsupported mic_start language values', () => {
    expect(InboundMessageSchema.safeParse({ type: 'mic_start', language: 'fr' }).success).toBe(false)
  })
})
