import type { LogEvent, LogEventName } from '../shared/log-events.js';
import { LogSeverity } from '../shared/enums.js';

/** Builds a structured log event for the runtime orchestrator. */
export function buildRuntimeLog(
  event: LogEventName,
  sessionId: string,
  turnNumber: number | null,
  severity: LogSeverity,
  payload: Record<string, unknown>,
): LogEvent {
  return {
    event,
    severity,
    sessionId,
    turnNumber,
    timestamp: new Date().toISOString(),
    payload,
  };
}
