import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aphasiaIntakeScenario } from './data/aphasiaIntakeScenario';
import { conclusionByQuality, optionIdsByQuality } from './domain/playthrough';
import { STORAGE_KEY } from './storage/storageService';
import { renderApp } from './test/renderApp';

function mockReducedMotion() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

async function startIntake(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('btn-module-logopedie'));
  await user.click(screen.getByTestId('btn-start-simulation'));
  expect(screen.getByTestId('screen-briefing')).toBeInTheDocument();
  await user.click(screen.getByTestId('btn-start-intake'));
  expect(screen.getByTestId('screen-simulation')).toBeInTheDocument();
}

async function choose(user: ReturnType<typeof userEvent.setup>, optionId: string) {
  const button = screen.getByTestId(`option-${optionId}`);
  await user.click(button);
  await waitFor(() => {
    expect(screen.queryByTestId(`option-${optionId}`)).not.toBeInTheDocument();
  });
}

describe('application flow', () => {
  beforeEach(() => {
    mockReducedMotion();
    window.localStorage.clear();
  });

  it('starts a simulation from the home screen', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByTestId('screen-home')).toBeInTheDocument();
    expect(screen.getByTestId('app-version')).toBeInTheDocument();
    expect(screen.getByTestId('app-credit')).toHaveTextContent('Made by Rutger van Horssen');
    await startIntake(user);
    expect(screen.getByTestId('virtual-client')).toBeInTheDocument();
    const avatar = screen.getByTestId('logopedie-avatar');
    expect(avatar).toHaveAttribute('data-avatar-variant', 'onzeker');
    expect(screen.queryByTestId('logopedie-anim-debug')).not.toBeInTheDocument();
    expect(screen.getByTestId('logopedie-avatar-image').getAttribute('src')).toContain(
      'generated/erik/onzeker.png',
    );
    expect(screen.queryByTestId('fullbody-erik')).not.toBeInTheDocument();
    expect(screen.getByTestId('client-response')).toBeVisible();
  });

  it('selects a response, blocks double selection, and moves to the next node', async () => {
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    const first = screen.getByTestId('option-d1-high');
    await user.click(first);
    expect(first).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByTestId('option-d2-high')).toBeInTheDocument();
    });
    expect(screen.getByTestId('conversation-phase')).toHaveTextContent('Hulpvraag');
  });

  it('opens and saves notes', async () => {
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    await user.click(screen.getByTestId('btn-notes'));
    const dialog = screen.getByTestId('dialog-notes');
    const field = within(dialog).getByTestId('note-presentingConcern');
    await user.type(field, 'Woordvinding is lastig');
    await user.click(within(dialog).getByTestId('btn-save-notes'));
    await waitFor(() => {
      expect(screen.queryByTestId('dialog-notes')).not.toBeInTheDocument();
    });
  });

  it('pauses and resumes', async () => {
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    await user.click(screen.getByTestId('btn-pause'));
    expect(screen.getByTestId('dialog-pause')).toBeInTheDocument();
    await user.click(screen.getByTestId('btn-resume'));
    await waitFor(() => {
      expect(screen.queryByTestId('dialog-pause')).not.toBeInTheDocument();
    });
  });

  it('restores an unfinished session after reload', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await startIntake(user);
    await choose(user, 'd1-high');
    first.unmount();
    renderApp(['/logopedie']);
    expect(screen.getByTestId('dialog-resume')).toBeInTheDocument();
    await user.click(screen.getByTestId('btn-resume-session'));
    expect(screen.getByTestId('screen-simulation')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-phase')).toHaveTextContent('Hulpvraag');
  });

  it('completes the clinical conclusion and shows scores', async () => {
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    for (const optionId of optionIdsByQuality(aphasiaIntakeScenario, 'high')) {
      await choose(user, optionId);
    }
    expect(await screen.findByTestId('screen-conclusion')).toBeInTheDocument();
    const conclusion = conclusionByQuality(aphasiaIntakeScenario, 'high');
    await user.click(screen.getByTestId(`conclusion-${conclusion.primaryDifficulty}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.dailyLifeEffect}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.clientStrengths}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.firstObjective}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.nextStep}`));
    await user.type(
      screen.getByTestId('conclusion-text-dailyLifeEffect'),
      conclusion.freeText.dailyLifeEffect,
    );
    await user.type(
      screen.getByTestId('conclusion-text-firstObjective'),
      conclusion.freeText.firstObjective,
    );
    await user.click(screen.getByTestId('btn-submit-conclusion'));
    expect(await screen.findByTestId('screen-results')).toBeInTheDocument();
    expect(screen.getByTestId('score-value')).toHaveTextContent('100');
  });

  it('saves, reopens and deletes a result after confirmation', async () => {
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    for (const optionId of optionIdsByQuality(aphasiaIntakeScenario, 'high')) {
      await choose(user, optionId);
    }
    expect(await screen.findByTestId('screen-conclusion')).toBeInTheDocument();
    const conclusion = conclusionByQuality(aphasiaIntakeScenario, 'high');
    await user.click(screen.getByTestId(`conclusion-${conclusion.primaryDifficulty}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.dailyLifeEffect}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.clientStrengths}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.firstObjective}`));
    await user.click(screen.getByTestId(`conclusion-${conclusion.nextStep}`));
    await user.type(
      screen.getByTestId('conclusion-text-dailyLifeEffect'),
      conclusion.freeText.dailyLifeEffect,
    );
    await user.type(
      screen.getByTestId('conclusion-text-firstObjective'),
      conclusion.freeText.firstObjective,
    );
    await user.click(screen.getByTestId('btn-submit-conclusion'));
    await user.click(await screen.findByTestId('btn-save-result'));
    expect(screen.getByTestId('save-message')).toHaveTextContent('lokaal opgeslagen');
    await user.click(screen.getByTestId('btn-results-home'));
    await user.click(screen.getByTestId('btn-previous-results'));
    const viewButton = screen.getByRole('button', { name: 'Bekijk resultaat' });
    await user.click(viewButton);
    expect(await screen.findByTestId('screen-results')).toBeInTheDocument();
    await user.click(screen.getByTestId('btn-results-home'));
    await user.click(screen.getByTestId('btn-previous-results'));
    await user.click(screen.getByRole('button', { name: 'Verwijder resultaat' }));
    await user.click(screen.getByTestId('btn-confirm-delete'));
    expect(screen.getByTestId('empty-history')).toBeInTheDocument();
  });

  it('rejects an incomplete clinical conclusion', async () => {
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    await user.click(screen.getByTestId('btn-end'));
    await user.click(screen.getByTestId('btn-confirm-end'));
    expect(await screen.findByTestId('screen-conclusion')).toBeInTheDocument();
    await user.click(screen.getByTestId('btn-submit-conclusion'));
    expect(screen.getByTestId('screen-conclusion')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('goes from the logopedie conclusion to the hub in one click', async () => {
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    await user.click(screen.getByTestId('btn-end'));
    await user.click(screen.getByTestId('btn-confirm-end'));
    expect(await screen.findByTestId('screen-conclusion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoofdmenu' })).toBeInTheDocument();
    await user.click(screen.getByTestId('btn-conclusion-home'));
    expect(screen.getByTestId('screen-home')).toBeInTheDocument();
    expect(screen.getByTestId('btn-module-logopedie')).toBeInTheDocument();
    expect(screen.getByTestId('btn-module-nursing')).toBeInTheDocument();
  });

  it('supports keyboard navigation on the home screen', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.tab();
    expect(document.getElementById('inhoud')).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('btn-module-logopedie')).toHaveFocus();
  });

  it('falls back when storage is unavailable', async () => {
    const proto = Storage.prototype;
    vi.spyOn(proto, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(proto, 'getItem').mockImplementation(() => {
      throw new Error('quota');
    });
    renderApp();
    expect(screen.getByTestId('storage-unavailable')).toBeInTheDocument();
  });

  it('recovers from corrupted local storage', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken');
    renderApp();
    expect(screen.getByTestId('screen-home')).toBeInTheDocument();
    expect(screen.getByTestId('storage-notice')).toBeInTheDocument();
  });

  it('does not animate the client when reduced motion is requested', () => {
    renderApp(['/laden']);
    expect(screen.getByTestId('screen-loading')).toBeInTheDocument();
    const svg = document.querySelector('.client-svg');
    expect(svg).toBeNull();
  });
});

