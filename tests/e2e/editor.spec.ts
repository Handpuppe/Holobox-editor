import { expect, test } from '@playwright/test';
import { chooseDefaultScenario } from './helpers';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

function logopedieJsonFiles(): string[] {
  return [
    join(process.cwd(), 'resources', 'scenarios', 'logopedie.json'),
    join(process.cwd(), 'resources', 'scenarios', 'logopedie.json.bak'),
    join(process.cwd(), 'dist', 'resources', 'scenarios', 'logopedie.json'),
    join(process.cwd(), 'dist', 'resources', 'scenarios', 'logopedie.json.bak'),
  ];
}

function cleanupLogopedieJson(): void {
  for (const file of logopedieJsonFiles()) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
}

test.describe('logopedie scenario editor', () => {
  test.beforeEach(() => {
    cleanupLogopedieJson();
  });
  test.afterEach(() => {
    cleanupLogopedieJson();
  });

  test('opens beside the simulator and downloads JSON without changing /logopedie', async ({
    page,
  }) => {
    await page.goto('editor.html');
    await expect(page.getByTestId('screen-scenario-editor')).toBeVisible();
    await expect(page.getByTestId('logopedie-avatar')).toBeVisible();

    const prompt = page.getByTestId('prompt-text');
    await prompt.fill('Vraag gewijzigd in de editor.');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('btn-download-json').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('logopedie.json');
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const envelope = JSON.parse(readFileSync(filePath ?? '', 'utf8')) as {
      schemaVersion: number;
      module: string;
      scenario: { nodes: Array<{ prompt: { text: string } }> };
    };
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.module).toBe('logopedie');
    expect(envelope.scenario.nodes[0]?.prompt.text).toBe('Vraag gewijzigd in de editor.');

    await page.goto('logopedie');
    await chooseDefaultScenario(page);
    await expect(page.getByTestId('screen-logopedie-home')).toBeVisible();
    await page.getByTestId('btn-start-simulation').click();
    await expect(page.getByTestId('screen-briefing')).toBeVisible();
    await page.getByTestId('btn-start-intake').click();
    await expect(page.getByTestId('screen-simulation')).toBeVisible();
    await expect(page.getByTestId('client-response')).toHaveText(
      'Hallo... u bent... eh... de... logopedie? Ja.',
    );
    await expect(page.getByText('Vraag gewijzigd in de editor.')).toHaveCount(0);
  });

  test('opens valid JSON, rejects invalid JSON, and restores the start copy', async ({ page }) => {
    await page.goto('editor.html');
    await expect(page.getByTestId('screen-scenario-editor')).toBeVisible();
    const originalPrompt = await page.getByTestId('prompt-text').inputValue();

    await page.getByTestId('prompt-text').fill('Vraag voor roundtrip-JSON.');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('btn-download-json').click();
    const download = await downloadPromise;
    const savedPath = await download.path();
    expect(savedPath).toBeTruthy();

    await page.getByTestId('btn-reset-seed').click();
    await expect(page.getByTestId('prompt-text')).toHaveValue(originalPrompt);

    await page.getByTestId('input-open-json').setInputFiles(savedPath ?? '');
    await expect(page.getByTestId('prompt-text')).toHaveValue('Vraag voor roundtrip-JSON.');
    await expect(page.getByTestId('editor-open-error')).toHaveCount(0);

    await page.getByTestId('input-open-json').setInputFiles({
      name: 'ongeldig.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{niet-json'),
    });
    await expect(page.getByTestId('editor-open-error')).toContainText(
      'Dit bestand is geen geldige JSON.',
    );
    await expect(page.getByTestId('prompt-text')).toHaveValue('Vraag voor roundtrip-JSON.');

    await page.getByTestId('btn-reset-seed').click();
    await expect(page.getByTestId('prompt-text')).toHaveValue(originalPrompt);
    await expect(page.getByTestId('editor-open-error')).toHaveCount(0);
  });

  test('blocks save when the logopedie question is empty', async ({ page }) => {
    const jsonPath = join(process.cwd(), 'resources', 'scenarios', 'logopedie.json');
    await page.goto('editor.html');
    await page.getByTestId('prompt-text').fill('');
    await expect(page.getByTestId('editor-issues-list')).toContainText('stap zonder vraagtekst');
    await page.getByTestId('btn-save-json').click();
    await expect(page.getByTestId('dialog-save-blocked')).toBeVisible();
    await expect(page.getByTestId('dialog-save-blocked-list')).toContainText(
      'stap zonder vraagtekst',
    );
    expect(existsSync(jsonPath)).toBe(false);
    await page.getByTestId('btn-save-blocked-close').click();
    await expect(page.getByTestId('dialog-save-blocked')).toHaveCount(0);
  });

  test('exports a logopedie package and imports texts and media after reset', async ({ page }) => {
    cleanupExports('logopedie-');
    try {
      await page.goto('editor.html');
      await expect(page.getByTestId('btn-export-package')).toBeVisible();
      await expect(page.getByTestId('btn-import-package')).toBeVisible();
      await expect(page.getByTestId('btn-open-json')).toBeVisible();
      await expect(page.getByTestId('btn-download-json')).toBeVisible();
      await page.getByTestId('prompt-text').fill('Tekst voor export-pakket.');
      await page.getByTestId('btn-export-package').click();
      await expect(page.getByTestId('editor-save-ok')).toContainText('exports/');
      const zipPath = latestExportZip('logopedie-');
      expect(existsSync(zipPath)).toBe(true);

      await page.getByTestId('btn-reset-seed').click();
      await expect(page.getByTestId('prompt-text')).not.toHaveValue('Tekst voor export-pakket.');
      await page.getByTestId('input-import-package').setInputFiles(zipPath);
      await expect(page.getByTestId('prompt-text')).toHaveValue('Tekst voor export-pakket.');
      await expect(page.getByTestId('logopedie-avatar')).toBeVisible();
      await expect(page.getByTestId('editor-preview-stage')).not.toHaveCSS('transform', /scale/);
    } finally {
      cleanupExports('logopedie-');
    }
  });

  test('saves JSON for this copy, then falls back without a white screen', async ({ page }) => {
    const scenariosDir = join(process.cwd(), 'resources', 'scenarios');
    const jsonPath = join(scenariosDir, 'logopedie.json');
    const bakPath = join(scenariosDir, 'logopedie.json.bak');
    const distJsonPath = join(process.cwd(), 'dist', 'resources', 'scenarios', 'logopedie.json');
    const distBakPath = join(process.cwd(), 'dist', 'resources', 'scenarios', 'logopedie.json.bak');
    const originalPrompt = 'Hallo... u bent... eh... de... logopedie? Ja.';
    const editedPrompt = 'Vraag opgeslagen voor de kopie-simulator.';

    const cleanup = () => {
      for (const file of [jsonPath, bakPath, distJsonPath, distBakPath]) {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      }
    };
    cleanup();

    try {
      await page.goto('editor.html');
      await expect(page.getByTestId('screen-scenario-editor')).toBeVisible();
      await page.getByTestId('prompt-text').fill(editedPrompt);
      await page.getByTestId('btn-save-json').click();
      await expect(page.getByTestId('editor-save-ok')).toBeVisible();
      expect(existsSync(jsonPath)).toBe(true);
      const saved = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
        scenario: { nodes: Array<{ prompt: { text: string } }> };
      };
      expect(saved.scenario.nodes[0]?.prompt.text).toBe(editedPrompt);
      const served = await page.request.get('resources/scenarios/logopedie.json');
      expect(served.ok()).toBe(true);
      const servedBody = (await served.json()) as {
        scenario: { nodes: Array<{ prompt: { text: string } }> };
      };
      expect(servedBody.scenario.nodes[0]?.prompt.text).toBe(editedPrompt);

      await page.goto('/');
      await expect(page.getByTestId('screen-home')).toBeVisible();
      await expect(page.getByTestId('screen-error')).toHaveCount(0);
      await page.getByTestId('btn-module-logopedie').click();
      await chooseDefaultScenario(page);
      await page.getByTestId('btn-start-simulation').click();
      await page.getByTestId('btn-start-intake').click();
      await expect(page.getByTestId('client-response')).toHaveText(editedPrompt);
      await page.evaluate(() => window.localStorage.clear());

      mkdirSync(scenariosDir, { recursive: true });
      writeFileSync(jsonPath, '{niet-geldig', 'utf8');
      await page.goto('/');
      await expect(page.getByTestId('screen-home')).toBeVisible();
      await expect(page.getByTestId('screen-error')).toHaveCount(0);
      await page.getByTestId('btn-module-nursing').click();
      await expect(page.getByTestId('screen-nursing-catalog')).toBeVisible();
      await page.goto('/');
      await page.getByTestId('btn-module-logopedie').click();
      await chooseDefaultScenario(page);
      await page.getByTestId('btn-start-simulation').click();
      await page.getByTestId('btn-start-intake').click();
      await expect(page.getByTestId('client-response')).toHaveText(originalPrompt);

      unlinkSync(jsonPath);
      if (existsSync(distJsonPath)) {
        unlinkSync(distJsonPath);
      }
      await page.goto('/');
      await expect(page.getByTestId('screen-home')).toBeVisible();
      await expect(page.getByTestId('screen-error')).toHaveCount(0);
    } finally {
      cleanup();
    }
  });

  test('loads the extra sentence from logopedie.json when the editor opens', async ({ page }) => {
    const extra = 'Extra zin uit logopedie.json.';
    const seedPrompt = 'Hallo... u bent... eh... de... logopedie? Ja.';
    await page.goto('editor.html');
    await expect(page.getByTestId('screen-scenario-editor')).toBeVisible();
    await expect(page.getByTestId('editor-loaded-source')).toHaveText('Geladen: startkopie');
    await page.getByTestId('prompt-text').fill(extra);
    await page.getByTestId('btn-save-json').click();
    await expect(page.getByTestId('editor-save-ok')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('prompt-text')).toHaveValue(extra);
    await expect(page.getByTestId('editor-loaded-source')).toHaveText('Geladen: logopedie.json');
    await expect(page.getByTestId('btn-open-json')).toBeVisible();
    await expect(page.getByTestId('btn-download-json')).toBeVisible();

    await page.getByTestId('btn-reset-seed').click();
    await expect(page.getByTestId('prompt-text')).toHaveValue(seedPrompt);
    await expect(page.getByTestId('editor-loaded-source')).toHaveText('Geladen: startkopie');

    writeFileSync(join(process.cwd(), 'resources', 'scenarios', 'logopedie.json'), '{niet-geldig');
    await page.reload();
    await expect(page.getByTestId('screen-scenario-editor')).toBeVisible();
    await expect(page.getByTestId('prompt-text')).toHaveValue(seedPrompt);
    await expect(page.getByTestId('editor-loaded-source')).toHaveText('Geladen: startkopie');
    await expect(page.getByTestId('editor-load-notice')).toContainText('ongeldig');
    await expect(page.getByTestId('screen-error')).toHaveCount(0);
  });

  test('replaces a logopedie still, previews it, and shows it in this copy after save', async ({
    page,
  }) => {
    const relative = join('logopedie', 'avatar', 'generated', 'erik', 'gefrustreerd.png');
    const original = join(process.cwd(), 'resources', relative);
    const bak = `${original}.bak`;
    const distCopy = join(process.cwd(), 'dist', 'resources', relative);
    const nursingVideo = join(process.cwd(), 'resources', 'verpleegkunde', 'Staat is pijn.mp4');
    const nursingSize = statSync(nursingVideo).size;
    const originalBytes = readFileSync(original);
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const restore = () => {
      writeFileSync(original, originalBytes);
      if (existsSync(distCopy)) {
        writeFileSync(distCopy, originalBytes);
      }
      if (existsSync(bak)) {
        unlinkSync(bak);
      }
      spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'generate-media-manifest.mjs')], {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
      for (const leftover of [
        join(process.cwd(), 'resources', 'scenarios', 'logopedie.json'),
        join(process.cwd(), 'resources', 'scenarios', 'logopedie.json.bak'),
        join(process.cwd(), 'dist', 'resources', 'scenarios', 'logopedie.json'),
      ]) {
        if (existsSync(leftover)) {
          unlinkSync(leftover);
        }
      }
    };

    try {
      await page.goto('editor.html');
      await expect(page.getByTestId('editor-media')).toBeVisible();
      await page.getByTestId('media-row-logopedie_avatar_generated_erik_gefrustreerd.png').click();
      await page.getByTestId('btn-media-replace').click();
      await page.getByTestId('input-media-replace').setInputFiles({
        name: 'gefrustreerd.png',
        mimeType: 'image/png',
        buffer: tinyPng,
      });
      await expect(page.getByTestId('editor-media-preview-image')).toBeVisible();
      await expect(page.getByTestId('editor-preview-stage')).not.toHaveCSS('transform', /scale/);
      await page.getByTestId('btn-save-json').click();
      await expect(page.getByTestId('editor-save-ok')).toBeVisible();
      expect(statSync(original).size).toBe(tinyPng.length);
      expect(existsSync(bak)).toBe(true);

      const served = await page.request.get(
        'resources/logopedie/avatar/generated/erik/gefrustreerd.png',
      );
      expect(served.ok()).toBe(true);
      expect((await served.body()).length).toBe(tinyPng.length);

      await page.goto('/');
      await expect(page.getByTestId('screen-home')).toBeVisible();
      await page.getByTestId('btn-module-logopedie').click();
      await chooseDefaultScenario(page);
      await page.getByTestId('btn-start-simulation').click();
      await page.getByTestId('btn-start-intake').click();
      await expect(page.getByTestId('screen-simulation')).toBeVisible();
      const simImage = await page.request.get(
        'resources/logopedie/avatar/generated/erik/gefrustreerd.png',
      );
      expect((await simImage.body()).length).toBe(tinyPng.length);
      expect(statSync(nursingVideo).size).toBe(nursingSize);
    } finally {
      restore();
    }
  });
});

