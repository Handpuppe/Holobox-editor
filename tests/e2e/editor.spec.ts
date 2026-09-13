import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.describe('logopedie scenario editor', () => {
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
});
