import { APP_VERSION, STORAGE_SCHEMA_VERSION } from '../domain/types';
import { createSessionId } from '../domain/session';
import { nursingScenarioMeta, nursingSteps } from './scenario';
import type { NursingScenarioMeta, NursingSession, NursingStep } from './types';

export function createNursingSession(
  now = new Date(),
  meta: NursingScenarioMeta = nursingScenarioMeta,
): NursingSession {
  const startedAt = now.toISOString();
  return {
    id: createSessionId(),
    schemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    scenarioId: meta.id,
    scenarioVersion: meta.version,
    rubricVersion: meta.rubricVersion,
    startedAt,
    updatedAt: startedAt,
    lastResumedAt: startedAt,
    pauseStartedAt: null,
    accumulatedActiveMs: 0,
    status: 'in_progress',
    currentStepId: meta.startStepId,
    history: [],
    sbar: { situation: '', background: '', assessment: '', recommendation: '' },
    mediaState: 'observeren',
    criticalErrors: [],
    audioUnlocked: false,
  };
}

export function currentNursingStep(
  session: NursingSession,
  steps: readonly NursingStep[] = nursingSteps,
) {
  return steps.find((step) => step.id === session.currentStepId);
}