describe('logopedie answer stills', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    window.localStorage.clear();
  });

  it('shows three different static faces for high, partial and inappropriate answers', async () => {
    const user = userEvent.setup();
    const faces: Array<{ optionId: string; variant: string }> = [
      { optionId: 'd1-high', variant: 'opgelucht' },
      { optionId: 'd1-partial', variant: 'onzeker' },
      { optionId: 'd1-low', variant: 'gefrustreerd' },
    ];
    const seen = new Set<string>();
    for (const face of faces) {
      renderApp();
      await startIntake(user);
      await user.click(screen.getByTestId(`option-${face.optionId}`));
      const avatar = screen.getByTestId('logopedie-avatar');
      expect(avatar).toHaveAttribute('data-avatar-variant', face.variant);
      expect(screen.getByTestId('logopedie-avatar-image').getAttribute('src')).toContain(
        `generated/erik/${face.variant}.png`,
      );
      seen.add(face.variant);
      cleanup();
      window.localStorage.clear();
    }
    expect(seen.size).toBe(3);
  });
});

describe('reduced motion client', () => {
  it('renders the frustrated state without requiring hover', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    await user.click(screen.getByTestId('option-d1-low'));
    expect(screen.getByTestId('virtual-client')).toHaveAttribute('data-emotion', 'frustrated');
    expect(screen.getByTestId('client-response')).toHaveTextContent('Ik ben... geen kind');
  });
});

describe('focus management', () => {
  it('moves focus to the dialog when notes open', async () => {
    mockReducedMotion();
    const user = userEvent.setup();
    renderApp();
    await startIntake(user);
    await user.click(screen.getByTestId('btn-notes'));
    await waitFor(() => {
      const dialog = screen.getByTestId('dialog-notes');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });
});
