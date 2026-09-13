import { conclusionScoreEvents, sanitizeConclusion } from '../domain/conclusion';
import { sanitizeNotes } from '../domain/notes';
import { clampFatigue, resolveEmotion } from '../domain/session';
import {
  CONCLUSION_NODE_ID,
  type ClinicalConclusion,
  type Scenario,
  type ScoreEvent,
  type SimulationSession,
  type StudentNotes,
} from '../domain/types';

export type SimulationAction =
  | { type: 'hydrate'; session: SimulationSession }
  | { type: 'start'; session: SimulationSession }
  | { type: 'select-option'; optionId: string; scenario: Scenario; at: string }
  | { type: 'complete-transition'; scenario: Scenario }
  | { type: 'repeat-response' }
  | { type: 'save-notes'; notes: StudentNotes }
  | { type: 'pause'; at: string }
  | { type: 'resume'; at: string }
  | { type: 'end-early'; at: string }
  | { type: 'submit-conclusion'; conclusion: ClinicalConclusion; scenario: Scenario; at: string }
  | { type: 'clear' };

function findNode(scenario: Scenario, nodeId: string) {
  return scenario.nodes.find((node) => node.id === nodeId);
}

function accrueTime(session: SimulationSession, at: string): number {
  if (
    session.status === 'paused' ||
    session.status === 'completed' ||
    session.status === 'abandoned'
  ) {
    return session.accumulatedActiveMs;
  }
  const last = Date.parse(session.lastResumedAt);
  const now = Date.parse(at);
  if (Number.isNaN(last) || Number.isNaN(now)) {
    return session.accumulatedActiveMs;
  }
  return session.accumulatedActiveMs + Math.max(0, now - last);
}

export function simulationReducer(
  session: SimulationSession | null,
  action: SimulationAction,
): SimulationSession | null {
  switch (action.type) {
    case 'hydrate':
    case 'start':
      return { ...action.session, transitioning: false };
    case 'clear':
      return null;
    default:
      break;
  }

  if (!session) {
    return session;
  }

  switch (action.type) {
    case 'select-option': {
      if (session.transitioning || session.status !== 'in_progress') {
        return session;
      }
      const node = findNode(action.scenario, session.currentNodeId);
      const option = node?.options.find((item) => item.id === action.optionId);
      if (!node || !option) {
        return session;
      }
      const event: ScoreEvent = {
        id: `${node.id}:${option.id}`,
        nodeId: node.id,
        optionId: option.id,
        quality: option.quality,
        unsafe: option.unsafe,
        competencyAwards: option.competencyAwards,
        clientResponse: option.clientResponse.text,
        emotion: option.emotion,
        delayedFeedback: option.delayedFeedback,
        educationalRationale: option.educationalRationale,
        at: action.at,
      };
      const fatigueLevel = clampFatigue(session.fatigueLevel + option.fatigueDelta);
      return {
        ...session,
        updatedAt: action.at,
        transitioning: true,
        lastSpokenOptionId: option.id,
        lastClientResponse: option.clientResponse,
        clientEmotion: resolveEmotion(option.emotion, fatigueLevel),
        fatigueLevel,
        flags: { ...session.flags, ...option.flags },
        history: [...session.history, event],
        queuedNodeId: option.nextNodeId,
      };
    }
    case 'complete-transition': {
      if (!session.transitioning) {
        return session;
      }
      const nextId = session.queuedNodeId ?? session.currentNodeId;
      const reachedConclusion = nextId === CONCLUSION_NODE_ID;
      const nextNode = findNode(action.scenario, nextId);
      return {
        ...session,
        transitioning: false,
        queuedNodeId: null,
        currentNodeId: nextId,
        status: reachedConclusion ? 'awaiting_conclusion' : session.status,
        lastClientResponse: reachedConclusion
          ? session.lastClientResponse
          : (nextNode?.prompt ?? session.lastClientResponse),
        clientEmotion: reachedConclusion
          ? session.clientEmotion
          : (nextNode?.promptEmotion ?? session.clientEmotion),
      };
    }
    case 'repeat-response':
      return {
        ...session,
        lastSpokenOptionId: session.lastSpokenOptionId
          ? `${session.lastSpokenOptionId}-repeat`
          : 'repeat',
      };
    case 'save-notes':
      return {
        ...session,
        notes: sanitizeNotes(action.notes),
        updatedAt: new Date().toISOString(),
      };
    case 'pause': {
      if (session.status !== 'in_progress') {
        return session;
      }
      return {
        ...session,
        status: 'paused',
        pauseStartedAt: action.at,
        accumulatedActiveMs: accrueTime(session, action.at),
        updatedAt: action.at,
      };
    }
    case 'resume': {
      if (session.status !== 'paused') {
        return session;
      }
      return {
        ...session,
        status: 'in_progress',
        pauseStartedAt: null,
        lastResumedAt: action.at,
        updatedAt: action.at,
      };
    }
    case 'end-early': {
      if (session.status === 'completed') {
        return session;
      }
      return {
        ...session,
        status: 'awaiting_conclusion',
        transitioning: false,
        currentNodeId: CONCLUSION_NODE_ID,
        accumulatedActiveMs: accrueTime(session, action.at),
        lastResumedAt: action.at,
        updatedAt: action.at,
      };
    }
    case 'submit-conclusion': {
      const conclusion = sanitizeConclusion(action.conclusion);
      const extra = conclusionScoreEvents(conclusion, action.scenario, new Date(action.at));
      return {
        ...session,
        status: 'completed',
        conclusion,
        history: [
          ...session.history.filter((event) => !event.nodeId.startsWith('conclusion-')),
          ...extra,
        ],
        accumulatedActiveMs: accrueTime(session, action.at),
        updatedAt: action.at,
      };
    }
    default:
      return session;
  }
}
