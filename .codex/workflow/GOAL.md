# GOAL: P0 Fix Deepgram WebSocket HTTP 400 on Kids STT

## ЦЕЛЬ
Fix Kids STT Deepgram connection failing with HTTP 400 before WebSocket Open.

## ROOT CAUSE (confirmed via Deepgram API docs + code audit)
`DEEPGRAM_KIDS_LIVE_OPTIONS.utterance_end_ms` is set to 700ms.
Deepgram's API requires utterance_end_ms ≥ 1000ms.
700ms is below the minimum → Deepgram rejects the WebSocket upgrade with HTTP 400.

Adult config uses 1500ms (valid). Kids uses 700ms (invalid). This is the only
option difference that explains HTTP 400 on Kids but not Adult.

## SUSPECT OPTIONS VERDICT
- utterance_end_ms=700  → ROOT CAUSE (below Deepgram 1000ms minimum)
- vad_events=true       → VALID (in LiveSchema, required for UtteranceEnd)
- endpointing=300       → VALID
- smart_format=true     → VALID
- model=nova-2          → VALID

## IMPLEMENTATION FILES
- backend/src/voice/stt.ts — change UTTERANCE_END_MS_KIDS from 700 → 1000
- backend/src/voice/__tests__/kids-stt-config-parity.test.ts — update 700 → 1000
- backend/src/voice/__tests__/stt-deepgram-options.test.ts — add utterance_end_ms ≥ 1000 test

## КРИТЕРИИ ГОТОВНОСТИ
- UTTERANCE_END_MS_KIDS changed from 700 to 1000
- kids-stt-config-parity.test.ts expects 1000, not 700
- New test: both configs have utterance_end_ms >= 1000
- TypeScript build passes (npx tsc --noEmit)
- All voice/STT tests pass
- Existing reconnect/wait/buffer tests unaffected
- Adult config (1500ms) unchanged

## ОГРАНИЧЕНИЯ
- НЕ трогать Kids Brain
- НЕ трогать TTS
- НЕ трогать frontend
- НЕ менять модель Claude
- НЕ трогать payment/billing
- Только voice/STT config
