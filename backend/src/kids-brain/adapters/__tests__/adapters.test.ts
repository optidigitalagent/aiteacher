import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { buildSTTResult, buildSTTResultFromText } from '../stt-adapter.js';
import { adaptRuntimePackets, requiresSessionClose } from '../ws-action-adapter.js';
import { RuntimeActionPacketType } from '../../runtime/runtime-types.js';
import type { RuntimeActionPacket } from '../../runtime/runtime-types.js';
import { FeedbackTone } from '../../shared/enums.js';

// ── 9. STT adapter handles transcript only ────────────────────────────────────

describe('STT adapter — text only', () => {
  it('builds a valid STTResult from text alone', () => {
    const result = buildSTTResultFromText('hello');
    expect(result.text).toBe('hello');
    expect(result.confidence).toBeNull();
    expect(result.languageCode).toBeNull();
    expect(result.alternatives).toEqual([]);
    expect(result.speechStartMs).toBeNull();
    expect(result.speechEndMs).toBeNull();
    expect(result.speechDurationMs).toBeNull();
    expect(result.audioEnergyLevel).toBeNull();
    expect(result.provider).toBe('google_chirp_v2');
    expect(typeof result.providerRequestId).toBe('string');
    expect(result.providerRequestId.length).toBeGreaterThan(0);
  });

  it('handles null text (no speech)', () => {
    const result = buildSTTResultFromText(null);
    expect(result.text).toBeNull();
    expect(result.confidence).toBeNull();
  });
});

// ── 10. STT adapter handles missing confidence ────────────────────────────────

describe('STT adapter — missing confidence', () => {
  it('sets confidence to null when not provided', () => {
    const result = buildSTTResult({ text: 'dog' });
    expect(result.confidence).toBeNull();
  });

  it('sets confidence to null when explicitly null', () => {
    const result = buildSTTResult({ text: 'dog', confidence: null });
    expect(result.confidence).toBeNull();
  });

  it('passes through confidence when provided', () => {
    const result = buildSTTResult({ text: 'dog', confidence: 0.87 });
    expect(result.confidence).toBe(0.87);
  });
});

// ── 11. STT adapter handles alternatives ─────────────────────────────────────

describe('STT adapter — alternatives', () => {
  it('passes alternatives through when provided', () => {
    const alts = [
      { text: 'cat', confidence: 0.7 },
      { text: 'bat', confidence: 0.5 },
    ];
    const result = buildSTTResult({ text: 'dog', alternatives: alts });
    expect(result.alternatives).toEqual(alts);
  });

  it('defaults alternatives to empty array when not provided', () => {
    const result = buildSTTResult({ text: 'dog' });
    expect(result.alternatives).toEqual([]);
    expect(Array.isArray(result.alternatives)).toBe(true);
  });

  it('derives speechDurationMs from start/end when not explicitly provided', () => {
    const result = buildSTTResult({ text: 'dog', speechStartMs: 100, speechEndMs: 600 });
    expect(result.speechDurationMs).toBe(500);
  });

  it('keeps explicit speechDurationMs when provided', () => {
    const result = buildSTTResult({ text: 'dog', speechDurationMs: 350 });
    expect(result.speechDurationMs).toBe(350);
  });

  it('rawProviderPayload is preserved', () => {
    const payload = { internal: 'data', requestId: 'abc' };
    const result = buildSTTResult({ text: 'dog', rawProviderPayload: payload });
    expect(result.rawProviderPayload).toEqual(payload);
  });
});

// ── 12. WS adapter maps teacher_text ─────────────────────────────────────────

describe('WS action adapter — teacher_text', () => {
  it('maps TEACHER_TEXT packet to kids_teacher_text message', () => {
    const packet: RuntimeActionPacket = {
      packetType: RuntimeActionPacketType.TEACHER_TEXT,
      sessionId: 'session-1',
      turnNumber: 3,
      teacherText: 'Dog! Yes! You said DOG!',
      feedbackTone: FeedbackTone.CELEBRATORY,
      waitMs: 2000,
      nextPrompt: 'What is this?',
      ttsVoiceId: 'luna',
    };

    const messages = adaptRuntimePackets([packet]);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('kids_teacher_text');
    if (messages[0].type === 'kids_teacher_text') {
      expect(messages[0].text).toBe('Dog! Yes! You said DOG!');
      expect(messages[0].sessionId).toBe('session-1');
      expect(messages[0].turnNumber).toBe(3);
      expect(messages[0].waitMs).toBe(2000);
      expect(messages[0].nextPrompt).toBe('What is this?');
    }
  });

  it('maps missing teacherText to empty string', () => {
    const packet: RuntimeActionPacket = {
      packetType: RuntimeActionPacketType.TEACHER_TEXT,
      sessionId: 'session-1',
      turnNumber: 1,
      ttsVoiceId: 'luna',
    };
    const messages = adaptRuntimePackets([packet]);
    if (messages[0].type === 'kids_teacher_text') {
      expect(messages[0].text).toBe('');
    }
  });
});

