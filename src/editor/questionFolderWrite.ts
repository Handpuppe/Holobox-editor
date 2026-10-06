import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isQuestionFolderBackupName,
  isQuestionFolderPath,
  isQuestionTextFile,
  QUESTION_TEXT_FILES,
  questionFolderOnDisk,
} from './questionFolderPaths';

export interface QuestionFolderBackupFile {
  name: string;
  contentBase64: string;
}

function encodeBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function questionFolderAbsolute(resourcesRoot: string, folder: string): string | null {
  const disk = questionFolderOnDisk(folder);
  if (!isQuestionFolderPath(disk)) {
    return null;
  }
  return join(resourcesRoot, ...disk.split('/'));
}

export function readQuestionFolderBackup(
  resourcesRoot: string,
  folder: string,
): QuestionFolderBackupFile[] {
  const root = questionFolderAbsolute(resourcesRoot, folder);
  if (!root || !existsSync(root)) {
    return [];
  }
  const files: QuestionFolderBackupFile[] = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (statSync(full).isFile() && isQuestionTextFile(name)) {
      files.push({ name, contentBase64: encodeBase64(readFileSync(full)) });
      continue;
    }
    if (name !== 'Videos' || !statSync(full).isDirectory()) {
      continue;
    }
    for (const videoName of readdirSync(full)) {
      const relativeName = `Videos/${videoName}`;
      const videoPath = join(full, videoName);
      if (!statSync(videoPath).isFile() || !isQuestionFolderBackupName(relativeName)) {
        continue;
      }
      files.push({ name: relativeName, contentBase64: encodeBase64(readFileSync(videoPath)) });
    }
  }
  return files;
}

export function removeQuestionFolder(
  resourcesRoot: string,
  folder: string,
): { ok: true; files: QuestionFolderBackupFile[] } | { ok: false; error: string } {
  if (!isQuestionFolderPath(folder)) {
    return { ok: false, error: 'Ongeldige vraagmap.' };
  }
  const files = readQuestionFolderBackup(resourcesRoot, folder);
  const root = questionFolderAbsolute(resourcesRoot, folder);
  if (root && existsSync(root)) {
    rmSync(root, { recursive: true, force: true });
  }
  return { ok: true, files };
}

export function restoreQuestionFolderBackup(
  resourcesRoot: string,
  folder: string,
  files: QuestionFolderBackupFile[],
): { ok: true } | { ok: false; error: string } {
  if (!isQuestionFolderPath(folder)) {
    return { ok: false, error: 'Ongeldige vraagmap.' };
  }
  for (const file of files) {
    if (!isQuestionFolderBackupName(file.name) || typeof file.contentBase64 !== 'string') {
      return { ok: false, error: 'Onbekend bestand in de vraagmap.' };
    }
  }
  const root = questionFolderAbsolute(resourcesRoot, folder);
  if (!root) {
    return { ok: false, error: 'Ongeldige vraagmap.' };
  }
  mkdirSync(join(root, 'Videos'), { recursive: true });
  for (const file of files) {
    writeFileSync(join(root, ...file.name.split('/')), decodeBase64(file.contentBase64));
  }
  return { ok: true };
}

export function writeQuestionFolderFiles(
  resourcesRoot: string,
  folder: string,
  files: Record<string, string>,
): { ok: true } | { ok: false; error: string } {
  if (!isQuestionFolderPath(folder)) {
    return { ok: false, error: 'Ongeldige vraagmap.' };
  }
  for (const name of Object.keys(files)) {
    if (!isQuestionTextFile(name) || typeof files[name] !== 'string') {
      return { ok: false, error: 'Onbekend placeholderbestand.' };
    }
  }
  const root = questionFolderAbsolute(resourcesRoot, folder);
  if (!root) {
    return { ok: false, error: 'Ongeldige vraagmap.' };
  }
  mkdirSync(join(root, 'Videos'), { recursive: true });
  for (const name of QUESTION_TEXT_FILES) {
    if (!(name in files)) {
      continue;
    }
    writeFileSync(join(root, name), files[name] ?? '', 'utf8');
  }
  return { ok: true };
}
