import type { OptionQuality } from '../domain/types';
import type {
  NursingCompetency,
  NursingOption,
  NursingScenario,
  NursingStep,
} from '../nursing/types';
import { questionFolderRelative } from './questionFolder';

function nextCustomStepId(steps: NursingStep[]): string {
  let n = 1;
  const ids = new Set(steps.map((step) => step.id));
  while (ids.has(`n-extra-${String(n)}`)) {
    n += 1;
  }
  return `n-extra-${String(n)}`;
}

function nextQuestionName(existing: NursingStep[]): string {
  const used = new Set(existing.map((step) => (step.stepName ?? '').trim()));
  let n = existing.length + 1;
  while (used.has(`Vraag.${String(n)}`)) {
    n += 1;
  }
  return `Vraag.${String(n)}`;
}

function emptyOption(
  stepId: string,
  quality: OptionQuality,
  nextStepId: string,
  scored: NursingCompetency[],
): NursingOption {
  const awards: NursingOption['competencyAwards'] = {};
  for (const competency of scored) {
    awards[competency] = quality === 'high' ? 1 : quality === 'partial' ? 0.5 : 0;
  }
  return {
    id: `${stepId}-${quality}`,
    text: '',
    quality,
    unsafe: quality === 'inappropriate',
    competencyAwards: awards,
    delayedFeedback: '',
    educationalRationale: '',
    nextStepId,
  };
}

export function createNursingStep(existing: NursingStep[]): NursingStep {
  const id = nextCustomStepId(existing);
  const scored: NursingCompetency[] = ['observation'];
  return {
    id,
    stepName: nextQuestionName(existing),
    phaseLabel: '',
    question: '',
    help: '',
    mediaSlotId: `nursing-step-${id}`,
    scoredCompetencies: scored,
    kind: 'choice',
    options: [
      emptyOption(id, 'high', 'completed', scored),
      emptyOption(id, 'partial', 'completed', scored),
      emptyOption(id, 'inappropriate', 'completed', scored),
    ],
  };
}

export function appendNursingStep(draft: NursingScenario): {
  scenario: NursingScenario;
  step: NursingStep;
} {
  const step = createNursingStep(draft.steps);
  step.questionFolder = questionFolderRelative(
    'verpleegkunde',
    draft.meta.title,
    step.stepName ?? '',
  );
  const template = draft.mediaSlots[0];
  const extraSlot = template
    ? {
        ...template,
        slotId: step.mediaSlotId,
        module: 'verpleegkunde' as const,
        matchedKeywords: [],
        primaryMedia: null,
        idleMedia: null,
        posterImage: null,
        alternativeMatches: [],
        studentLabel: step.phaseLabel,
        transcript: step.question,
        captions: '',
      }
    : null;
  return {
    step,
    scenario: {
      ...draft,
      steps: [...draft.steps, step],
      mediaSlots: extraSlot ? [...draft.mediaSlots, extraSlot] : draft.mediaSlots,
    },
  };
}

/** Haalt één vraag weg. Lijnen naar die vraag verdwijnen. Andere lijnen blijven. */
export function removeNursingQuestion(scenario: NursingScenario, stepId: string): NursingScenario {
  if (scenario.steps.length <= 1 || !scenario.steps.some((step) => step.id === stepId)) {
    return scenario;
  }
  const remaining = scenario.steps.filter((step) => step.id !== stepId);
  const fallbackId = remaining[0]?.id;
  if (!fallbackId) {
    return scenario;
  }
  const steps = remaining.map((step) => ({
    ...step,
    options: step.options.map((option) =>
      option.nextStepId === stepId ? { ...option, nextStepId: 'completed' } : option,
    ) as NursingStep['options'],
  }));
  const startStepId = scenario.meta.startStepId === stepId ? fallbackId : scenario.meta.startStepId;
  return {
    ...scenario,
    meta: { ...scenario.meta, startStepId },
    steps,
  };
}
