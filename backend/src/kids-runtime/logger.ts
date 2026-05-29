import type { SessionLog, SessionState } from './types.js';

const sessionLogs = new Map<string, SessionLog[]>();

export function log(
  state: SessionState,
  type: SessionLog['type'],
  data: Record<string, unknown>
): void {
  const entry: SessionLog = {
    timestamp: new Date(),
    type,
    data: {
      ...data,
      sessionId: state.sessionId,
      childName: state.childName,
      elapsedSeconds: state.timingState.elapsedSeconds,
      recoveryLevel: state.emotionalState.recoveryLevel,
    },
  };

  const logs = sessionLogs.get(state.sessionId) ?? [];
  logs.push(entry);
  sessionLogs.set(state.sessionId, logs);

  process.stderr.write(JSON.stringify(entry) + '\n');
}

export function getSessionLogs(sessionId: string): SessionLog[] {
  return sessionLogs.get(sessionId) ?? [];
}

export function clearSessionLogs(sessionId: string): void {
  sessionLogs.delete(sessionId);
}