function nursingJsonFiles(): string[] {
  return [
    join(process.cwd(), 'resources', 'scenarios', 'verpleegkunde.json'),
    join(process.cwd(), 'resources', 'scenarios', 'verpleegkunde.json.bak'),
    join(process.cwd(), 'dist', 'resources', 'scenarios', 'verpleegkunde.json'),
    join(process.cwd(), 'dist', 'resources', 'scenarios', 'verpleegkunde.json.bak'),
  ];
}

function cleanupNursingJson(): void {
  for (const file of nursingJsonFiles()) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
}

function cleanupExports(prefix: string): void {
  const dir = join(process.cwd(), 'exports');
  if (!existsSync(dir)) {
    return;
  }
  for (const name of readdirSync(dir)) {
    if (name.startsWith(prefix)) {
      rmSync(join(dir, name), { recursive: true, force: true });
    }
  }
}

function latestExportZip(prefix: string): string {
  const dir = join(process.cwd(), 'exports');
  const names = existsSync(dir)
    ? readdirSync(dir).filter((name) => name.startsWith(prefix) && name.endsWith('.zip'))
    : [];
  names.sort();
  const last = names.at(-1);
  if (!last) {
    throw new Error(`Geen export-zip gevonden voor ${prefix}`);
  }
  return join(dir, last);
}

