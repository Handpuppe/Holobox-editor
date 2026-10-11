import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyNursingScenario } from './emptyScenario';
import {
  decryptHoloboxPackage,
  encryptHoloboxPackage,
  HOLOBOX_PACKAGE_META,
  HOLOBOX_PACKAGE_PAYLOAD,
  openCasePackageFiles,
} from './holoboxPackage';
import {
  listHoloboxDiskFiles,
  listHoloboxPackageTitles,
  readHoloboxPackageBytes,
  writeHoloboxPackageFile,
} from './holoboxPackageDisk';
import { nursingEnvelopeJson, parseVerpleegkundeEnvelope } from './nursingEnvelope';
import { isQuestionFolderPath, resolvedQuestionFolder, startVideoRelative } from './questionFolder';
import { unzipStore } from './zipStore';

const password = 'editor-geheim-voor-pakket';
const caseSentence = 'CASUS-ZIN-UNIEK';
const placeholderSentence = 'PLACEHOLDER-TEKST-UNIEK';
const videoMarker = 'ftypVIDEO-MARKER-91c2';

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

function tempRoot(name: string): string {
  return join(tmpdir(), `holobox-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function fileBytes(file: string): Uint8Array {
  return new Uint8Array(readFileSync(file));
}

function loadTempCase(resourcesRoot: string) {
  const envelopeText = readFileSync(join(resourcesRoot, 'scenarios', 'verpleegkunde.json'), 'utf8');
  const parsed = parseVerpleegkundeEnvelope(envelopeText);
  if (!parsed.ok) {
    return parsed;
  }
  const title = parsed.scenario.meta.title.trim();
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
  return {
    ok: true as const,
    title,
    files: openCasePackageFiles(
      parsed.scenario,
      'verpleegkunde.json',
      envelopeText,
      paths.map((relativePath) => ({
        relativePath,
        data: fileBytes(join(resourcesRoot, ...relativePath.split('/'))),
      })),
    ),
  };
}

describe('holobox package', () => {
  it('hides the case, placeholders and videos until the editor password is used', async () => {
    const draft = emptyNursingScenario();
    draft.meta.title = 'Slechtnieuwsgesprek oefenen';
    draft.steps[0]!.stepName = 'Vraag.3';
    draft.steps[0]!.question = caseSentence;
    draft.steps[0]!.questionFolder = 'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3';
    draft.steps[0]!.stepVideoPlaceholder = placeholderSentence;
    const video = new TextEncoder().encode(videoMarker);
    const files = openCasePackageFiles(draft, 'verpleegkunde.json', nursingEnvelopeJson(draft), [
      {
        relativePath:
          'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/Videos/antwoord-goed.mp4',
        data: video,
      },
      {
        relativePath:
          'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-oefenen-Vraag3-startvideo.mp4',
        data: video,
      },
      {
        relativePath: 'gesprekstechnieken/Andere casus-Vraag1/Videos/antwoord-goed.mp4',
        data: video,
      },
    ]);
    expect(files.map((file) => file.name)).toContain('scenarios/verpleegkunde.json');
    expect(files.map((file) => file.name)).toContain(
      'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/vraag-startvideo.txt',
    );
    expect(files.map((file) => file.name)).toContain(
      'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-oefenen-Vraag3-startvideo.mp4',
    );
    expect(files.map((file) => file.name)).not.toContain(
      'gesprekstechnieken/Andere casus-Vraag1/Videos/antwoord-goed.mp4',
    );

    const zip = await encryptHoloboxPackage(files, password, { iterations: 1000 });
    expect(containsText(zip, caseSentence)).toBe(false);
    expect(containsText(zip, placeholderSentence)).toBe(false);
    expect(containsText(zip, videoMarker)).toBe(false);
    expect(containsText(zip, password)).toBe(false);
    const outer = unzipStore(zip);
    expect(outer.map((entry) => entry.name).sort()).toEqual(
      [HOLOBOX_PACKAGE_META, HOLOBOX_PACKAGE_PAYLOAD].sort(),
    );
    const metaEntry = outer.find((entry) => entry.name === HOLOBOX_PACKAGE_META);
    expect(metaEntry).toBeTruthy();
    const meta = JSON.parse(
      new TextDecoder().decode(metaEntry?.data ?? new Uint8Array()),
    ) as Record<string, unknown>;
    expect(Object.keys(meta).sort()).toEqual([
      'cipher',
      'iterations',
      'iv',
      'kdf',
      'kind',
      'salt',
      'schemaVersion',
    ]);
    expect(
      containsText(
        outer.find((entry) => entry.name === HOLOBOX_PACKAGE_PAYLOAD)!.data,
        caseSentence,
      ),
    ).toBe(false);

    const wrong = await decryptHoloboxPackage(zip, 'ander-wachtwoord');
    expect(wrong.ok).toBe(false);
    const opened = await decryptHoloboxPackage(zip, password);
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }
    const restored = opened.files.find((file) => file.name === 'scenarios/verpleegkunde.json');
    const placeholder = opened.files.find((file) => file.name.endsWith('/vraag-startvideo.txt'));
    const startVideo = opened.files.find((file) => file.name.includes('/Startvideos/'));
    expect(restored && containsText(restored.data, caseSentence)).toBe(true);
    expect(placeholder && containsText(placeholder.data, placeholderSentence)).toBe(true);
    expect(startVideo && containsText(startVideo.data, videoMarker)).toBe(true);
  });

  it('lists only the open case videos, including Startvideos', () => {
    const root = tempRoot('list');
    const folder = join(root, 'gesprekstechnieken', 'Slechtnieuwsgesprek oefenen-Vraag3', 'Videos');
    const other = join(root, 'gesprekstechnieken', 'Andere casus-Vraag1', 'Videos');
    const starts = join(root, 'gesprekstechnieken', 'Startvideos');
    mkdirSync(folder, { recursive: true });
    mkdirSync(other, { recursive: true });
    mkdirSync(starts, { recursive: true });
    writeFileSync(join(folder, 'antwoord-goed.mp4'), 'eigen-video', 'utf8');
    writeFileSync(join(folder, 'Staat is pijn.mp4'), 'extra-video', 'utf8');
    writeFileSync(join(other, 'antwoord-goed.mp4'), 'andere-video', 'utf8');
    writeFileSync(
      join(starts, 'Slechtnieuwsgesprek-oefenen-Vraag3-startvideo.mp4'),
      'start',
      'utf8',
    );
    writeFileSync(join(starts, 'Andere-casus-Vraag1-startvideo.mp4'), 'andere-start', 'utf8');
    try {
      const listed = listHoloboxDiskFiles(
        root,
        'Slechtnieuwsgesprek oefenen',
        ['gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3'],
        [],
      );
      expect(listed).toEqual([
        'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/Videos/Staat is pijn.mp4',
        'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/Videos/antwoord-goed.mp4',
        'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-oefenen-Vraag3-startvideo.mp4',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps one previous package and does not write a resources folder', async () => {
    const resources = tempRoot('resources');
    const project = tempRoot('project');
    mkdirSync(join(resources, 'scenarios'), { recursive: true });
    const draft = emptyNursingScenario();
    draft.meta.title = 'Slechtnieuwsgesprek oefenen';
    draft.steps[0]!.question = caseSentence;
    draft.steps[0]!.stepVideoPlaceholder = placeholderSentence;
    draft.steps[0]!.questionFolder = 'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3';
    writeFileSync(
      join(resources, 'scenarios', 'verpleegkunde.json'),
      nursingEnvelopeJson(draft),
      'utf8',
    );
    const videoDir = join(
      resources,
      'gesprekstechnieken',
      'Slechtnieuwsgesprek oefenen-Vraag3',
      'Videos',
    );
    mkdirSync(videoDir, { recursive: true });
    mkdirSync(join(resources, 'gesprekstechnieken', 'Startvideos'), { recursive: true });
    writeFileSync(join(videoDir, 'antwoord-goed.mp4'), videoMarker, 'utf8');
    writeFileSync(
      join(
        resources,
        'gesprekstechnieken',
        'Startvideos',
        'Slechtnieuwsgesprek-oefenen-Vraag1-startvideo.mp4',
      ),
      videoMarker,
      'utf8',
    );
    try {
      const loaded = loadTempCase(resources);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) {
        return;
      }
      expect(loaded.files.some((file) => file.name.endsWith('antwoord-goed.mp4'))).toBe(true);
      expect(loaded.files.some((file) => file.name.includes('/Startvideos/'))).toBe(true);
      const first = await encryptHoloboxPackage(loaded.files, password, { iterations: 1000 });
      const second = await encryptHoloboxPackage(
        [{ name: 'scenarios/verpleegkunde.json', data: new TextEncoder().encode('nieuw-pakket') }],
        password,
        { iterations: 1000 },
      );
      const third = await encryptHoloboxPackage(
        [{ name: 'scenarios/verpleegkunde.json', data: new TextEncoder().encode('derde-pakket') }],
        password,
        { iterations: 1000 },
      );
      const kept = writeHoloboxPackageFile(project, loaded.title, first, false);
      expect(kept.ok).toBe(true);
      const refused = writeHoloboxPackageFile(project, loaded.title, second, false);
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.exists).toBe(true);
      }
      expect(fileBytes(join(project, 'pakketten', 'Slechtnieuwsgesprek oefenen.zip'))).toEqual(
        new Uint8Array(first),
      );
      expect(existsSync(join(project, 'pakketten', 'vorige'))).toBe(false);
      const replaced = writeHoloboxPackageFile(project, loaded.title, second, true);
      expect(replaced.ok).toBe(true);
      expect(
        fileBytes(join(project, 'pakketten', 'vorige', 'Slechtnieuwsgesprek oefenen.zip')),
      ).toEqual(new Uint8Array(first));
      expect(fileBytes(join(project, 'pakketten', 'Slechtnieuwsgesprek oefenen.zip'))).toEqual(
        new Uint8Array(second),
      );
      writeHoloboxPackageFile(project, loaded.title, third, true);
      expect(
        fileBytes(join(project, 'pakketten', 'vorige', 'Slechtnieuwsgesprek oefenen.zip')),
      ).toEqual(new Uint8Array(second));
      expect(fileBytes(join(project, 'pakketten', 'Slechtnieuwsgesprek oefenen.zip'))).toEqual(
        new Uint8Array(third),
      );
      expect(existsSync(join(project, 'resources'))).toBe(false);
      expect(existsSync(join(project, 'pakketten', 'resources'))).toBe(false);
      expect(
        containsText(
          fileBytes(join(project, 'pakketten', 'Slechtnieuwsgesprek oefenen.zip')),
          caseSentence,
        ),
      ).toBe(false);
    } finally {
      rmSync(resources, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('lists package names without reading the zip contents', () => {
    const project = tempRoot('namen');
    const secret = 'mevrouw De Boer';
    try {
      mkdirSync(join(project, 'pakketten', 'vorige'), { recursive: true });
      mkdirSync(join(project, 'resources', 'scenarios'), { recursive: true });
      writeFileSync(join(project, 'pakketten', 'Slechtnieuwsgesprek oefenen.zip'), secret, 'utf8');
      writeFileSync(
        join(project, 'pakketten', 'vorige', 'Slechtnieuwsgesprek oefenen.zip'),
        secret,
        'utf8',
      );
      writeFileSync(join(project, 'resources', 'scenarios', 'verpleegkunde.json'), secret, 'utf8');
      expect(listHoloboxPackageTitles(project)).toEqual(['Slechtnieuwsgesprek oefenen']);
      expect(JSON.stringify(listHoloboxPackageTitles(project))).not.toContain(secret);
      const bytes = readHoloboxPackageBytes(project, 'Slechtnieuwsgesprek oefenen');
      expect(bytes && containsText(bytes, secret)).toBe(true);
      expect(readHoloboxPackageBytes(project, '../resources/scenarios/verpleegkunde')).toBeNull();
      expect(existsSync(join(project, 'pakketten', 'resources'))).toBe(false);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
