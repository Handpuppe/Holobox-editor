import type { ConclusionField, DecisionNode, Scenario } from '../domain/types';
import type { MediaSlotConfig } from '../media/types';
import {
  NURSING_RUBRIC_VERSION,
  NURSING_SCENARIO_VERSION,
  type NursingOption,
  type NursingScenario,
  type NursingStep,
} from '../nursing/types';
import { cloneScenario } from './cloneScenario';

export const EMPTY_NURSING_STEP_ID = 'n-1';

function blankLogopedieNode(node: DecisionNode): DecisionNode {
  return {
    ...node,
    phaseLabel: '',
    prompt: { text: '', context: '' },
    options: [
      {
        ...node.options[0],
        text: '',
        delayedFeedback: '',
        educationalRationale: '',
        clientResponse: { text: '', context: '' },
      },
      {
        ...node.options[1],
        text: '',
        delayedFeedback: '',
        educationalRationale: '',
        clientResponse: { text: '', context: '' },
      },
      {
        ...node.options[2],
        text: '',
        delayedFeedback: '',
        educationalRationale: '',
        clientResponse: { text: '', context: '' },
      },
    ],
  };
}

function blankConclusionField(field: ConclusionField): ConclusionField {
  return {
    ...field,
    label: '',
    help: '',
    textLabel: '',
    choices: [
      {
        ...field.choices[0],
        text: '',
        delayedFeedback: '',
        educationalRationale: '',
      },
      {
        ...field.choices[1],
        text: '',
        delayedFeedback: '',
        educationalRationale: '',
      },
      {
        ...field.choices[2],
        text: '',
        delayedFeedback: '',
        educationalRationale: '',
      },
    ],
  };
}

export function emptyLogopedieScenario(): Scenario {
  const draft = cloneScenario();
  return {
    ...draft,
    title: '',
    estimatedDuration: '',
    client: {
      ...draft.client,
      name: '',
      condition: '',
      communicationProfile: '',
      comprehension: '',
      speech: '',
      emotionalState: '',
      energy: '',
      homeSituation: '',
      previousOccupation: '',
      primaryGoal: '',
      personalNeed: '',
    },
    briefing: {
      medicalBackground: '',
      consultationContext: '',
      studentRole: '',
    },
    learningObjectives: draft.learningObjectives.map((item) => ({ ...item, text: '' })),
    nodes: draft.nodes.map(blankLogopedieNode),
    conclusionFields: draft.conclusionFields.map(blankConclusionField),
  };
}

function emptyNursingOption(stepId: string, quality: NursingOption['quality']): NursingOption {
  return {
    id: `${stepId}-${quality}`,
    text: '',
    quality,
    unsafe: quality === 'inappropriate',
    competencyAwards: { observation: quality === 'high' ? 1 : quality === 'partial' ? 0.5 : 0 },
    delayedFeedback: '',
    educationalRationale: '',
    nextStepId: 'completed',
  };
}

function emptyNursingMediaSlot(stepId: string): MediaSlotConfig {
  return {
    slotId: `nursing-step-${stepId}`,
    scenarioId: 'editor-leeg',
    module: 'verpleegkunde',
    matchedKeywords: [],
    primaryMedia: null,
    idleMedia: null,
    posterImage: null,
    transcript: '',
    captions: '',
    alternativeMatches: [],
    loopBehaviour: 'none',
    audioEnabled: false,
    studentLabel: '',
  };
}

export function emptyNursingScenario(): NursingScenario {
  const stepId = EMPTY_NURSING_STEP_ID;
  const step: NursingStep = {
    id: stepId,
    stepName: '',
    phaseLabel: '',
    question: '',
    help: '',
    mediaSlotId: `nursing-step-${stepId}`,
    scoredCompetencies: ['observation'],
    kind: 'choice',
    options: [
      emptyNursingOption(stepId, 'high'),
      emptyNursingOption(stepId, 'partial'),
      emptyNursingOption(stepId, 'inappropriate'),
    ],
  };
  return {
    meta: {
      id: 'editor-leeg',
      version: NURSING_SCENARIO_VERSION,
      rubricVersion: NURSING_RUBRIC_VERSION,
      title: '',
      estimatedDuration: '',
      startStepId: stepId,
      educationType: '',
    },
    patient: {
      name: '',
      age: 0,
      fictional: true,
      heightCm: 170,
      setting: '',
      background: '',
      studentRole: '',
    },
    learningObjectives: [],
    steps: [step],
    mediaSlots: [emptyNursingMediaSlot(stepId)],
  };
}
