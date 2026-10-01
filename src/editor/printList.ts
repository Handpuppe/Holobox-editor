import type { NursingScenario } from '../nursing/types';
import {
  ANSWER_FOLDER_NAMES,
  ANSWER_VIDEO_QUALITIES,
  optionForQuality,
  optionPrimaryMediaPath,
} from './nursingAnswerMedia';

export interface PrintListItem {
  place: string;
  text: string;
}

export interface PrintListStep {
  stepName: string;
  items: PrintListItem[];
}

export interface PrintList {
  title: string;
  steps: PrintListStep[];
}

const STEP_PLACE = 'Startvideo van de vraag';

function isLinkedVideo(path: string | null | undefined): boolean {
  if (!path?.trim()) {
    return false;
  }
  return /\.(mp4|webm|mov|m4v)$/i.test(path.trim());
}

function stepVideoPath(scenario: NursingScenario, slotId: string): string | null {
  const slot = scenario.mediaSlots.find((item) => item.slotId === slotId);
  const path = slot?.primaryMedia?.trim();
  return path ? path : null;
}

export function nursingPrintList(scenario: NursingScenario): PrintList {
  const steps: PrintListStep[] = [];
  scenario.steps.forEach((step, index) => {
    const items: PrintListItem[] = [];
    if (step.stepVideoMode === 'placeholder' && !isLinkedVideo(stepVideoPath(scenario, step.mediaSlotId))) {
      items.push({
        place: STEP_PLACE,
        text: (step.stepVideoPlaceholder ?? '').trim(),
      });
    }
    for (const quality of ANSWER_VIDEO_QUALITIES) {
      const option = optionForQuality(step, quality);
      if (!option || option.answerVideoMode !== 'placeholder') {
        continue;
      }
      if (isLinkedVideo(optionPrimaryMediaPath(scenario, option))) {
        continue;
      }
      items.push({
        place: ANSWER_FOLDER_NAMES[quality],
        text: (option.videoPlaceholder ?? '').trim(),
      });
    }
    if (items.length === 0) {
      return;
    }
    steps.push({
      stepName: step.stepName?.trim() || `Stap ${index + 1}`,
      items,
    });
  });
  return { title: scenario.meta.title.trim(), steps };
}
