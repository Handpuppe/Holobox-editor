import { emptyFlags, EMPTY_NOTES } from './notes';
import {
  APP_VERSION,
  RUBRIC_VERSION,
  STORAGE_SCHEMA_VERSION,
  type ClientEmotion,
  type Scenario,
  type SimulationSession,
} from './types';

export function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createSession(scenario: Scenario, now = new Date()): SimulationSession {
  const startedAt = now.toISOString();
  const startNode = scenario.nodes.find((node) => node.id === scenario.startNodeId);
  if (!startNode) {
    throw new Error('Startnode ontbreekt.');
  }
  return {
    id: createSessionId(),
    schemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    rubricVersion: RUBRIC_VERSION,
    startedAt,
    updatedAt: startedAt,
    pauseStartedAt: null,
    lastResumedAt: startedAt,
    accumulatedActiveMs: 0,
    currentNodeId: startNode.id,
    queuedNodeId: null,
    status: 'in_progress',
    transitioning: false,
    history: [],
    notes: { ...EMPTY_NOTES },
    conclusion: null,
    flags: emptyFlags(),
    clientEmotion: startNode.promptEmotion,
    fatigueLevel: 0,
    lastClientResponse: startNode.prompt,
    lastSpokenOptionId: null,
  };
}

export function clampFatigue(value: number): number {
  return Math.min(3, Math.max(0, value));
}

export function resolveEmotion(base: ClientEmotion, fatigueLevel: number): ClientEmotion {
  if (fatigueLevel >= 3 && base !== 'reassured' && base !== 'frustrated') {
    return 'fatigued';
  }
  return base;
}

export function activeDurationMs(session: SimulationSession, now = Date.now()): number {
  if (
    session.status === 'paused' ||
    session.status === 'completed' ||
    session.status === 'abandoned'
  ) {
    return session.accumulatedActiveMs;
  }
  const last = Date.parse(session.lastResumedAt);
  if (Number.isNaN(last)) {
    return session.accumulatedActiveMs;
  }
  return session.accumulatedActiveMs + Math.max(0, now - last);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}
