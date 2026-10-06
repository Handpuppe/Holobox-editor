import { withBaseUrl } from '../media/baseUrl';
import type { NursingStep } from '../nursing/types';
import { scenarioMediaFolderName } from './nursingAnswerMedia';
import { isNursingMediaPath } from './nursingMedia';
import {
  QUESTION_TEXT_FILES,
  isQuestionFolderPath,
  questionFolderOnDisk,
  type QuestionTextFile,
} from './questionFolderPaths';

export const QUESTION_FOLDER_PATH = '/editor-api/question-folder';

export {
  QUESTION_TEXT_FILES,
  isQuestionFolderPath,
  isQuestionTextFile,
  questionFolderOnDisk,
} from './questionFolderPaths';
export type { QuestionTextFile } from './questionFolderPaths';

export const QUESTION_VIDEO_FILES = {
  start: 'vraag-startvideo.mp4',
  high: 'antwoord-goed.mp4',
  partial: 'antwoord-deels-goed.mp4',
  inappropriate: 'antwoord-verkeerd.mp4',
  'high-extra': 'antwoord-goed-extra.mp4',
  'partial-extra': 'antwoord-deels-goed-extra.mp4',
  'inappropriate-extra': 'antwoord-verkeerd-extra.mp4',
} as const;

export type QuestionVideoKey = keyof typeof QUESTION_VIDEO_FILES;

export type QuestionModule = 'verpleegkunde' | 'logopedie';

export function questionDiskRoot(module: QuestionModule): string {
  return module === 'verpleegkunde' ? 'gesprekstechnieken' : module;
}

export function questionNumber(stepName: string): string {
  const match = /^Vraag\.(\d+)$/.exec(stepName.trim());
  return match?.[1] ?? '1';
}

export function questionFolderRelative(
  module: QuestionModule,
  title: string,
  stepName: string,
): string {
  const caseName = scenarioMediaFolderName(title, '');
  return `${questionDiskRoot(module)}/${caseName}-Vraag${questionNumber(stepName)}`;
}

export function questionVideoRelative(folder: string, key: QuestionVideoKey): string | null {
  const disk = questionFolderOnDisk(folder);
  if (!isQuestionFolderPath(disk) || !disk.startsWith('gesprekstechnieken/')) {
    return null;
  }
  const relative = `${disk}/Videos/${QUESTION_VIDEO_FILES[key]}`;
  return isNursingMediaPath(relative) ? relative : null;
}

export function resolvedQuestionFolder(
  title: string,
  step: { questionFolder?: string; stepName?: string },
): string {
  const stored = step.questionFolder?.trim() ?? '';
  if (stored) {
    const disk = questionFolderOnDisk(stored);
    if (isQuestionFolderPath(disk)) {
      return disk;
    }
  }
  return questionFolderRelative('verpleegkunde', title, step.stepName ?? '');
}

/** Startvideo staat los van de vraagmap, met de casus en het vraagnummer in de bestandsnaam. */
export function startVideoRelative(title: string, stepName: string): string | null {
  const caseName = scenarioMediaFolderName(title, '').replace(/ /g, '-');
  if (!caseName || caseName.includes('..') || caseName.toLowerCase().includes('logopedie')) {
    return null;
  }
  const relative = `gesprekstechnieken/Startvideos/${caseName}-Vraag${questionNumber(stepName)}-startvideo.mp4`;
  return isNursingMediaPath(relative) ? relative : null;
}

function optionField(
  step: NursingStep,
  quality: 'high' | 'partial' | 'inappropriate',
  field: 'videoPlaceholder' | 'answerCardPlaceholder',
): string {
  return step.options.find((option) => option.quality === quality)?.[field] ?? '';
}

export function questionTextFiles(step: NursingStep): Record<QuestionTextFile, string> {
  return {
    'vraag-startvideo.txt': step.stepVideoPlaceholder ?? '',
    'antwoord-goed.txt': optionField(step, 'high', 'videoPlaceholder'),
    'antwoord-deels-goed.txt': optionField(step, 'partial', 'videoPlaceholder'),
    'antwoord-verkeerd.txt': optionField(step, 'inappropriate', 'videoPlaceholder'),
    'antwoord-goed-extra.txt': optionField(step, 'high', 'answerCardPlaceholder'),
    'antwoord-deels-goed-extra.txt': optionField(step, 'partial', 'answerCardPlaceholder'),
    'antwoord-verkeerd-extra.txt': optionField(step, 'inappropriate', 'answerCardPlaceholder'),
  };
}

export function sameQuestionTexts(left: NursingStep, right: NursingStep): boolean {
  const a = questionTextFiles(left);
  const b = questionTextFiles(right);
  return QUESTION_TEXT_FILES.every((name) => a[name] === b[name]);
}

export interface QuestionFolderBackupFile {
  name: string;
  contentBase64: string;
}

export async function deleteQuestionFolder(folder: string): Promise<QuestionFolderBackupFile[]> {
  const response = await fetch(withBaseUrl(QUESTION_FOLDER_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', folder }),
  });
  if (!response.ok) {
    throw new Error('De vraagmap kon niet worden verwijderd.');
  }
  const payload = (await response.json()) as { files?: QuestionFolderBackupFile[] };
  return Array.isArray(payload.files) ? payload.files : [];
}

export async function restoreQuestionFolder(
  folder: string,
  files: QuestionFolderBackupFile[],
): Promise<void> {
  if (files.length === 0) {
    return;
  }
  const response = await fetch(withBaseUrl(QUESTION_FOLDER_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restore', folder, files }),
  });
  if (!response.ok) {
    throw new Error('De vraagmap kon niet worden teruggezet.');
  }
}

export async function saveQuestionFolder(
  folder: string,
  files: Record<string, string>,
): Promise<void> {
  if (!isQuestionFolderPath(folder)) {
    return;
  }
  try {
    await fetch(withBaseUrl(QUESTION_FOLDER_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, files }),
    });
  } catch {
    // De vraag blijft in het scenario staan als de map nog niet geschreven kan worden.
  }
}
