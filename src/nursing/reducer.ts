import { currentNursingStep } from './session';
import type { NursingSession, NursingStep } from './types';

export type NursingAction =
  | { type: 'start'; session: NursingSession }
  | { type: 'hydrate'; session: NursingSession }
  | { type: 'unlock-audio' }
  | { type: 'select'; optionId: string; at: string; steps?: readonly NursingStep[] }
  | { type: 'pause'; at: string }
  | { type: 'resume'; at: string }
  | { type: 'clear' };

function accrue(session: NursingSession, at: string): number {
  if (session.status === 'paused' || session.status === 'completed') {
    return session.accumulatedActiveMs;
  }
  const last = Date.parse(session.lastResumedAt);
  const now = Date.parse(at);
  if (Number.isNaN(last) || Number.isNaN(now)) {
    return session.accumulatedActiveMs;
  }
  return session.accumulatedActiveMs + Math.max(0, now - last);
}

export function nursingReducer(
  session: NursingSession | null,
  action: NursingAction,
): NursingSession | null {
  if (action.type === 'start' || action.type === 'hydrate') {
    return action.session;
  }
  if (action.type === 'clear') {
    return null;
  }
  if (!session) {
    return session;
  }
  if (action.type === 'unlock-audio') {
    return { ...session, audioUnlocked: true, mediaState: 'observeren' };
  }
  if (action.type === 'pause') {
    if (session.status !== 'in_progress') {
      return session;
    }
    return {
      ...session,
      status: 'paused',
      pauseStartedAt: action.at,
      accumulatedActiveMs: accrue(session, action.at),
      mediaState: 'gepauzeerd',
      updatedAt: action.at,
    };
  }
  if (action.type === 'resume') {
    if (session.status !== 'paused') {
      return session;
    }
    return {
      ...session,
      status: 'in_progress',
      pauseStartedAt: null,
      lastResumedAt: action.at,
      mediaState: 'observeren',
      updatedAt: action.at,
    };
  }
  if (action.type === 'select') {
    if (session.status !== 'in_progress') {
      return session;
    }
    const step = currentNursingStep(session, action.steps);
    const option = step?.options.find((item) => item.id === action.optionId);
    if (!step || !option) {
      return session;
    }
    const completed = option.nextStepId === 'completed';
    return {
      ...session,
      updatedAt: action.at,
      currentStepId: completed ? step.id : option.nextStepId,
      status: completed ? 'completed' : session.status,
      accumulatedActiveMs: completed ? accrue(session, action.at) : session.accumulatedActiveMs,
      mediaState: option.unsafe ? 'kritiek' : 'luisteren',
      sbar: step.sbarField ? { ...session.sbar, [step.sbarField]: option.text } : session.sbar,
      criticalErrors: option.criticalError
        ? [...session.criticalErrors, option.criticalError]
        : session.criticalErrors,
      history: [
        ...session.history,
        {
          id: `${step.id}:${option.id}`,
          stepId: step.id,
          optionId: option.id,
          quality: option.quality,
          unsafe: option.unsafe,
          competencyAwards: option.competencyAwards,
          delayedFeedback: option.delayedFeedback,
          educationalRationale: option.educationalRationale,
          at: action.at,
        },
      ],
    };
  }
  return session;
}
