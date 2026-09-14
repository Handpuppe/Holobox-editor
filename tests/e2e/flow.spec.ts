import { expect, test } from '@playwright/test';
import {
  choose,
  fillConclusion,
  highConclusion,
  highNursingOptions,
  highOptions,
  lowConclusion,
  lowOptions,
  mixedConclusion,
  mixedOptions,
  startIntake,
} from './helpers';

test.describe('core simulation routes', () => {
  test('complete ideal route with a high score', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await startIntake(page);
    for (const optionId of highOptions) {
      await choose(page, optionId);
    }
    await fillConclusion(page, highConclusion);
    await expect(page.getByTestId('screen-results')).toBeVisible();
    await expect(page.getByTestId('score-value')).toHaveText('100');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('complete inappropriate route with targeted feedback', async ({ page }) => {
    await startIntake(page);
    for (const optionId of lowOptions) {
      await choose(page, optionId);
    }
    await fillConclusion(page, lowConclusion);
    await expect(page.getByTestId('screen-results')).toBeVisible();
    await expect(page.getByTestId('score-value')).toHaveText('0');
    await expect(page.getByTestId('improvements')).toBeVisible();
    await expect(page.getByTestId('observation-feedback')).not.toBeEmpty();
  });

  test('mixed route with correct competency totals', async ({ page }) => {
    await startIntake(page);
    for (const optionId of mixedOptions) {
      await choose(page, optionId);
    }
    await fillConclusion(page, mixedConclusion);
    await expect(page.getByTestId('screen-results')).toBeVisible();
    const total = Number(await page.getByTestId('score-value').innerText());
    expect(total).toBeGreaterThan(40);
    expect(total).toBeLessThan(90);
    await expect(page.getByTestId('competency-scores')).toContainText('Aangepaste communicatie');
  });

  test('pause, reload and resume', async ({ page }) => {
    await startIntake(page);
    await choose(page, 'd1-high');
    await page.getByTestId('btn-pause').click();
    await expect(page.getByTestId('dialog-pause')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('screen-simulation')).toBeVisible();
    await expect(page.getByTestId('dialog-pause')).toBeVisible();
    await page.getByTestId('btn-resume').click();
    await expect(page.getByTestId('conversation-phase')).toContainText('Hulpvraag');
  });

  test('save and reopen a result', async ({ page }) => {
    await startIntake(page);
    for (const optionId of highOptions) {
      await choose(page, optionId);
    }
    await fillConclusion(page, highConclusion);
    await page.getByTestId('btn-save-result').click();
    await expect(page.getByTestId('save-message')).toContainText('lokaal opgeslagen');
    await page.getByTestId('btn-results-home').click();
    await page.getByTestId('btn-previous-results').click();
    await expect(page.getByTestId('screen-history')).toBeVisible();
    await page.getByRole('button', { name: 'Bekijk resultaat' }).click();
    await expect(page.getByTestId('screen-results')).toBeVisible();
    await expect(page.getByTestId('score-value')).toHaveText('100');
  });

  test('delete a saved result', async ({ page }) => {
    await startIntake(page);
    for (const optionId of highOptions) {
      await choose(page, optionId);
    }
    await fillConclusion(page, highConclusion);
    await page.getByTestId('btn-save-result').click();
    await page.getByTestId('btn-results-home').click();
    await page.getByTestId('btn-previous-results').click();
    await page.getByRole('button', { name: 'Verwijder resultaat' }).click();
    await expect(page.getByTestId('dialog-delete')).toBeVisible();
    await page.getByTestId('btn-confirm-delete').click();
    await expect(page.getByTestId('empty-history')).toBeVisible();
  });

  test('reject an incomplete clinical conclusion', async ({ page }) => {
    await startIntake(page);
    await page.getByTestId('btn-end').click();
    await page.getByTestId('btn-confirm-end').click();
    await expect(page.getByTestId('screen-conclusion')).toBeVisible();
    await page.getByTestId('btn-submit-conclusion').click();
    await expect(page.getByTestId('screen-conclusion')).toBeVisible();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('complete the critical flow using the keyboard only', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('btn-module-logopedie').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('btn-start-simulation').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('screen-briefing')).toBeVisible();
    await page.getByTestId('btn-start-intake').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('screen-simulation')).toBeVisible();
    for (const optionId of highOptions) {
      const option = page.getByTestId(`option-${optionId}`);
      await option.focus();
      await page.keyboard.press('Enter');
      await expect(option).toBeHidden({ timeout: 5000 });
    }
    await expect(page.getByTestId('screen-conclusion')).toBeVisible();
    await page.keyboard.press('Tab');
    await fillConclusion(page, highConclusion);
    await expect(page.getByTestId('screen-results')).toBeVisible();
  });

  test('recover safely from corrupted local storage', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('holobox-zorgsimulator-v2', '{broken');
    });
    await page.goto('/');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('storage-notice')).toBeVisible();
    await page.getByTestId('btn-module-logopedie').click();
    await page.getByTestId('btn-start-simulation').click();
    await expect(page.getByTestId('screen-briefing')).toBeVisible();
  });

  test('nursing ABCDE/SBAR ideal route stays within the 80/20 layout', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('btn-module-nursing').click();
    await page.getByTestId('btn-start-nursing').click();
    await page.getByTestId('btn-start-nursing-sim').click();
    await expect(page.getByTestId('screen-nursing-simulation')).toBeVisible();
    const panel = await page.getByTestId('question-panel').boundingBox();
    const patient = await page.getByTestId('patient-area').boundingBox();
    expect(panel?.width ?? 999).toBeLessThanOrEqual(216);
    expect(patient?.width ?? 999).toBeLessThanOrEqual(864);
    for (const optionId of highNursingOptions) {
      await choose(page, optionId);
    }
    await expect(page.getByTestId('screen-nursing-results')).toBeVisible();
    await expect(page.getByTestId('score-value')).toHaveText('100');
  });

  test('open an unknown route and recover to a valid screen', async ({ page }) => {
    await page.goto('bestaat-niet');
    await expect(page.getByTestId('screen-error')).toBeVisible();
    await page.getByTestId('btn-error-home').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();
  });
});
