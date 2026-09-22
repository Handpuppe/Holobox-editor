import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { choose, fillConclusion, highConclusion, highOptions, startIntake } from './helpers';

async function expectNoSerious(page: Parameters<typeof startIntake>[0]) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter(
    (item) => item.impact === 'serious' || item.impact === 'critical',
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe('accessibility @a11y', () => {
  test('home and briefing have no serious violations', async ({ page }) => {
    await page.goto('/');
    await expectNoSerious(page);
    await page.getByTestId('btn-module-logopedie').click();
    await page.getByTestId('btn-scenario-tile-default').click();
    await page.getByTestId('btn-start-simulation').click();
    await expectNoSerious(page);
  });

  test('simulation, conclusion and results have no serious violations', async ({ page }) => {
    await startIntake(page);
    await expectNoSerious(page);
    for (const optionId of highOptions) {
      await choose(page, optionId);
    }
    await expectNoSerious(page);
    await fillConclusion(page, highConclusion);
    await expectNoSerious(page);
  });

  test('dialogs trap focus', async ({ page }) => {
    await startIntake(page);
    await page.getByTestId('btn-notes').click();
    const dialog = page.getByTestId('dialog-notes');
    await expect(dialog).toBeVisible();
    const focused = dialog.locator(':focus');
    await expect(focused).toHaveCount(1);
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      await expect(dialog).toContainText('Notities');
      const inside = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="dialog-notes"]');
        return Boolean(root && document.activeElement && root.contains(document.activeElement));
      });
      expect(inside).toBe(true);
    }
  });
});