test.describe('verpleegkunde scenario editor', () => {
  test.beforeEach(() => {
    cleanupNursingJson();
    cleanupLogopedieJson();
  });
  test.afterEach(() => {
    cleanupNursingJson();
    cleanupLogopedieJson();
  });

  test('switches module, saves JSON, and the copy-simulator shows the new question', async ({
    page,
  }) => {
    const originalQuestion = 'Wat is nu je eerste actie bij de luchtweg?';
    const editedQuestion = 'Vraag opgeslagen voor de verpleegkunde-kopie.';
    const jsonPath = join(process.cwd(), 'resources', 'scenarios', 'verpleegkunde.json');
    const bakPath = `${jsonPath}.bak`;
    const firstSave = 'Eerste opslag voor verpleegkunde-kopie.';

    await page.goto('editor.html');
    await expect(page.getByTestId('screen-scenario-editor')).toBeVisible();
    await expect(page.getByTestId('editor-module-logopedie')).toBeVisible();
    await page.getByTestId('editor-module-nursing').click();
    await expect(page.getByTestId('nursing-question')).toBeVisible();
    await expect(page.getByTestId('nursing-weights-readonly')).toBeVisible();
    await page.getByTestId('nursing-question').fill(firstSave);
    await page.getByTestId('btn-save-json').click();
    await expect(page.getByTestId('editor-save-ok')).toBeVisible();
    await page.getByTestId('nursing-question').fill(editedQuestion);
    await expect(page.getByTestId('preview-nursing-question')).toHaveText(editedQuestion);
    await page.getByTestId('btn-save-json').click();
    await expect(page.getByTestId('editor-save-ok')).toBeVisible();
    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(bakPath)).toBe(true);
    const saved = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
      module: string;
      steps: Array<{ question: string }>;
    };
    expect(saved.module).toBe('verpleegkunde');
    expect(saved.steps[0]?.question).toBe(editedQuestion);

    await page.goto('/');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('screen-error')).toHaveCount(0);
    await page.getByTestId('btn-module-nursing').click();
    await chooseDefaultScenario(page);
    await page.getByTestId('btn-start-nursing').click();
    await page.getByTestId('btn-start-nursing-sim').click();
    await expect(page.getByTestId('nursing-step-question')).toHaveText(editedQuestion);
    await page.evaluate(() => window.localStorage.clear());

    await page.goto('/');
    await page.getByTestId('btn-module-logopedie').click();
    await expect(page.getByTestId('screen-logopedie-catalog')).toBeVisible();

    writeFileSync(jsonPath, '{niet-geldig', 'utf8');
    await page.goto('/');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('screen-error')).toHaveCount(0);
    await page.getByTestId('btn-module-nursing').click();
    await chooseDefaultScenario(page);
    await page.getByTestId('btn-start-nursing').click();
    await page.getByTestId('btn-start-nursing-sim').click();
    await expect(page.getByTestId('nursing-step-question')).toHaveText(originalQuestion);
  });

  test('loads verpleegkunde.json in the editor and keeps logopedie working', async ({ page }) => {
    await page.goto('editor.html');
    await page.getByTestId('editor-module-nursing').click();
    await page.getByTestId('nursing-question').fill('Extra zin uit verpleegkunde.json.');
    await page.getByTestId('btn-save-json').click();
    await expect(page.getByTestId('editor-save-ok')).toBeVisible();

    await page.reload();
    await page.getByTestId('editor-module-nursing').click();
    await expect(page.getByTestId('nursing-question')).toHaveValue(
      'Extra zin uit verpleegkunde.json.',
    );
    await expect(page.getByTestId('editor-loaded-source')).toHaveText(
      'Geladen: verpleegkunde.json',
    );

    await page.getByTestId('editor-module-logopedie').click();
    await expect(page.getByTestId('prompt-text')).toBeVisible();
    await expect(page.getByTestId('logopedie-avatar')).toBeVisible();
    await expect(page.getByTestId('editor-preview-stage')).not.toHaveCSS('transform', /scale/);
  });

  test('asks confirmation before deleting verpleegkunde media and does not use logopedie', async ({
    page,
  }) => {
    const pain = join(process.cwd(), 'resources', 'verpleegkunde', 'Staat is pijn.mp4');
    const painSize = statSync(pain).size;
    const erik = join(process.cwd(), 'resources', 'logopedie', 'avatar', 'erik_basis.png');
    const erikSize = statSync(erik).size;

    await page.goto('editor.html');
    await page.getByTestId('editor-module-nursing').click();
    await expect(page.getByTestId('editor-nursing-media')).toBeVisible();
    await page.getByTestId('nursing-media-row-verpleegkunde_Staat is pijn.mp4').click();
    await page.getByTestId('btn-nursing-media-delete').click();
    await expect(page.getByTestId('dialog-delete-nursing-media')).toBeVisible();
    await page.getByTestId('btn-cancel-delete-nursing-media').click();
    await expect(page.getByTestId('dialog-delete-nursing-media')).toHaveCount(0);
    expect(statSync(pain).size).toBe(painSize);
    expect(statSync(erik).size).toBe(erikSize);
    await expect(page.getByTestId('editor-media')).toHaveCount(0);
  });

  test('blocks save when a Verpleegkunde step has no video', async ({ page }) => {
    const jsonPath = join(process.cwd(), 'resources', 'scenarios', 'verpleegkunde.json');
    await page.goto('editor.html');
    await page.getByTestId('editor-module-nursing').click();
    await page.getByTestId('btn-nursing-step-unlink').click();
    await expect(page.getByTestId('editor-nursing-issues-list')).toContainText('zonder video');
    await page.getByTestId('btn-save-json').click();
    await expect(page.getByTestId('dialog-save-blocked')).toBeVisible();
    await expect(page.getByTestId('dialog-save-blocked-list')).toContainText('zonder video');
    expect(existsSync(jsonPath)).toBe(false);
  });

  test('exports a verpleegkunde package and imports the question after reset', async ({ page }) => {
    cleanupExports('verpleegkunde-');
    try {
      await page.goto('editor.html');
      await page.getByTestId('editor-module-nursing').click();
      await page.getByTestId('nursing-question').fill('Vraag uit export-pakket.');
      await page.getByTestId('btn-export-package').click();
      await expect(page.getByTestId('editor-save-ok')).toContainText('exports/');
      const zipPath = latestExportZip('verpleegkunde-');
      expect(existsSync(zipPath)).toBe(true);

      await page.getByTestId('btn-reset-seed').click();
      await expect(page.getByTestId('nursing-question')).not.toHaveValue(
        'Vraag uit export-pakket.',
      );
      await page.getByTestId('input-import-package').setInputFiles(zipPath);
      await expect(page.getByTestId('nursing-question')).toHaveValue('Vraag uit export-pakket.');
      await expect(page.getByTestId('nursing-step-video-player')).toBeVisible();
    } finally {
      cleanupExports('verpleegkunde-');
    }
  });

  test('replaces the first step video, saves, and the copy-simulator serves the new file', async ({
    page,
  }) => {
    const folder = join(process.cwd(), 'resources', 'verpleegkunde');
    const airwayName = readdirSync(folder).find(
      (name) => name.includes('luchtweg') || name.includes('Airway'),
    );
    const koortsName = readdirSync(folder).find((name) => name.includes('koorts'));
    expect(airwayName).toBeTruthy();
    expect(koortsName).toBeTruthy();
    if (!airwayName || !koortsName) {
      throw new Error('Verpleegkunde-video’s ontbreken in resources/verpleegkunde/.');
    }
    const airway = join(folder, airwayName);
    const koorts = join(folder, koortsName);
    const bak = `${airway}.bak`;
    const distAirway = join(process.cwd(), 'dist', 'resources', 'verpleegkunde', airwayName);
    const original = readFileSync(airway);
    const replacement = readFileSync(koorts);
    const erik = join(process.cwd(), 'resources', 'logopedie', 'avatar', 'erik_basis.png');
    const erikSize = statSync(erik).size;

    const restore = () => {
      writeFileSync(airway, original);
      if (existsSync(distAirway)) {
        writeFileSync(distAirway, original);
      }
      if (existsSync(bak)) {
        unlinkSync(bak);
      }
    };

    try {
      await page.goto('editor.html');
      await page.getByTestId('editor-module-nursing').click();
      await expect(page.getByTestId('nursing-step-video')).toBeVisible();
      await expect(page.getByTestId('nursing-step-video-path')).toContainText('verpleegkunde/');
      await page.getByTestId('input-nursing-step-replace').setInputFiles({
        name: airwayName,
        mimeType: 'video/mp4',
        buffer: replacement,
      });
      await expect(page.getByTestId('nursing-step-video-player')).toBeVisible();
      await page.getByTestId('btn-save-json').click();
      await expect(page.getByTestId('editor-save-ok')).toBeVisible();
      expect(statSync(airway).size).toBe(replacement.length);
      expect(existsSync(bak)).toBe(true);
      expect(statSync(erik).size).toBe(erikSize);

      await page.goto('/');
      await expect(page.getByTestId('screen-home')).toBeVisible();
      await expect(page.getByTestId('screen-error')).toHaveCount(0);
      await page.getByTestId('btn-module-nursing').click();
      await chooseDefaultScenario(page);
      await page.getByTestId('btn-start-nursing').click();
      await page.getByTestId('btn-start-nursing-sim').click();
      await expect(page.getByTestId('screen-nursing-simulation')).toBeVisible();
      await expect(page.getByTestId('nursing-video-fallback')).toHaveCount(0);
      const video = page.getByTestId('patient-video');
      await expect(video).toBeVisible();
      const src = await video.getAttribute('src');
      expect(src).toContain('verpleegkunde');
      expect(src).not.toContain('logopedie');
      const served = await page.request.get(
        `resources/verpleegkunde/${encodeURIComponent(airwayName)}`,
      );
      expect(served.ok()).toBe(true);
      expect((await served.body()).length).toBe(replacement.length);
    } finally {
      restore();
    }
  });
});
