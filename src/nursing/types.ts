import type { AwardValue, OptionQuality } from '../domain/types';
import type { PatientMediaState } from '../media/types';

export const NURSING_SCENARIO_VERSION = '1.0.1';
export const NURSING_RUBRIC_VERSION = '1.0.0';

export const NURSING_COMPETENCIES = [
  'abcdeSystematics',
  'observation',
  'patientSafety',
  'sbarCommunication',
  'professionalBehaviour',
] as const;

export type NursingCompetency = (typeof NURSING_COMPETENCIES)[number];

export const NURSING_WEIGHTS: Record<NursingCompetency, number> = {
  abcdeSystematics: 0.3,
  observation: 0.2,
  patientSafety: 0.2,
  sbarCommunication: 0.2,
  professionalBehaviour: 0.1,
};

export interface NursingOption {
  id: string;
  text: string;
  quality: OptionQuality;
  unsafe: boolean;
  criticalError?: string;
  competencyAwards: Partial<Record<NursingCompetency, AwardValue>>;
  delayedFeedback: string;
  educationalRationale: string;
  mediaSlotId?: string;
  nextStepId: string;
}

export interface NursingStep {
  id: string;
  phaseLabel: string;
  question: string;
  help: string;
  mediaSlotId: string;
  scoredCompetencies: NursingCompetency[];
  kind: 'choice' | 'sbar-text';
  sbarField?: keyof NursingSbar;
  options: [NursingOption, NursingOption, NursingOption];
}

export interface NursingSbar {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface NursingScoreEvent {
  id: string;
  stepId: string;
  optionId: string;
  quality: OptionQuality;
  unsafe: boolean;
  competencyAwards: Partial<Record<NursingCompetency, AwardValue>>;
  delayedFeedback: string;
  educationalRationale: string;
  at: string;
}

export interface NursingSession {
  id: string;
  schemaVersion: number;
  appVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  rubricVersion: string;
  startedAt: string;
  updatedAt: string;
  lastResumedAt: string;
  pauseStartedAt: string | null;
  accumulatedActiveMs: number;
  status: 'in_progress' | 'paused' | 'completed';
  currentStepId: string;
  history: NursingScoreEvent[];
  sbar: NursingSbar;
  mediaState: PatientMediaState;
  criticalErrors: string[];
  audioUnlocked: boolean;
}