// ── 13. WS adapter maps safety_close ─────────────────────────────────────────

describe('WS action adapter — safety_close', () => {
  it('maps SAFETY_CLOSE to kids_safety_close with teacher text', () => {
    const packet: RuntimeActionPacket = {
      packetType: RuntimeActionPacketType.SAFETY_CLOSE,
      sessionId: 'session-1',
      turnNumber: 5,
      teacherText: "That's okay. Bye-bye!",
      ttsVoiceId: 'luna',
    };

    const messages = adaptRuntimePackets([packet]);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('kids_safety_close');
    if (messages[0].type === 'kids_safety_close') {
      expect(messages[0].text).toBe("That's okay. Bye-bye!");
    }
  });

  it('uses fallback text when teacherText missing on safety_close', () => {
    const packet: RuntimeActionPacket = {
      packetType: RuntimeActionPacketType.SAFETY_CLOSE,
      sessionId: 'session-1',
      turnNumber: 5,
      ttsVoiceId: 'luna',
    };
    const messages = adaptRuntimePackets([packet]);
    if (messages[0].type === 'kids_safety_close') {
      expect(messages[0].text.length).toBeGreaterThan(0);
    }
  });

  it('requiresSessionClose returns true for safety_close', () => {
    const messages = adaptRuntimePackets([{
      packetType: RuntimeActionPacketType.SAFETY_CLOSE,
      sessionId: 's',
      turnNumber: 1,
      ttsVoiceId: 'luna',
    }]);
    expect(requiresSessionClose(messages)).toBe(true);
  });

  it('requiresSessionClose returns true for session_complete', () => {
    const messages = adaptRuntimePackets([{
      packetType: RuntimeActionPacketType.SESSION_COMPLETE,
      sessionId: 's',
      turnNumber: 1,
      ttsVoiceId: 'luna',
    }]);
    expect(requiresSessionClose(messages)).toBe(true);
  });
});

// ── 14. WS adapter does not emit audio packets ────────────────────────────────

describe('WS action adapter — no audio packets', () => {
  it('does not produce any audio_chunk type messages', () => {
    const packets: RuntimeActionPacket[] = [
      { packetType: RuntimeActionPacketType.TEACHER_TEXT, sessionId: 's', turnNumber: 1, teacherText: 'Hi!', ttsVoiceId: 'luna' },
      { packetType: RuntimeActionPacketType.START_LISTENING, sessionId: 's', turnNumber: 1, ttsVoiceId: 'luna' },
      { packetType: RuntimeActionPacketType.STOP_LISTENING, sessionId: 's', turnNumber: 1, ttsVoiceId: 'luna' },
      { packetType: RuntimeActionPacketType.SESSION_COMPLETE, sessionId: 's', turnNumber: 1, ttsVoiceId: 'luna' },
    ];
    const messages = adaptRuntimePackets(packets);
    const hasAudio = messages.some((m) => 'data' in m);
    expect(hasAudio).toBe(false);
  });

  it('maps start_listening to kids_start_listening', () => {
    const messages = adaptRuntimePackets([{
      packetType: RuntimeActionPacketType.START_LISTENING,
      sessionId: 's',
      turnNumber: 2,
      ttsVoiceId: 'luna',
    }]);
    expect(messages[0].type).toBe('kids_start_listening');
  });

  it('maps stop_listening to kids_stop_listening', () => {
    const messages = adaptRuntimePackets([{
      packetType: RuntimeActionPacketType.STOP_LISTENING,
      sessionId: 's',
      turnNumber: 2,
      ttsVoiceId: 'luna',
    }]);
    expect(messages[0].type).toBe('kids_stop_listening');
  });
});

// ── 15. Phase 8: lesson-ws.ts wired to kids-brain/adapters ───────────────────

describe('Phase 8 wiring: lesson-ws.ts imports kids-brain adapters', () => {
  it('lesson-ws.ts imports adaptRuntimePackets from kids-brain/adapters', async () => {
    const { readFileSync } = await import('node:fs');
    const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
    const content = readFileSync(wsPath, 'utf-8');
    expect(content).toContain('kids-brain/adapters');
    expect(content).toContain('adaptRuntimePackets');
    expect(content).toContain('kids-brain/infrastructure');
  });
});

// ── 16. No adult Obsidian imports in kids-brain adapters ──────────────────────

describe('adult isolation: no obsidian imports in adapters', () => {
  it('stt-adapter.ts has no adult imports', async () => {
    const { readFileSync } = await import('node:fs');
    const content = readFileSync(resolve(__dirname, '../stt-adapter.ts'), 'utf-8');
    expect(content).not.toMatch(/obsidian-brain|obsidian\/|teacher-brain|\/engine\//);
  });

  it('ws-action-adapter.ts has no adult imports', async () => {
    const { readFileSync } = await import('node:fs');
    const content = readFileSync(resolve(__dirname, '../ws-action-adapter.ts'), 'utf-8');
    expect(content).not.toMatch(/obsidian-brain|obsidian\/|teacher-brain|\/engine\//);
  });
});
