import type { AwardValue } from '../domain/types';
import type { MediaSlotConfig } from '../media/types';
import {
  NURSING_COMPETENCIES,
  NURSING_WEIGHTS,
  type NursingCompetency,
  type NursingOption,
  type NursingScenario,
  type NursingStep,
} from './types';

const QUALITIES = ['high', 'partial', 'inappropriate'] as const;
const AWARD_VALUES: AwardValue[] = [0, 0.5, 1];
const SBAR_FIELDS = ['situation', 'background', 'assessment', 'recommendation'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCompetency(value: unknown): value is NursingCompetency {
  return typeof value === 'string' && (NURSING_COMPETENCIES as readonly string[]).includes(value);
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function nursingWeightTotalFromFormula(): number {
  return NURSING_COMPETENCIES.reduce((sum, item) => sum + NURSING_WEIGHTS[item], 0);
}

export function validateNursingScenario(scenario: NursingScenario): string[] {
  const issues: string[] = [];
  if (Math.abs(nursingWeightTotalFromFormula() - 1) > 1e-10) {
    issues.push('Competentiegewichten tellen niet op tot 100%.');
  }
  if (!isNonEmptyString(scenario.meta.id) || !isNonEmptyString(scenario.meta.startStepId)) {
    issues.push('Scenario mist identificatie of startstap.');
  }
  if (!isNonEmptyString(scenario.patient.name)) {
    issues.push('Patiënt mist een naam.');
  }
  if (!Array.isArray(scenario.learningObjectives)) {
    issues.push('Leerdoelen ontbreken.');
  }
  if (!Array.isArray(scenario.mediaSlots) || scenario.mediaSlots.length === 0) {
    issues.push('Mediaslots ontbreken.');
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    issues.push('Scenario mist stappen.');
    return issues;
  }
  const stepIds = scenario.steps.map((step) => step.id);
  if (!unique(stepIds)) {
    issues.push('Stap-id’s zijn niet uniek.');
  }
  if (!stepIds.includes(scenario.meta.startStepId)) {
    issues.push(`Startstap ${scenario.meta.startStepId} bestaat niet.`);
  }
  const slotIds = new Set(scenario.mediaSlots.map((slot) => slot.slotId));
  for (const step of scenario.steps) {
    issues.push(...validateStep(step, new Set(stepIds), slotIds));
  }
  return issues;
}

function validateStep(step: NursingStep, stepIds: Set<string>, slotIds: Set<string>): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(step.id)) {
    issues.push('Een stap mist een id.');
    return issues;
  }
  if (!isNonEmptyString(step.question)) {
    issues.push(`Stap ${step.id} mist een vraag.`);
  }
  if (!isNonEmptyString(step.phaseLabel)) {
    issues.push(`Stap ${step.id} mist een faselabel.`);
  }
  if (!slotIds.has(step.mediaSlotId)) {
    issues.push(`Stap ${step.id} verwijst naar onbekend mediaslot ${step.mediaSlotId}.`);
  }
  if (step.kind !== 'choice' && step.kind !== 'sbar-text') {
    issues.push(`Stap ${step.id} heeft een onbekend type.`);
  }
  if (step.sbarField && !SBAR_FIELDS.includes(step.sbarField)) {
    issues.push(`Stap ${step.id} heeft een onbekend SBAR-veld.`);
  }
  if (!Array.isArray(step.scoredCompetencies) || step.scoredCompetencies.length === 0) {
    issues.push(`Stap ${step.id} mist gescoorde competenties.`);
  } else {
    for (const competency of step.scoredCompetencies) {
      if (!isCompetency(competency)) {
        issues.push(`Stap ${step.id} heeft onbekende competentie ${String(competency)}.`);
      }
    }
  }
  if (!Array.isArray(step.options) || step.options.length !== 3) {
    issues.push(`Stap ${step.id} moet precies drie antwoorden hebben.`);
    return issues;
  }
  const optionIds = step.options.map((option) => option.id);
  if (!unique(optionIds)) {
    issues.push(`Antwoord-id’s in stap ${step.id} zijn niet uniek.`);
  }
  for (const quality of QUALITIES) {
    if (!step.options.some((option) => option.quality === quality)) {
      issues.push(`Stap ${step.id} mist een ${quality}-antwoord.`);
    }
  }
  for (const option of step.options) {
    issues.push(...validateOption(step, option, stepIds, slotIds));
  }
  return issues;
}

function validateOption(
  step: NursingStep,
  option: NursingOption,
  stepIds: Set<string>,
  slotIds: Set<string>,
): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(option.id) || !isNonEmptyString(option.text)) {
    issues.push(`Stap ${step.id} heeft een antwoord zonder id of tekst.`);
  }
  if (!QUALITIES.includes(option.quality)) {
    issues.push(`Antwoord ${option.id} heeft een ongeldige kwaliteit.`);
  }
  if (typeof option.unsafe !== 'boolean') {
    issues.push(`Antwoord ${option.id} mist de veiligheidsvlag.`);
  }
  if (!isNonEmptyString(option.delayedFeedback) || !isNonEmptyString(option.educationalRationale)) {
    issues.push(`Antwoord ${option.id} mist feedback of toelichting.`);
  }
  if (option.nextStepId !== 'completed' && !stepIds.has(option.nextStepId)) {
    issues.push(`Antwoord ${option.id} verwijst naar onbekende stap ${option.nextStepId}.`);
  }
  if (option.mediaSlotId && !slotIds.has(option.mediaSlotId)) {
    issues.push(`Antwoord ${option.id} verwijst naar onbekend mediaslot ${option.mediaSlotId}.`);
  }
  if (!isRecord(option.competencyAwards)) {
    issues.push(`Antwoord ${option.id} mist competentiescores.`);
    return issues;
  }
  for (const competency of step.scoredCompetencies) {
    if (option.competencyAwards[competency] === undefined) {
      issues.push(`Antwoord ${option.id} mist een score voor ${competency}.`);
    }
  }
  for (const key of Object.keys(option.competencyAwards)) {
    if (!step.scoredCompetencies.includes(key as NursingCompetency)) {
      issues.push(`Antwoord ${option.id} scoort onverwachte competentie ${key}.`);
    }
    const value = option.competencyAwards[key as NursingCompetency];
    if (value !== undefined && !AWARD_VALUES.includes(value)) {
      issues.push(`Antwoord ${option.id} heeft een ongeldige score voor ${key}.`);
    }
  }
  return issues;
}

export function isMediaSlotConfig(value: unknown): value is MediaSlotConfig {
  if (!isRecord(value) || !isNonEmptyString(value.slotId)) {
    return false;
  }
  if (value.module !== 'verpleegkunde') {
    return false;
  }
  if (value.primaryMedia != null && typeof value.primaryMedia !== 'string') {
    return false;
  }
  if (
    value.primaryMedia &&
    !value.primaryMedia.replaceAll('\\', '/').startsWith('verpleegkunde/')
  ) {
    return false;
  }
  return typeof value.transcript === 'string' && Array.isArray(value.alternativeMatches);
}
