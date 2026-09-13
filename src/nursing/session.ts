import { APP_VERSION, STORAGE_SCHEMA_VERSION } from '../domain/types';
import { createSessionId } from '../domain/session';
import { NURSING_SCENARIO_ID } from '../media/scenarioMedia';
import { nursingScenarioMeta, nursingSteps } from './scenario';
import { NURSING_RUBRIC_VERSION, type NursingSession } from './types';

export function createNursingSession(now = new Date()): NursingSession {
  const startedAt = now.toISOString();
  return {
    id: createSessionId(),
    schemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    scenarioId: NURSING_SCENARIO_ID,
    scenarioVersion: nursingScenarioMeta.version,
    rubricVersion: NURSING_RUBRIC_VERSION,
    startedAt,
    updatedAt: startedAt,
    lastResumedAt: startedAt,
    pauseStartedAt: null,
    accumulatedActiveMs: 0,
    status: 'in_progress',
    currentStepId: nursingScenarioMeta.startStepId,
    history: [],
    sbar: { situation: '', background: '', assessment: '', recommendation: '' },
    mediaState: 'observeren',
    criticalErrors: [],
    audioUnlocked: false,
  };
}

export function currentNursingStep(session: NursingSession) {
  return nursingSteps.find((step) => step.id === session.currentStepId);
}
