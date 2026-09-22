import { expect, test } from '@playwright/test';
import { choose, fillConclusion, highConclusion, highOptions } from './helpers';

async function shot(page: Parameters<typeof choose>[0], name: string): Promise<void> {
  await page.getByTestId('holobox-stage').screenshot({ path: `docs/screenshots/${name}.png` });
}

test.describe('visual screenshots @visual', () => {
  test('capture required 1080x1920 screens', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 });

    await page.goto('/');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await shot(page, 'home');

    await page.getByTestId('btn-module-logopedie').click();
    await page.getByTestId('btn-scenario-tile-default').click();
    await page.getByTestId('btn-start-simulation').click();
    await expect(page.getByTestId('screen-briefing')).toBeVisible();
    await shot(page, 'briefing');

    await page.getByTestId('btn-start-intake').click();
    await expect(page.getByTestId('virtual-client')).toHaveAttribute('data-emotion', 'neutral');
    await shot(page, 'simulation-neutral');

    await page.getByTestId('btn-notes').click();
    await expect(page.getByTestId('dialog-notes')).toBeVisible();
    await shot(page, 'notes');
    await page.getByRole('button', { name: 'Sluiten' }).click();

    for (const optionId of highOptions.slice(0, 6)) {
      await choose(page, optionId);
    }
    await expect(page.getByTestId('virtual-client')).toHaveAttribute('data-emotion', 'frustrated');
    await expect(page.getByTestId('conversation-phase')).toHaveText('Frustratie en vermoeidheid');
    await shot(page, 'simulation-frustrated');

    for (const optionId of highOptions.slice(6)) {
      await choose(page, optionId);
    }
    await expect(page.getByTestId('screen-conclusion')).toBeVisible();
    await shot(page, 'conclusion');

    await fillConclusion(page, highConclusion);
    await expect(page.getByTestId('score-value')).toBeVisible();
    await shot(page, 'results');
    await page.getByTestId('btn-save-result').click();
    await expect(page.getByTestId('save-message')).toBeVisible();
    await page.getByTestId('btn-results-home').click();
    await page.getByTestId('btn-previous-results').click();
    await expect(page.getByTestId('screen-history')).toBeVisible();
    await shot(page, 'history');

    await page.goto('/laden');
    await expect(page.getByTestId('screen-loading')).toBeVisible();
    await shot(page, 'loading');
    await page.goto('/storing');
    await expect(page.getByTestId('screen-error')).toBeVisible();
    await shot(page, 'error');
  });
});
