import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decryptHoloboxPackage,
  encryptHoloboxPackage,
  HOLOBOX_PACKAGE_KEY,
  openCasePackageFiles,
} from './holoboxPackage';
import { listHoloboxDiskFiles, writeHoloboxPackageFile } from './holoboxPackageDisk';
import { parseVerpleegkundeEnvelope } from './nursingEnvelope';
import { isQuestionFolderPath, resolvedQuestionFolder, startVideoRelative } from './questionFolder';
import { unzipStore } from './zipStore';

function projectRootFromModule(): string {
  const path = decodeURIComponent(import.meta.url.replace(/^file:\/\//, ''));
  const normalized = path.replaceAll('\\', '/');
  const marker = '/src/editor/';
  const index = normalized.toLowerCase().indexOf(marker);
  const root = index >= 0 ? normalized.slice(0, index) : normalized;
  return root.startsWith('/') && /^\/[A-Za-z]:\//.test(root) ? root.slice(1) : root;
}

const projectRoot = projectRootFromModule();
const resourcesRoot = join(projectRoot, 'resources');
const caseFile = join(resourcesRoot, 'scenarios', 'verpleegkunde.json');
const placeholderFile = join(
  resourcesRoot,
  'gesprekstechnieken',
  'Slechtnieuwsgesprek oefenen-Vraag3',
  'vraag-startvideo.txt',
);
const packagePassword = HOLOBOX_PACKAGE_KEY;
const writePackage =
  (import.meta.env as { VITE_HOLOBOX_WRITE_PACKAGE?: string }).VITE_HOLOBOX_WRITE_PACKAGE === '1';

function fileBytes(file: string): Uint8Array {
  return new Uint8Array(readFileSync(file));
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...filesUnder(full));
      continue;
    }
    found.push(full);
  }
  return found.sort();
}

function containsText(bytes: Uint8Array, text: string): boolean {
  const needle = new TextEncoder().encode(text);
  if (needle.length === 0 || needle.length > bytes.length) {
    return false;
  }
  for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    let same = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) {
        same = false;
        break;
      }
    }
    if (same) {
      return true;
    }
  }
  return false;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

describe('Slechtnieuwsgesprek oefenen package', () => {
  it.skipIf(!writePackage)(
    'writes one encrypted zip and leaves the case files unchanged',
    async () => {
      const caseBefore = fileBytes(caseFile);
      const placeholderBefore = fileBytes(placeholderFile);
      const before = filesUnder(join(resourcesRoot, 'gesprekstechnieken'));
      const envelopeText = new TextDecoder().decode(caseBefore);
      const parsed = parseVerpleegkundeEnvelope(envelopeText);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      const title = parsed.scenario.meta.title.trim();
      expect(title).toBe('Slechtnieuwsgesprek oefenen');
      const folders: string[] = [];
      const extraVideos: string[] = [];
      for (const step of parsed.scenario.steps) {
        const folder = resolvedQuestionFolder(title, step);
        if (isQuestionFolderPath(folder)) {
          folders.push(folder);
        }
        const start = startVideoRelative(title, step.stepName ?? '');
        if (start) {
          extraVideos.push(start);
        }
      }
      for (const slot of parsed.scenario.mediaSlots) {
        if (slot.primaryMedia) {
          extraVideos.push(slot.primaryMedia);
        }
      }
      const paths = listHoloboxDiskFiles(resourcesRoot, title, folders, extraVideos);
      const files = openCasePackageFiles(
        parsed.scenario,
        'verpleegkunde.json',
        envelopeText,
        paths.map((relativePath) => ({
          relativePath,
          data: fileBytes(join(resourcesRoot, ...relativePath.split('/'))),
        })),
      );
      expect(files.map((file) => file.name)).toContain('scenarios/verpleegkunde.json');
      expect(files.map((file) => file.name)).toContain(
        'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/vraag-startvideo.txt',
      );
      for (const relativePath of paths) {
        expect(files.map((file) => file.name)).toContain(relativePath);
      }
      const caseEntry = files.find((file) => file.name === 'scenarios/verpleegkunde.json');
      expect(caseEntry && containsText(caseEntry.data, 'mevrouw De Boer')).toBe(true);
      const zip = await encryptHoloboxPackage(files, packagePassword);
      const saved = writeHoloboxPackageFile(projectRoot, title, zip, true);
      expect(saved.ok).toBe(true);
      const zipPath = join(projectRoot, 'pakketten', 'Slechtnieuwsgesprek oefenen.zip');
      const stored = fileBytes(zipPath);
      expect(containsText(stored, 'mevrouw De Boer')).toBe(false);
      expect(containsText(stored, 'Een open vraag stellen.')).toBe(false);
      expect(containsText(stored, packagePassword)).toBe(false);
      expect(
        unzipStore(stored)
          .map((entry) => entry.name)
          .sort(),
      ).toEqual(['inhoud.bin', 'phosaner-holobox.json'].sort());
      expect((await decryptHoloboxPackage(stored, 'verkeerd-wachtwoord')).ok).toBe(false);
      const opened = await decryptHoloboxPackage(stored, packagePassword);
      expect(opened.ok).toBe(true);
      if (opened.ok) {
        const restored = opened.files.find((file) => file.name === 'scenarios/verpleegkunde.json');
        expect(restored && containsText(restored.data, 'mevrouw De Boer')).toBe(true);
        expect(opened.files.some((file) => file.name.includes('/Startvideos/'))).toBe(
          paths.some((relativePath) => relativePath.includes('/Startvideos/')),
        );
      }
      expect(sameBytes(fileBytes(caseFile), caseBefore)).toBe(true);
      expect(sameBytes(fileBytes(placeholderFile), placeholderBefore)).toBe(true);
      expect(filesUnder(join(resourcesRoot, 'gesprekstechnieken'))).toEqual(before);
      expect(existsSync(join(projectRoot, 'pakketten', 'resources'))).toBe(false);
      expect(statSync(zipPath).isFile()).toBe(true);
    },
  );
});
