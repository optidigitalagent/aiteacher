export type ResponseSignal =
  | 'CORRECT_CONFIDENT'
  | 'CORRECT_HESITANT'
  | 'INCORRECT_ATTEMPT'
  | 'NO_RESPONSE'
  | 'L1_SWITCH'
  | 'REPEATED_FAILURE'
  | 'EMOTIONAL_SHUTDOWN';

export type QuestionType = 'RECOGNITION' | 'FORCED_CHOICE' | 'SUPPORTED_PRODUCTION' | 'FREE_PRODUCTION';
export type RecoveryLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type RescueLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type EmotionalState = 'engaged' | 'neutral' | 'hesitant' | 'frustrated' | 'shutdown';
export type SessionPhase = 'open' | 'main' | 'review' | 'closing';
export type SessionStatus = 'active' | 'closing' | 'completed' | 'abandoned';

export interface ItemState {
  itemId: string;
  confidenceScore: number;
  modesUsed: string[];
  attempts: number;
  successes: number;
  consecutiveFailures: number;
  introducedAtMinute: number;
}

export interface LearningObject {
  id: string;
  word: string;
  topic: string;
  forms: string[];
  soundCueId: string;
  visualCueId: string;
  tprGesture: string;
  difficulty: number;
  semanticCluster: string[];
  l1Translations: { uk: string; ru?: string };
  rescueLadderScripts: { level1: string; level2: string; level3: string };
}

export interface SessionState {
  sessionId: string;
  childId: string;
  childName: string;
  childAge: number;
  childL1: 'uk' | 'ru';
  sessionNumber: number;
  unit: number;
  startedAt: Date;
  endedAt: Date | null;
  status: SessionStatus;

  curriculumState: {
    activeItems: ItemState[];
    completedItems: string[];
    flaggedItems: Array<{
      itemId: string;
      reason: string;
      flaggedAtMinute: number;
      failedMode: string;
    }>;
    currentItemId: string | null;
    currentQuestionType: QuestionType;
    sessionPlan: string[];
  };

  emotionalState: {
    recoveryLevel: RecoveryLevel;
    globalConfidenceScore: number;
    consecutiveSuccesses: number;
    freezeEventsThisSession: number;
    emotionalShutdownOccurred: boolean;
    lastResponseSignal: ResponseSignal | null;
    stateEstimate: EmotionalState;
  };

  immersionState: {
    rescueLevel: RescueLevel;
    l1EventsThisSession: number;
    l1Items: string[];
    waitTimeState: 'idle' | 'waiting' | 'elapsed';
    waitStartedAtMs: number | null;
  };

  rewardState: {
    lastRewardId: string | null;
    rewardsDeliveredThisSession: number;
    currentStreak: number;
  };

  timingState: {
    elapsedSeconds: number;
    lastNoveltyInjectionAtSecond: number | null;
    sessionPhase: SessionPhase;
    minutesUntilClose: number;
  };

  costState: {
    llmCallsThisSession: number;
    ttsCharsThisSession: number;
    estimatedCostUsd: number;
    costCapReached: boolean;
  };

  openLoopState: {
    hasOpenLoop: boolean;
    openLoopType?: 'story_cliffhanger' | 'partial_collection' | 'next_session_hint' | 'character_secret';
    openLoopText?: string;
  };

  recoveryHistory: Array<{
    itemId: string;
    recoveryLevel: number;
    patternUsed: string;
    resolved: boolean;
    atMinute: number;
  }>;
}

export interface ChildResponse {
  text: string;
  latencyMs: number;
  audioVolume?: number;
}

export interface TeacherTurn {
  fastTrack: { text: string; animation: string };
  slowTrack: { text: string; animation: string; isScripted: boolean };
  frontendSignals: Array<{ type: string; payload: Record<string, unknown> }>;
}

export interface SessionLog {
  timestamp: Date;
  type:
    | 'response_signal'
    | 'recovery_trigger'
    | 'recovery_success'
    | 'recovery_failure'
    | 'confidence_change'
    | 'l1_rescue'
    | 'response_latency'
    | 'child_response_type'
    | 'session_event'
    | 'llm_call'
    | 'cost';
  data: Record<string, unknown>;
}

export interface StartSessionParams {
  childId: string;
  childName: string;
  childAge: number;
  childL1: 'uk' | 'ru';
  sessionNumber: number;
  previousSessionHighlight?: string;
  previousOpenLoop?: string;
}

export interface SessionResult {
  fastTrack: { text: string; animation: string };
  slowTrack: { text: string; animation: string; isScripted: boolean };
  updatedState: SessionState;
  frontendSignals: Array<{ type: string; payload: Record<string, unknown> }>;
  shouldClose: boolean;
  responseSignal: ResponseSignal;
}
