import { describe, expect, it } from 'vitest';
import { STORAGE_SCHEMA_VERSION, type SavedResult } from '../domain/types';
import { parseStoragePayload, StorageService, STORAGE_KEY } from './storageService';

function sampleResult(): SavedResult {
  return {
    id: 'result-1',
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: '2026-09-12T12:00:00.000Z',
    appVersion: '0.2.0',
    module: 'logopedie',
    scenarioId: 'aphasia-intake-erik-de-vries',
    scenarioVersion: '1.0.0',
    rubricVersion: '1.0.0',
    durationMs: 600000,
    score: {
      total: 80,
      competencies: {
        adaptedCommunication: {
          competency: 'adaptedCommunication',
          earned: 4,
          max: 5,
          percent: 80,
          weight: 0.3,
        },
        historyTakingAndGoals: {
          competency: 'historyTakingAndGoals',
          earned: 3,
          max: 4,
          percent: 75,
          weight: 0.25,
        },
        observation: { competency: 'observation', earned: 4, max: 5, percent: 80, weight: 0.15 },
        clinicalReasoning: {
          competency: 'clinicalReasoning',
          earned: 6,
          max: 7,
          percent: 85.7,
          weight: 0.15,
        },
        empathyAndProfessionalBehaviour: {
          competency: 'empathyAndProfessionalBehaviour',
          earned: 4,
          max: 5,
          percent: 80,
          weight: 0.15,
        },
      },
    },
    history: [],
    notes: {
      presentingConcern: 'woorden',
      languageAndCommunication: '',
      dailyParticipation: '',
      psychosocialFactors: '',
      observations: '',
      possibleNextSteps: '',
    },
    conclusion: {
      primaryDifficulty: 'pd-high',
      dailyLifeEffect: 'dl-high',
      clientStrengths: 'cs-high',
      firstObjective: 'fo-high',
      nextStep: 'ns-high',
      freeText: { dailyLifeEffect: 'thuis lastig', firstObjective: 'voorlezen' },
    },
    feedback: {
      strengths: ['a', 'b', 'c'],
      improvements: ['d'],
      timeline: [],
      keyDecisions: [],
      observationVersusAssumption: 'ok',
      strongerApproach: 'kort vragen',
    },
    flags: {
      gaveResponseTime: true,
      finishedSentences: false,
      usedLongQuestions: false,
      exploredParticipation: true,
      acknowledgedFrustration: true,
      usedAssumptions: false,
      addressedClientDirectly: true,
      offeredCommunicationSupport: true,
    },
    criticalErrors: [],
    completedParts: ['intake'],
  };
}

describe('storage service', () => {
  it('serialises and reads a valid store', () => {
    const service = new StorageService(window.localStorage);
    const result = sampleResult();
    expect(service.saveResult(result)).toBe(true);
    const read = service.read();
    expect(read.ok).toBe(true);
    expect(read.data.results[0]?.id).toBe('result-1');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('result-1');
  });

  it('rejects corrupted JSON without throwing', () => {
    const parsed = parseStoragePayload('{not json');
    expect(parsed.ok).toBe(false);
    expect(parsed.data.results).toEqual([]);
  });

  it('migrates schema version 1 logopedie results', () => {
    const parsed = parseStoragePayload(
      JSON.stringify({
        schemaVersion: 1,
        unfinishedSession: null,
        results: [sampleResult()],
      }),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.data.schemaVersion).toBe(2);
    expect(parsed.data.results[0]?.module).toBe('logopedie');
  });

  it('rejects an unsupported schema version', () => {
    const parsed = parseStoragePayload(
      JSON.stringify({ schemaVersion: 99, unfinishedSession: null, results: [] }),
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('unsupported-schema');
  });

  it('recovers from a corrupted unfinished session', () => {
    const parsed = parseStoragePayload(
      JSON.stringify({ schemaVersion: 1, unfinishedSession: 'nope', results: [sampleResult()] }),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.data.unfinishedLogopedie).toBeNull();
    expect(parsed.data.results).toHaveLength(1);
  });

  it('stays usable when storage is unavailable', () => {
    const service = new StorageService(null);
    expect(service.available).toBe(false);
    expect(service.saveResult(sampleResult())).toBe(false);
    expect(service.read().reason).toBe('unavailable');
  });
});
