import type { RuntimeActionPacket } from '../runtime/runtime-types.js';
import { RuntimeActionPacketType } from '../runtime/runtime-types.js';

/**
 * Adapts RuntimeActionPacket[] → WS-ready message objects.
 *
 * PHASE 7.6 SCOPE: This adapter creates message objects only.
 * It does NOT call send(ws, ...) — that wiring happens in Phase 8.
 *
 * Mapping table:
 *   teacher_text    → KidsTeacherTextMessage  (compatible with OutboundAiText shape)
 *   start_listening → KidsStartListeningMessage (Phase 8 mapping: enable mic)
 *   stop_listening  → KidsStopListeningMessage  (Phase 8 mapping: disable mic)
 *   session_complete → KidsSessionCompleteMessage (compatible with OutboundLessonEnd shape)
 *   safety_close    → KidsSafetyCloseMessage     (text + close signal)
 *
 * Phase 8 TODO: wire these types into lesson-ws.ts isKidsMode block only.
 * Audio packets (audio_chunk) are intentionally NOT generated in Phase 7.
 */

// ── Message types ─────────────────────────────────────────────────────────────

/** Maps to existing OutboundAiText. Phase 8: pass to send(ws, ...) directly. */
export interface KidsTeacherTextMessage {
  type: 'kids_teacher_text';
  text: string;
  feedbackTone: string;
  sessionId: string;
  turnNumber: number;
  waitMs: number;
  nextPrompt: string | null;
}

/**
 * No existing OutboundMessage type for mic control.
 * Phase 8 mapping: send a 'kids_start_listening' signal to the frontend.
 * Frontend must handle mic activation on receipt.
 */
export interface KidsStartListeningMessage {
  type: 'kids_start_listening';
  sessionId: string;
  turnNumber: number;
}

/**
 * No existing OutboundMessage type for mic control.
 * Phase 8 mapping: send a 'kids_stop_listening' signal to the frontend.
 */
export interface KidsStopListeningMessage {
  type: 'kids_stop_listening';
  sessionId: string;
  turnNumber: number;
}

/** Maps to OutboundLessonEnd shape. Phase 8: transform and pass to send(ws, ...). */
export interface KidsSessionCompleteMessage {
  type: 'kids_session_complete';
  sessionId: string;
  turnNumber: number;
}

/**
 * Safety close: emit a safe teacher text first, then signal WS close.
 * Phase 8: send text with send(ws, ...), then ws.close(4400, 'Safety close').
 */
export interface KidsSafetyCloseMessage {
  type: 'kids_safety_close';
  text: string;
  sessionId: string;
  turnNumber: number;
}

export type AdaptedKidsMessage =
  | KidsTeacherTextMessage
  | KidsStartListeningMessage
  | KidsStopListeningMessage
  | KidsSessionCompleteMessage
  | KidsSafetyCloseMessage;

// ── Adapter ───────────────────────────────────────────────────────────────────

export function adaptRuntimePackets(packets: RuntimeActionPacket[]): AdaptedKidsMessage[] {
  const messages: AdaptedKidsMessage[] = [];

  for (const packet of packets) {
    switch (packet.packetType) {
      case RuntimeActionPacketType.TEACHER_TEXT:
        messages.push({
          type: 'kids_teacher_text',
          text: packet.teacherText ?? '',
          feedbackTone: packet.feedbackTone ?? 'neutral',
          sessionId: packet.sessionId,
          turnNumber: packet.turnNumber,
          waitMs: packet.waitMs ?? 0,
          nextPrompt: packet.nextPrompt ?? null,
        });
        break;

      case RuntimeActionPacketType.START_LISTENING:
        messages.push({
          type: 'kids_start_listening',
          sessionId: packet.sessionId,
          turnNumber: packet.turnNumber,
        });
        break;

      case RuntimeActionPacketType.STOP_LISTENING:
        messages.push({
          type: 'kids_stop_listening',
          sessionId: packet.sessionId,
          turnNumber: packet.turnNumber,
        });
        break;

      case RuntimeActionPacketType.SESSION_COMPLETE:
        messages.push({
          type: 'kids_session_complete',
          sessionId: packet.sessionId,
          turnNumber: packet.turnNumber,
        });
        break;

      case RuntimeActionPacketType.SAFETY_CLOSE:
        messages.push({
          type: 'kids_safety_close',
          text: packet.teacherText ?? "That's okay. We'll play again soon. Bye-bye!",
          sessionId: packet.sessionId,
          turnNumber: packet.turnNumber,
        });
        break;

      default: {
        const _exhaustive: never = packet.packetType;
        console.warn('[kids-ws-adapter] unknown packet type:', _exhaustive);
      }
    }
  }

  return messages;
}

/**
 * Returns true if any adapted message triggers a WS close.
 * Phase 8: after sending all messages, call ws.close() when this is true.
 */
export function requiresSessionClose(messages: AdaptedKidsMessage[]): boolean {
  return messages.some(
    (m) => m.type === 'kids_safety_close' || m.type === 'kids_session_complete',
  );
}
