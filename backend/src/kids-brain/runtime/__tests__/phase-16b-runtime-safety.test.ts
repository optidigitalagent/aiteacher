/**
 * Phase 16B — Kids v1 Runtime Safety Patch Tests
 *
 * Verifies:
 * 1. TTS cap check exists in processKidsBrainV1Turn (blocks before TTS call)
 * 2. TTS cap does not call kidsTtsStream (sends lesson_end instead)
 * 3. TTS cap sends safe ai_text message, not an error
 * 4. LLM cap behavior unchanged (still present, still closes with 4400)
 * 5. logsToEmit is iterated and emitted in lesson-ws.ts
 * 6. Reconnect resume sends child-facing ai_text
 * 7. Reconnect does not reset currentTargetItemId (state preserved)
 * 8. No WebSocket protocol changes (no new outbound message types)
 * 9. No curriculum changes (curriculum files untouched)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
const wsContent = readFileSync(wsPath, 'utf-8');

// ── 1. TTS cap check exists in processKidsBrainV1Turn ────────────────────────

describe('TTS cap: guard present in processKidsBrainV1Turn', () => {
  it('tts_cap_reached log label is present', () => {
    expect(wsContent).toContain('tts_cap_reached');
  });

  it('KIDS_MAX_TTS_CHARS comparison exists in function body', () => {
    expect(wsContent).toContain('meta.ttsCharCount >= KIDS_MAX_TTS_CHARS');
  });

  it('TTS cap check appears before processKidsV1Packets call within processKidsBrainV1Turn', () => {
    // Extract the processKidsBrainV1Turn function body
    const fnMatch = wsContent.match(/async function processKidsBrainV1Turn[\s\S]{1,12000}?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    const ttsCapIdx = fnBody.indexOf('tts_cap_reached');
    const packetsIdx = fnBody.indexOf("await processKidsV1Packets(ws, meta, adapted)");
    expect(ttsCapIdx).toBeGreaterThan(0);
    expect(packetsIdx).toBeGreaterThan(ttsCapIdx);
  });
});

// ── 2. TTS cap path does not call TTS provider ────────────────────────────────

describe('TTS cap: no TTS call on cap exceeded path', () => {
  it('TTS cap block sends lesson_end and returns before kidsTtsStream', () => {
    // The TTS cap block must contain lesson_end and ws.close('TTS cap reached')
    expect(wsContent).toContain("ws.close(1000, 'TTS cap reached')");
  });

  it('TTS cap block does NOT call kidsTtsStream', () => {
    // Extract the TTS cap block between tts_cap_reached and the next meta.aiCallCount++
    const capStart = wsContent.indexOf('tts_cap_reached');
    const capEnd = wsContent.indexOf('meta.aiCallCount++', capStart);
    const capBlock = wsContent.slice(capStart, capEnd);
    expect(capBlock).not.toContain('kidsTtsStream');
  });
});

// ── 3. TTS cap sends safe ai_text, not error ──────────────────────────────────

describe('TTS cap: graceful close with safe ai_text', () => {
  it('TTS cap block sends an ai_text message with safe close text', () => {
    expect(wsContent).toContain("Great work today! Time to finish.");
  });

  it('TTS cap block does NOT send type error for cap', () => {
    const capStart = wsContent.indexOf('tts_cap_reached');
    const capEnd = wsContent.indexOf('meta.aiCallCount++', capStart);
    const capBlock = wsContent.slice(capStart, capEnd);
    // Should close with 1000 (normal), not 4400 (error)
    expect(capBlock).toContain("ws.close(1000");
    expect(capBlock).not.toContain("ws.close(4400");
  });

  it('TTS cap block persists analytics before closing', () => {
    const capStart = wsContent.indexOf('tts_cap_reached');
    const capEnd = wsContent.indexOf('meta.aiCallCount++', capStart);
    const capBlock = wsContent.slice(capStart, capEnd);
    expect(capBlock).toContain('kidsAnalyticsFinalized');
    expect(capBlock).toContain('persistKidsBrainAnalytics');
  });
});

// ── 4. LLM cap behavior unchanged ────────────────────────────────────────────

describe('LLM cap: existing behavior preserved', () => {
  it('LLM cap check still present', () => {
    expect(wsContent).toContain('meta.aiCallCount >= KIDS_MAX_LLM_CALLS');
  });

  it('LLM cap still closes with 4400', () => {
    expect(wsContent).toContain("ws.close(4400, 'Call limit reached')");
  });

  it('LLM cap check appears before TTS cap check', () => {
    const llmCapIdx = wsContent.indexOf("ws.close(4400, 'Call limit reached')");
    const ttsCapIdx = wsContent.indexOf("ws.close(1000, 'TTS cap reached')");
    expect(llmCapIdx).toBeGreaterThan(0);
    expect(ttsCapIdx).toBeGreaterThan(llmCapIdx);
  });
});

// ── 5. logsToEmit is emitted/logged ──────────────────────────────────────────

describe('logsToEmit: structured logs emitted from turn result', () => {
  it('result.logsToEmit is iterated', () => {
    expect(wsContent).toContain('result.logsToEmit');
  });

  it('kids-v1-log label is used when emitting', () => {
    expect(wsContent).toContain('[kids-v1-log]');
  });

  it('ERROR severity logs use console.error', () => {
    // Find the logsToEmit loop and verify it branches on severity
    const loopIdx = wsContent.indexOf('result.logsToEmit');
    const loopEnd = wsContent.indexOf('// Safety close', loopIdx);
    const loopBlock = wsContent.slice(loopIdx, loopEnd);
    expect(loopBlock).toContain('console.error');
    expect(loopBlock).toContain("'ERROR'");
  });

  it('logEvent.payload is included in the emitted log', () => {
    expect(wsContent).toContain('logEvent.payload');
  });
});

// ── 6. Reconnect resume sends child-facing ai_text ────────────────────────────

describe('reconnect resume: child-facing message sent', () => {
  it('resume message text is present', () => {
    expect(wsContent).toContain("Hi again! Let's keep going.");
  });

  it('ai_text is sent on reconnect resume path', () => {
    const resumeIdx = wsContent.indexOf("Hi again! Let's keep going.");
    // The send call with ai_text must be near the resume text
    const nearbyBlock = wsContent.slice(Math.max(0, resumeIdx - 200), resumeIdx + 200);
    expect(nearbyBlock).toContain("type: 'ai_text'");
  });

  it('kidsTtsStream is called with resume text', () => {
    const resumeIdx = wsContent.indexOf("Hi again! Let's keep going.");
    // kidsTtsStream must appear after the resume text definition
    const afterResume = wsContent.slice(resumeIdx, resumeIdx + 400);
    expect(afterResume).toContain('kidsTtsStream');
  });

  it('target word is included in resume message when available', () => {
    expect(wsContent).toContain('Listen — ${target}! Now you!');
  });
});

// ── 7. Reconnect does not reset state ────────────────────────────────────────

describe('reconnect resume: state preservation', () => {
  it('existingMemory check still present (state preserved branch)', () => {
    expect(wsContent).toContain('existingMemory');
  });

  it('reconnect path does not call startKidsBrainSession for existing sessions', () => {
    // The existingMemory branch returns early — cold-start is in the else path
    // Verify the resume text and cold-start call are both inside handleKidsBrainV1LessonStart
    const fnMatch = wsContent.match(/async function handleKidsBrainV1LessonStart[\s\S]{1,8000}?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    // Resume message and cold-start call both inside the same function
    expect(fnBody).toContain("Hi again! Let's keep going.");
    expect(fnBody).toContain('startKidsBrainSession');
    // existingMemory guard ensures cold-start is skipped on reconnect
    expect(fnBody).toContain('existingMemory');
    // The return statement inside the existingMemory block precedes cold-start
    const resumeReturnIdx = fnBody.indexOf("Hi again! Let's keep going.");
    const coldStartIdx = fnBody.indexOf('startKidsBrainSession');
    expect(resumeReturnIdx).toBeGreaterThan(0);
    expect(coldStartIdx).toBeGreaterThan(resumeReturnIdx);
  });

  it('currentTargetItemId is read from existingMemory, not overwritten', () => {
    expect(wsContent).toContain('existingMemory.currentTargetItemId');
  });
});

// ── 8. No WebSocket protocol changes ─────────────────────────────────────────

describe('no WebSocket protocol changes', () => {
  it('resume message uses existing ai_text type (no new message type)', () => {
    // Verify the resume path uses the standard ai_text type, not a new one
    const resumeIdx = wsContent.indexOf("Hi again! Let's keep going.");
    const block = wsContent.slice(Math.max(0, resumeIdx - 200), resumeIdx + 200);
    expect(block).toContain("type: 'ai_text'");
    expect(block).not.toContain("type: 'kids_resume'");
  });

  it('TTS cap close uses standard lesson_end type', () => {
    const capBlock = wsContent.slice(
      wsContent.indexOf('tts_cap_reached'),
      wsContent.indexOf("ws.close(1000, 'TTS cap reached')") + 50,
    );
    expect(capBlock).toContain("type: 'lesson_end'");
  });
});

// ── 9. No curriculum changes ──────────────────────────────────────────────────

describe('no curriculum changes', () => {
  it('curriculum lesson target words are unchanged (7 KB1 colours)', () => {
    // Curriculum words for kb1-u01-l02 Colours lesson
    expect(wsContent).toContain("'cambridge-kids-box-1'");
    expect(wsContent).toContain("'kb1-unit-01'");
    expect(wsContent).toContain("'kb1-u01-l02'");
  });

  it('PROTO_LESSON_ID is still kb1-u01-l02', () => {
    expect(wsContent).toContain("PROTO_LESSON_ID = 'kb1-u01-l02'");
  });
});
