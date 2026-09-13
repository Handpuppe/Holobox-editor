import type { TeacherSettings } from '../media/types';
import type { NursingSession } from '../nursing/types';

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.2.0';

export const STORAGE_SCHEMA_VERSION = 2;
export const SCENARIO_ID = 'aphasia-intake-erik-de-vries';
export const SCENARIO_VERSION = '1.0.0';
export const RUBRIC_VERSION = '1.0.0';
export const CONCLUSION_NODE_ID = 'conclusion';
export const NOTES_MAX_LENGTH = 600;
export const CONCLUSION_TEXT_MAX_LENGTH = 280;
export const CONCLUSION_TEXT_MIN_LENGTH = 8;

export const COMPETENCIES = [
  'adaptedCommunication',
  'historyTakingAndGoals',
  'observation',
  'clinicalReasoning',
  'empathyAndProfessionalBehaviour',
] as const;

export type Competency = (typeof COMPETENCIES)[number];

export const COMPETENCY_WEIGHTS: Record<Competency, number> = {
  adaptedCommunication: 0.3,
  historyTakingAndGoals: 0.25,
  observation: 0.15,
  clinicalReasoning: 0.15,
  empathyAndProfessionalBehaviour: 0.15,
};

export const CLIENT_EMOTIONS = [
  'neutral',
  'listening',
  'speaking',
  'thinking',
  'confused',
  'frustrated',
  'fatigued',
  'reassured',
] as const;

export type ClientEmotion = (typeof CLIENT_EMOTIONS)[number];

export type OptionQuality = 'high' | 'partial' | 'inappropriate';

export type AwardValue = 0 | 0.5 | 1;

export type ScenarioVersion = string;

export interface LearningObjective {
  id: string;
  text: string;
}

export interface ClientProfile {
  name: string;
  age: number;
  fictional: true;
  condition: string;
  communicationProfile: string;
  comprehension: string;
  speech: string;
  emotionalState: string;
  energy: string;
  homeSituation: string;
  previousOccupation: string;
  primaryGoal: string;
  personalNeed: string;
}

export interface ClientResponse {
  text: string;
  context: string;
}

export interface SessionFlags {
  gaveResponseTime: boolean;
  finishedSentences: boolean;
  usedLongQuestions: boolean;
  exploredParticipation: boolean;
  acknowledgedFrustration: boolean;
  usedAssumptions: boolean;
  addressedClientDirectly: boolean;
  offeredCommunicationSupport: boolean;
}

export interface StudentOption {
  id: string;
  text: string;
  nextNodeId: string;
  quality: OptionQuality;
  unsafe: boolean;
  competencyAwards: Partial<Record<Competency, AwardValue>>;
  clientResponse: ClientResponse;
  emotion: ClientEmotion;
  fatigueDelta: number;
  delayedFeedback: string;
  educationalRationale: string;
  flags?: Partial<SessionFlags>;
}

export interface DecisionNode {
  id: string;
  phaseId: string;
  phaseLabel: string;
  scoredCompetencies: Competency[];
  prompt: ClientResponse;
  promptEmotion: ClientEmotion;
  options: [StudentOption, StudentOption, StudentOption];
}

export type ConversationPhase = DecisionNode['phaseId'];

export interface ConclusionChoice {
  id: string;
  text: string;
  quality: OptionQuality;
  unsafe: boolean;
  competencyAwards: Partial<Record<Competency, AwardValue>>;
  delayedFeedback: string;
  educationalRationale: string;
}

export interface ConclusionField {
  id: keyof Omit<ClinicalConclusion, 'freeText'>;
  label: string;
  help: string;
  scoredCompetencies: Competency[];
  choices: [ConclusionChoice, ConclusionChoice, ConclusionChoice];
  textLabel: string;
  textRequired: boolean;
}

export interface ClinicalConclusion {
  primaryDifficulty: string;
  dailyLifeEffect: string;
  clientStrengths: string;
  firstObjective: string;
  nextStep: string;
  freeText: {
    dailyLifeEffect: string;
    firstObjective: string;
  };
}

export interface StudentNotes {
  presentingConcern: string;
  languageAndCommunication: string;
  dailyParticipation: string;
  psychosocialFactors: string;
  observations: string;
  possibleNextSteps: string;
}

export interface ScoreEvent {
  id: string;
  nodeId: string;
  optionId: string;
  quality: OptionQuality;
  unsafe: boolean;
  competencyAwards: Partial<Record<Competency, AwardValue>>;
  clientResponse: string;
  emotion: ClientEmotion;
  delayedFeedback: string;
  educationalRationale: string;
  at: string;
}

export interface CompetencyScore {
  competency: string;
  earned: number;
  max: number;
  percent: number;
  weight: number;
}

export interface ScoreSummary {
  total: number;
  competencies: Record<string, CompetencyScore>;
}

export interface Scenario {
  id: string;
  version: ScenarioVersion;
  rubricVersion: string;
  title: string;
  estimatedDuration: string;
  client: ClientProfile;
  briefing: {
    medicalBackground: string;
    consultationContext: string;
    studentRole: string;
  };
  learningObjectives: LearningObjective[];
  startNodeId: string;
  nodes: DecisionNode[];
  conclusionFields: ConclusionField[];
}

export interface SimulationSession {
  id: string;
  schemaVersion: number;
  appVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  rubricVersion: string;
  startedAt: string;
  updatedAt: string;
  pauseStartedAt: string | null;
  lastResumedAt: string;
  accumulatedActiveMs: number;
  currentNodeId: string;
  queuedNodeId: string | null;
  status: 'in_progress' | 'paused' | 'awaiting_conclusion' | 'completed' | 'abandoned';
  transitioning: boolean;
  history: ScoreEvent[];
  notes: StudentNotes;
  conclusion: ClinicalConclusion | null;
  flags: SessionFlags;
  clientEmotion: ClientEmotion;
  fatigueLevel: number;
  lastClientResponse: ClientResponse;
  lastSpokenOptionId: string | null;
}

export interface ResultFeedback {
  strengths: string[];
  improvements: string[];
  timeline: Array<{ nodeId: string; phaseLabel: string; choice: string; quality: OptionQuality }>;
  keyDecisions: string[];
  observationVersusAssumption: string;
  strongerApproach: string;
}

export interface SavedResult {
  id: string;
  schemaVersion: number;
  savedAt: string;
  appVersion: string;
  module: 'logopedie' | 'verpleegkunde';
  scenarioId: string;
  scenarioVersion: string;
  rubricVersion: string;
  durationMs: number;
  score: ScoreSummary;
  history: ScoreEvent[];
  notes: StudentNotes;
  conclusion: ClinicalConclusion | null;
  feedback: ResultFeedback;
  flags: SessionFlags;
  criticalErrors: string[];
  completedParts: string[];
}

export interface AudioPreferences {
  muted: boolean;
  volume: number;
}

export interface StorageSchema {
  schemaVersion: number;
  unfinishedLogopedie: SimulationSession | null;
  unfinishedNursing: NursingSession | null;
  results: SavedResult[];
  teacher: TeacherSettings;
  audio: AudioPreferences;
}

export type StorageReadResult =
  | { ok: true; data: StorageSchema; available: boolean }
  | { ok: false; reason: string; data: StorageSchema; available: boolean };
