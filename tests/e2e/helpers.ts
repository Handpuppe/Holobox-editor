import { expect, type Page } from '@playwright/test';

export const WHITE = 'rgb(255, 255, 255)';

export async function assertWhiteBackground(
  page: Page,
  extraSelectors: string[] = [],
): Promise<void> {
  const selectors = [
    'html',
    'body',
    '#root',
    '[data-testid="holobox-viewport"]',
    '[data-testid="holobox-stage"]',
    ...extraSelectors,
  ];
  for (const selector of selectors) {
    const color = await page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(color, selector).toBe(WHITE);
  }
}

export async function startIntake(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('btn-module-logopedie').click();
  await page.getByTestId('btn-start-simulation').click();
  await expect(page.getByTestId('screen-briefing')).toBeVisible();
  await page.getByTestId('btn-start-intake').click();
  await expect(page.getByTestId('screen-simulation')).toBeVisible();
}

export async function choose(page: Page, optionId: string): Promise<void> {
  const option = page.getByTestId(`option-${optionId}`);
  await expect(option).toBeEnabled();
  await option.click();
  await expect(option).toBeHidden({ timeout: 5000 });
}

export async function fillConclusion(
  page: Page,
  ids: {
    primaryDifficulty: string;
    dailyLifeEffect: string;
    clientStrengths: string;
    firstObjective: string;
    nextStep: string;
  },
): Promise<void> {
  await expect(page.getByTestId('screen-conclusion')).toBeVisible();
  await page.getByTestId(`conclusion-${ids.primaryDifficulty}`).check();
  await page.getByTestId(`conclusion-${ids.dailyLifeEffect}`).check();
  await page.getByTestId(`conclusion-${ids.clientStrengths}`).check();
  await page.getByTestId(`conclusion-${ids.firstObjective}`).check();
  await page.getByTestId(`conclusion-${ids.nextStep}`).check();
  await page
    .getByTestId('conclusion-text-dailyLifeEffect')
    .fill('Gesprekken thuis en voorlezen zijn bemoeilijkt.');
  await page
    .getByTestId('conclusion-text-firstObjective')
    .fill('Communicatie met naasten functioneel ondersteunen.');
  await page.getByTestId('btn-submit-conclusion').click();
}

export const highConclusion = {
  primaryDifficulty: 'pd-high',
  dailyLifeEffect: 'dl-high',
  clientStrengths: 'cs-high',
  firstObjective: 'fo-high',
  nextStep: 'ns-high',
};

export const lowConclusion = {
  primaryDifficulty: 'pd-low',
  dailyLifeEffect: 'dl-low',
  clientStrengths: 'cs-low',
  firstObjective: 'fo-low',
  nextStep: 'ns-low',
};

export const mixedConclusion = {
  primaryDifficulty: 'pd-high',
  dailyLifeEffect: 'dl-partial',
  clientStrengths: 'cs-partial',
  firstObjective: 'fo-partial',
  nextStep: 'ns-high',
};

export const highOptions = [
  'd1-high',
  'd2-high',
  'd3-high',
  'd4-high',
  'd5-high',
  'd6-high',
  'd7-high',
  'd8-high',
];

export const lowOptions = [
  'd1-low',
  'd2-low',
  'd3-low',
  'd4-low',
  'd5-low',
  'd6-low',
  'd7-low',
  'd8-low',
];

export const highNursingOptions = [
  'n-a-high',
  'n-b-high',
  'n-c-high',
  'n-d-high',
  'n-e-high',
  'n-s-high',
  'n-bg-high',
  'n-as-high',
  'n-r-high',
  'n-k-high',
];

export const mixedOptions = [
  'd1-high',
  'd2-partial',
  'd3-high',
  'd4-partial',
  'd5-high',
  'd6-partial',
  'd7-high',
  'd8-partial',
];
