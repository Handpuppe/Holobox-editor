import {
  CONCLUSION_TEXT_MAX_LENGTH,
  CONCLUSION_TEXT_MIN_LENGTH,
  type ClinicalConclusion,
  type Scenario,
  type ScoreEvent,
} from './types';
import { hasRequiredText, sanitizeMultiline } from './sanitize';

export const EMPTY_CONCLUSION: ClinicalConclusion = {
  primaryDifficulty: '',
  dailyLifeEffect: '',
  clientStrengths: '',
  firstObjective: '',
  nextStep: '',
  freeText: {
    dailyLifeEffect: '',
    firstObjective: '',
  },
};

export interface ConclusionValidation {
  valid: boolean;
  errors: Partial<Record<keyof ClinicalConclusion | 'dailyLifeText' | 'objectiveText', string>>;
}

export function sanitizeConclusion(conclusion: ClinicalConclusion): ClinicalConclusion {
  return {
    primaryDifficulty: conclusion.primaryDifficulty,
    dailyLifeEffect: conclusion.dailyLifeEffect,
    clientStrengths: conclusion.clientStrengths,
    firstObjective: conclusion.firstObjective,
    nextStep: conclusion.nextStep,
    freeText: {
      dailyLifeEffect: sanitizeMultiline(
        conclusion.freeText.dailyLifeEffect,
        CONCLUSION_TEXT_MAX_LENGTH,
      ),
      firstObjective: sanitizeMultiline(
        conclusion.freeText.firstObjective,
        CONCLUSION_TEXT_MAX_LENGTH,
      ),
    },
  };
}

export function validateConclusion(
  conclusion: ClinicalConclusion,
  scenario: Scenario,
): ConclusionValidation {
  const errors: ConclusionValidation['errors'] = {};
  const required: Array<keyof Omit<ClinicalConclusion, 'freeText'>> = [
    'primaryDifficulty',
    'dailyLifeEffect',
    'clientStrengths',
    'firstObjective',
    'nextStep',
  ];
  for (const fieldId of required) {
    const field = scenario.conclusionFields.find((item) => item.id === fieldId);
    const value = conclusion[fieldId];
    const known = field?.choices.some((choice) => choice.id === value) ?? false;
    if (!value || !known) {
      errors[fieldId] = 'Kies een van de opties.';
    }
  }
  if (!hasRequiredText(conclusion.freeText.dailyLifeEffect, CONCLUSION_TEXT_MIN_LENGTH)) {
    errors.dailyLifeText = 'Beschrijf kort het effect in het dagelijks leven.';
  }
  if (!hasRequiredText(conclusion.freeText.firstObjective, CONCLUSION_TEXT_MIN_LENGTH)) {
    errors.objectiveText = 'Beschrijf kort het eerste behandeldoel.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function conclusionScoreEvents(
  conclusion: ClinicalConclusion,
  scenario: Scenario,
  now = new Date(),
): ScoreEvent[] {
  const at = now.toISOString();
  return scenario.conclusionFields.map((field) => {
    const selected = field.choices.find((choice) => choice.id === conclusion[field.id]);
    if (!selected) {
      throw new Error(`Ongeldige conclusiekeuze voor ${field.id}.`);
    }
    return {
      id: `conclusion-${field.id}`,
      nodeId: `conclusion-${field.id}`,
      optionId: selected.id,
      quality: selected.quality,
      unsafe: selected.unsafe,
      competencyAwards: selected.competencyAwards,
      clientResponse: '',
      emotion: 'neutral',
      delayedFeedback: selected.delayedFeedback,
      educationalRationale: selected.educationalRationale,
      at,
    };
  });
}
