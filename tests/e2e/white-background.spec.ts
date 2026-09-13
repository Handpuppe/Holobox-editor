import { expect, test } from '@playwright/test';
import {
  assertWhiteBackground,
  choose,
  fillConclusion,
  highConclusion,
  highOptions,
  startIntake,
} from './helpers';

test.describe('white background @a11y', () => {
  test('home, briefing, loading and error stay white, including dark-scheme', async ({ page }) => {
    await page.goto('/');
    await assertWhiteBackground(page, ['[data-testid="screen-home"]']);
    await page.emulateMedia({ colorScheme: 'dark' });
    await assertWhiteBackground(page, ['[data-testid="screen-home"]']);
    const darkQuery = await page.evaluate(() => {
      const sheets = [...document.styleSheets];
      return sheets.some((sheet) => {
        try {
          return [...sheet.cssRules].some((rule) => {
            const text = rule.cssText;
            return (
              text.includes('prefers-color-scheme: dark') &&
              text.includes('background') &&
              (text.includes('#000') || text.includes('black') || text.includes('#111'))
            );
          });
        } catch {
          return false;
        }
      });
    });
    expect(darkQuery).toBe(false);

    await page.goto('/briefing');
    await assertWhiteBackground(page, ['[data-testid="screen-briefing"]']);
    await page.goto('/laden');
    await assertWhiteBackground(page, ['[data-testid="screen-loading"]']);
    await page.goto('/storing');
    await assertWhiteBackground(page, ['[data-testid="screen-error"]']);
  });

  test('simulation, pause, notes, conclusion, results and history stay white', async ({ page }) => {
    await startIntake(page);
    await assertWhiteBackground(page, ['[data-testid="screen-simulation"]']);
    await page.getByTestId('btn-notes').click();
    await assertWhiteBackground(page, [
      '[data-testid="dialog-notes"]',
      '[data-testid="dialog-notes-backdrop"]',
    ]);
    await page.getByRole('button', { name: 'Sluiten' }).click();
    await page.getByTestId('btn-pause').click();
    await assertWhiteBackground(page, ['[data-testid="dialog-pause"]']);
    await page.getByTestId('btn-resume').click();
    await choose(page, 'd1-low');
    await assertWhiteBackground(page, ['[data-testid="screen-simulation"]']);
    for (const optionId of highOptions.slice(1)) {
      await choose(page, optionId);
    }
    await fillConclusion(page, highConclusion);
    await assertWhiteBackground(page, ['[data-testid="screen-results"]']);
    await page.getByTestId('btn-save-result').click();
    await page.getByTestId('btn-results-home').click();
    await page.getByTestId('btn-previous-results').click();
    await assertWhiteBackground(page, ['[data-testid="screen-history"]']);
  });
});
