import type { MediaSlotConfig } from '../media/types';
import type { NursingOption, NursingScenario, NursingStep } from '../nursing/types';
import { isNursingMediaPath } from './nursingMedia';

export const ANSWER_VIDEO_QUALITIES = ['high', 'partial', 'inappropriate'] as const;

export type AnswerVideoQuality = (typeof ANSWER_VIDEO_QUALITIES)[number];

export const ANSWER_VIDEO_LABELS: Record<AnswerVideoQuality, string> = {
  high: 'Bij goed antwoord play video',
  partial: 'Bij deels goed antwoord play video',
  inappropriate: 'Bij verkeerd antwoord play video',
};

export const ANSWER_FOLDER_NAMES: Record<AnswerVideoQuality, string> = {
  high: 'Goed antwoord',
  partial: 'Deels goed antwoord',
  inappropriate: 'Verkeerd antwoord',
};

function isUnsafeFolderChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 32 || '<>:"/\\|?*'.includes(char);
}

export function scenarioMediaFolderName(title: string, id: string): string {
  const raw = title.trim() || id.trim() || 'scenario';
  let cleaned = '';
  for (const char of raw) {
    cleaned += isUnsafeFolderChar(char) ? ' ' : char;
  }
  cleaned = cleaned.replace(/\.\./g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'scenario';
}

export function answerUploadRelativePath(
  scenarioName: string,
  quality: AnswerVideoQuality,
  fileName: string,
): string | null {
  const normalized = fileName.replaceAll('\\', '/');
  if (normalized.includes('..') || normalized.toLowerCase().includes('logopedie')) {
    return null;
  }
  const base = normalized.split('/').pop()?.trim() ?? '';
  if (!base) {
    return null;
  }
  if (base.toLowerCase() === 'erik_basis.png') {
    return null;
  }
  const folder = scenarioMediaFolderName(scenarioName, '');
  const relative = `verpleegkunde/scenarios/${folder}/Antwoorden/${ANSWER_FOLDER_NAMES[quality]}/${base}`;
  return isNursingMediaPath(relative) ? relative : null;
}

export function optionForQuality(
  step: NursingStep,
  quality: AnswerVideoQuality,
): NursingOption | undefined {
  return step.options.find((option) => option.quality === quality);
}

export function optionPrimaryMediaPath(
  scenario: NursingScenario,
  option: NursingOption | undefined,
): string | null {
  if (!option?.mediaSlotId) {
    return null;
  }
  const slot = scenario.mediaSlots.find((item) => item.slotId === option.mediaSlotId);
  const path = slot?.primaryMedia;
  return path && path.trim() ? path.replaceAll('\\', '/') : null;
}

function answerSlotId(stepId: string, quality: AnswerVideoQuality): string {
  return `nursing-answer-${stepId}-${quality}`;
}

function slotUsedOutsideOption(
  scenario: NursingScenario,
  slotId: string,
  optionId: string,
): boolean {
  for (const step of scenario.steps) {
    if (step.mediaSlotId === slotId) {
      return true;
    }
    for (const option of step.options) {
      if (option.id !== optionId && option.mediaSlotId === slotId) {
        return true;
      }
    }
  }
  return false;
}

function makeAnswerSlot(
  template: MediaSlotConfig,
  slotId: string,
  relativePath: string,
  label: string,
): MediaSlotConfig {
  return {
    ...template,
    slotId,
    module: 'verpleegkunde',
    matchedKeywords: [],
    primaryMedia: relativePath,
    idleMedia: null,
    posterImage: null,
    alternativeMatches: [],
    studentLabel: label,
    transcript: '',
    captions: '',
  };
}

function replaceStepOption(
  scenario: NursingScenario,
  stepId: string,
  quality: AnswerVideoQuality,
  nextOption: NursingOption,
  mediaSlots: MediaSlotConfig[] = scenario.mediaSlots,
): NursingScenario {
  return {
    ...scenario,
    mediaSlots,
    steps: scenario.steps.map((step) => {
      if (step.id !== stepId) {
        return step;
      }
      const options = step.options.map((option) =>
        option.quality === quality ? nextOption : option,
      ) as NursingStep['options'];
      return { ...step, options };
    }),
  };
}

export function setAnswerVideoMode(
  scenario: NursingScenario,
  stepId: string,
  quality: AnswerVideoQuality,
  mode: 'video' | 'placeholder',
): NursingScenario {
  const step = scenario.steps.find((item) => item.id === stepId);
  const option = step ? optionForQuality(step, quality) : undefined;
  if (!step || !option) {
    return scenario;
  }
  return replaceStepOption(scenario, stepId, quality, {
    ...option,
    answerVideoMode: mode,
  });
}

export function saveAnswerPlaceholder(
  scenario: NursingScenario,
  stepId: string,
  quality: AnswerVideoQuality,
  text: string,
): NursingScenario {
  const step = scenario.steps.find((item) => item.id === stepId);
  const option = step ? optionForQuality(step, quality) : undefined;
  if (!step || !option) {
    return scenario;
  }
  return replaceStepOption(scenario, stepId, quality, {
    ...option,
    answerVideoMode: 'placeholder',
    videoPlaceholder: text,
  });
}

export function assignAnswerVideo(
  scenario: NursingScenario,
  stepId: string,
  quality: AnswerVideoQuality,
  relativePath: string | null,
): NursingScenario {
  const step = scenario.steps.find((item) => item.id === stepId);
  const option = step ? optionForQuality(step, quality) : undefined;
  if (!step || !option) {
    return scenario;
  }
  if (relativePath && !isNursingMediaPath(relativePath)) {
    return scenario;
  }
  if (!relativePath) {
    return replaceStepOption(scenario, stepId, quality, {
      ...option,
      mediaSlotId: undefined,
      answerVideoMode: 'video',
    });
  }
  const currentSlotId = option.mediaSlotId;
  const shared = !currentSlotId || slotUsedOutsideOption(scenario, currentSlotId, option.id);
  if (currentSlotId && !shared) {
    return replaceStepOption(
      scenario,
      stepId,
      quality,
      { ...option, mediaSlotId: currentSlotId, answerVideoMode: 'video' },
      scenario.mediaSlots.map((slot) =>
        slot.slotId === currentSlotId ? { ...slot, primaryMedia: relativePath } : slot,
      ),
    );
  }
  const slotId = answerSlotId(step.id, quality);
  const template =
    scenario.mediaSlots.find((slot) => slot.slotId === currentSlotId) ?? scenario.mediaSlots[0];
  if (!template) {
    return scenario;
  }
  const nextSlot = makeAnswerSlot(template, slotId, relativePath, ANSWER_VIDEO_LABELS[quality]);
  const existing = scenario.mediaSlots.some((slot) => slot.slotId === slotId);
  const mediaSlots = existing
    ? scenario.mediaSlots.map((slot) => (slot.slotId === slotId ? nextSlot : slot))
    : [...scenario.mediaSlots, nextSlot];
  return replaceStepOption(
    scenario,
    stepId,
    quality,
    { ...option, mediaSlotId: slotId, answerVideoMode: 'video' },
    mediaSlots,
  );
}
