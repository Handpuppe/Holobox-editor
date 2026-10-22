import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyNursingScenario } from './emptyScenario';
import { restoreHoloboxCase } from './holoboxPackageDisk';
import {
  decryptHoloboxPackage,
  encryptHoloboxPackage,
  HOLOBOX_PACKAGE_KEY,
  openCasePackageFiles,
} from './holoboxPackage';
import { nursingEnvelopeJson } from './nursingEnvelope';

const caseSentence = 'TIJDELIJKE-CASUSZIN';
const placeholderSentence = 'TIJDELIJKE-PLACEHOLDER';
const videoSentence = 'TIJDELIJKE-VIDEO';
const realCase = join('resources', 'scenarios', 'verpleegkunde.json');

function tempRoot(): string {
  return join(tmpdir(), `phosaner-import-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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

function packagedCase() {
  const draft = emptyNursingScenario();
  draft.meta.title = 'Tijdelijke importcasus';
  draft.patient.name = 'Tijdelijke patiënt';
  draft.steps[0]!.stepName = 'Vraag.1';
  draft.steps[0]!.phaseLabel = 'Situatie';
  draft.steps[0]!.question = caseSentence;
  draft.steps[0]!.stepVideoPlaceholder = placeholderSentence;
  draft.steps[0]!.questionFolder = 'gesprekstechnieken/Tijdelijke importcasus-Vraag1';
  draft.steps[0]!.options[0]!.text = 'Goed antwoord';
  draft.steps[0]!.options[1]!.text = 'Deels goed antwoord';
  draft.steps[0]!.options[2]!.text = 'Verkeerd antwoord';
  const video = new TextEncoder().encode(videoSentence);
  const files = openCasePackageFiles(
    draft,
    'verpleegkunde-tijdelijk.json',
    nursingEnvelopeJson(draft),
    [
      {
        relativePath: 'gesprekstechnieken/Tijdelijke importcasus-Vraag1/Videos/antwoord-goed.mp4',
        data: video,
      },
      {
        relativePath: 'gesprekstechnieken/Startvideos/Tijdelijke-importcasus-Vraag1-startvideo.mp4',
        data: video,
      },
    ],
  );
  return { draft, files };
}

describe('holobox import into a temporary resources folder', () => {
  it('restores the case only after replace and leaves an existing case on Nee', async () => {
    const before = readFileSync(realCase);
    const { files } = packagedCase();
    const zip = await encryptHoloboxPackage(files, HOLOBOX_PACKAGE_KEY, { iterations: 1000 });
    expect(containsText(zip, caseSentence)).toBe(false);
    expect(containsText(zip, placeholderSentence)).toBe(false);
    expect(containsText(zip, videoSentence)).toBe(false);
    const wrong = await decryptHoloboxPackage(zip, 'verkeerd-wachtwoord');
    expect(wrong.ok).toBe(false);

    const opened = await decryptHoloboxPackage(zip, HOLOBOX_PACKAGE_KEY);
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const root = tempRoot();
    expect(root.startsWith(tmpdir())).toBe(true);
    const otherVideo = join(
      root,
      'gesprekstechnieken',
      'Andere casus-Vraag1',
      'Videos',
      'antwoord-goed.mp4',
    );
    mkdirSync(join(root, 'gesprekstechnieken', 'Andere casus-Vraag1', 'Videos'), {
      recursive: true,
    });
    writeFileSync(otherVideo, 'NIET-AANRAKEN', 'utf8');
    const caseFile = join(root, 'scenarios', 'verpleegkunde-tijdelijk.json');
    const placeholder = join(
      root,
      'gesprekstechnieken',
      'Tijdelijke importcasus-Vraag1',
      'vraag-startvideo.txt',
    );
    const answerVideo = join(
      root,
      'gesprekstechnieken',
      'Tijdelijke importcasus-Vraag1',
      'Videos',
      'antwoord-goed.mp4',
    );
    mkdirSync(join(root, 'scenarios'), { recursive: true });
    mkdirSync(join(root, 'gesprekstechnieken', 'Tijdelijke importcasus-Vraag1'), {
      recursive: true,
    });
    writeFileSync(caseFile, 'OUD-CASUS', 'utf8');
    writeFileSync(placeholder, 'OUD-PLACEHOLDER', 'utf8');
    try {
      const refused = restoreHoloboxCase(root, opened.files, false);
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.exists).toBe(true);
      }
      expect(readFileSync(caseFile, 'utf8')).toBe('OUD-CASUS');
      expect(readFileSync(placeholder, 'utf8')).toBe('OUD-PLACEHOLDER');
      expect(existsSync(answerVideo)).toBe(false);
      expect(readFileSync(otherVideo, 'utf8')).toBe('NIET-AANRAKEN');

      const replaced = restoreHoloboxCase(root, opened.files, true);
      expect(replaced.ok).toBe(true);
      if (replaced.ok) {
        expect(replaced.caseFile).toBe('verpleegkunde-tijdelijk.json');
      }
      expect(readFileSync(caseFile, 'utf8')).toContain(caseSentence);
      expect(readFileSync(placeholder, 'utf8')).toContain(placeholderSentence);
      expect(readFileSync(answerVideo, 'utf8')).toBe(videoSentence);
      expect(
        readFileSync(
          join(
            root,
            'gesprekstechnieken',
            'Startvideos',
            'Tijdelijke-importcasus-Vraag1-startvideo.mp4',
          ),
          'utf8',
        ),
      ).toBe(videoSentence);
      expect(readFileSync(otherVideo, 'utf8')).toBe('NIET-AANRAKEN');
      expect(existsSync(join(root, 'logopedie'))).toBe(false);

      const tainted = [
        ...opened.files,
        { name: 'logopedie/foto.png', data: new Uint8Array([1, 2, 3]) },
      ];
      const fresh = tempRoot();
      try {
        const blocked = restoreHoloboxCase(fresh, tainted, true);
        expect(blocked.ok).toBe(false);
        expect(existsSync(fresh)).toBe(false);
      } finally {
        if (existsSync(fresh)) {
          rmSync(fresh, { recursive: true, force: true });
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
      expect(readFileSync(realCase)).toEqual(before);
    }
  });
});
