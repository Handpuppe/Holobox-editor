import { clampScore } from '../domain/scoring';
import type { ScoreEvent, ScoreSummary } from '../domain/types';
import { nursingSteps } from './scenario';
import {
  NURSING_COMPETENCIES,
  NURSING_WEIGHTS,
  type NursingCompetency,
  type NursingScoreEvent,
} from './types';

export function nursingWeightTotal(): number {
  return NURSING_COMPETENCIES.reduce((sum, item) => sum + NURSING_WEIGHTS[item], 0);
}

function emptyAwards(): Record<NursingCompetency, number> {
  return {
    abcdeSystematics: 0,
    observation: 0,
    patientSafety: 0,
    sbarCommunication: 0,
    professionalBehaviour: 0,
  };
}

export function nursingMaximum(): Record<NursingCompetency, number> {
  const max = emptyAwards();
  for (const step of nursingSteps) {
    for (const competency of step.scoredCompetencies) {
      max[competency] += 1;
    }
  }
  return max;
}

export function calculateNursingScores(events: NursingScoreEvent[]): ScoreSummary {
  const max = nursingMaximum();
  const earned = emptyAwards();
  for (const event of events) {
    for (const competency of NURSING_COMPETENCIES) {
      const value = event.competencyAwards[competency];
      if (typeof value === 'number') {
        earned[competency] += value;
      }
    }
  }
  const competencies = {} as ScoreSummary['competencies'];
  let weighted = 0;
  for (const competency of NURSING_COMPETENCIES) {
    const percent = max[competency] === 0 ? 0 : (earned[competency] / max[competency]) * 100;
    const bounded = clampScore(percent);
    competencies[competency] = {
      competency,
      earned: earned[competency],
      max: max[competency],
      percent: bounded,
      weight: NURSING_WEIGHTS[competency],
    };
    weighted += bounded * NURSING_WEIGHTS[competency];
  }
  return { total: Math.round(clampScore(weighted)), competencies };
}

export function toGenericEvents(events: NursingScoreEvent[]): ScoreEvent[] {
  return events.map((event) => ({
    id: event.id,
    nodeId: event.stepId,
    optionId: event.optionId,
    quality: event.quality,
    unsafe: event.unsafe,
    competencyAwards: event.competencyAwards,
    clientResponse: '',
    emotion: 'neutral',
    delayedFeedback: event.delayedFeedback,
    educationalRationale: event.educationalRationale,
    at: event.at,
  }));
}

export function optionIdsByQuality(quality: 'high' | 'partial' | 'inappropriate'): string[] {
  return nursingSteps.map((step) => {
    const option = step.options.find((item) => item.quality === quality);
    if (!option) {
      throw new Error(`Geen ${quality}-optie in ${step.id}`);
    }
    return option.id;
  });
}
