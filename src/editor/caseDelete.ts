import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isQuestionFolderPath, questionFolderOnDisk } from './questionFolderPaths';
import { removeQuestionFolder } from './questionFolderWrite';

export function isEditorCaseFileName(
  moduleId: 'logopedie' | 'verpleegkunde',
  fileName: string,
): boolean {
  if (
    fileName !== fileName.trim() ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('..') ||
    !fileName.endsWith('.json')
  ) {
    return false;
  }
  return fileName === `${moduleId}.json` || fileName.startsWith(`${moduleId}-`);
}

function questionFoldersInEnvelope(data: unknown): string[] {
  if (!data || typeof data !== 'object') {
    return [];
  }
  const steps = (data as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) {
    return [];
  }
  const folders: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      continue;
    }
    const folder = (step as { questionFolder?: unknown }).questionFolder;
    if (typeof folder !== 'string') {
      continue;
    }
    const disk = questionFolderOnDisk(folder);
    if (isQuestionFolderPath(disk)) {
      folders.push(disk);
    }
  }
  return folders;
}

export function deleteEditorCase(
  resourcesRoot: string,
  moduleId: 'logopedie' | 'verpleegkunde',
  fileName: string,
  extraFolders: readonly string[],
  options?: { requireFile?: boolean },
): { ok: true; removedFolders: string[] } | { ok: false; error: string } {
  const requireFile = options?.requireFile !== false;
  if (!isEditorCaseFileName(moduleId, fileName)) {
    return { ok: false, error: 'Ongeldige casus.' };
  }
  const target = join(resourcesRoot, 'scenarios', fileName);
  const exists = existsSync(target);
  if (!exists && requireFile) {
    return { ok: false, error: 'De casus is niet gevonden.' };
  }
  const fromFile: string[] = [];
  if (exists) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(target, 'utf8')) as unknown;
    } catch {
      return { ok: false, error: 'De casus is geen geldige JSON.' };
    }
    if (!data || typeof data !== 'object' || (data as { module?: unknown }).module !== moduleId) {
      return { ok: false, error: 'De casus hoort bij een andere module.' };
    }
    fromFile.push(...questionFoldersInEnvelope(data));
  }
  const folders = new Set<string>();
  for (const folder of [...fromFile, ...extraFolders]) {
    const disk = questionFolderOnDisk(folder);
    if (isQuestionFolderPath(disk)) {
      folders.add(disk);
    }
  }
  if (exists) {
    unlinkSync(target);
    const backup = `${target}.bak`;
    if (existsSync(backup)) {
      unlinkSync(backup);
    }
  }
  const removedFolders: string[] = [];
  for (const folder of folders) {
    const removed = removeQuestionFolder(resourcesRoot, folder);
    if (removed.ok) {
      removedFolders.push(folder);
    }
  }
  return { ok: true, removedFolders };
}
