export class KidsBrainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sessionId?: string,
    public readonly childId?: string,
  ) {
    super(message);
    this.name = 'KidsBrainError';
  }
}

export class KidsBrainSafetyError extends KidsBrainError {
  constructor(sessionId: string, childId: string, detectionMethod: string) {
    super(
      `Safety event detected via ${detectionMethod}`,
      'SAFETY_ESCALATION',
      sessionId,
      childId,
    );
    this.name = 'KidsBrainSafetyError';
  }
}

export class KidsBrainSessionError extends KidsBrainError {
  constructor(message: string, sessionId: string) {
    super(message, 'SESSION_ERROR', sessionId);
    this.name = 'KidsBrainSessionError';
  }
}

export class KidsBrainVocabGuardError extends KidsBrainError {
  constructor(
    public readonly offendingToken: string,
    sessionId: string,
  ) {
    super(
      `Vocabulary guard blocked token: "${offendingToken}"`,
      'VOCAB_GUARD_BLOCK',
      sessionId,
    );
    this.name = 'KidsBrainVocabGuardError';
  }
}

export class KidsBrainStoreError extends KidsBrainError {
  constructor(
    message: string,
    public readonly storeType: 'redis' | 'postgres' | 'safety',
    sessionId?: string,
  ) {
    super(message, 'STORE_ERROR', sessionId);
    this.name = 'KidsBrainStoreError';
  }
}
