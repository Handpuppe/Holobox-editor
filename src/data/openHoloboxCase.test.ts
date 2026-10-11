import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decryptHoloboxPackage,
  encryptHoloboxPackage,
  HOLOBOX_PACKAGE_KEY,
  openCasePackageFiles,
} from '../editor/holoboxPackage';
import { parseVerpleegkundeEnvelope } from '../editor/nursingEnvelope';
import { openHoloboxPackageBytes } from './openHoloboxCase';

const caseFile = join('resources', 'scenarios', 'verpleegkunde.json');
const realZip = join('pakketten', 'Slechtnieuwsgesprek oefenen.zip');

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

async function encryptedCase(iterations?: number): Promise<Uint8Array> {
  const raw = readFileSync(caseFile, 'utf8');
  const parsed = parseVerpleegkundeEnvelope(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const files = openCasePackageFiles(parsed.scenario, 'verpleegkunde.json', raw, []);
  return encryptHoloboxPackage(files, HOLOBOX_PACKAGE_KEY, iterations ? { iterations } : undefined);
}

describe('open holobox case', () => {
  it('opens mevrouw De Boer from the encrypted zip without a typed password', async () => {
    const zip = await encryptedCase(1000);
    expect(containsText(zip, 'mevrouw De Boer')).toBe(false);
    expect(containsText(zip, 'Wat zeg je als eerste?')).toBe(false);
    expect(containsText(zip, 'U hebt slecht geslapen. Wilt u daar iets over vertellen?')).toBe(
      false,
    );
    expect(containsText(zip, HOLOBOX_PACKAGE_KEY)).toBe(false);
    expect((await decryptHoloboxPackage(zip, 'verkeerd-wachtwoord')).ok).toBe(false);
    const opened = await openHoloboxPackageBytes(zip);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.scenario.patient.name).toBe('mevrouw De Boer');
      expect(opened.scenario.steps.some((step) => step.question === 'Wat zeg je als eerste?')).toBe(
        true,
      );
      expect(
        opened.scenario.steps.some((step) =>
          step.options.some(
            (option) => option.text === 'U hebt slecht geslapen. Wilt u daar iets over vertellen?',
          ),
        ),
      ).toBe(true);
    }
  });

  it.skipIf(!existsSync(realZip))(
    'opens the Slechtnieuwsgesprek package without a typed password',
    async () => {
      const zip = new Uint8Array(readFileSync(realZip));
      expect(containsText(zip, 'mevrouw De Boer')).toBe(false);
      expect(containsText(zip, 'Een open vraag stellen.')).toBe(false);
      expect(containsText(zip, 'Wat zeg je als eerste?')).toBe(false);
      expect((await decryptHoloboxPackage(zip, 'verkeerd-wachtwoord')).ok).toBe(false);
      const opened = await openHoloboxPackageBytes(zip);
      expect(opened.ok).toBe(true);
      if (opened.ok) {
        expect(opened.scenario.patient.name).toBe('mevrouw De Boer');
        expect(opened.scenario.meta.title).toBe('Slechtnieuwsgesprek oefenen');
        expect(
          opened.scenario.steps.some((step) => step.question === 'Wat zeg je als eerste?'),
        ).toBe(true);
      }
    },
  );
});
