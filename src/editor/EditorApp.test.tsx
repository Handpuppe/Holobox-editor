import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { renderApp } from '../test/renderApp';
import { EditorApp } from './EditorApp';
import { envelopeJson, LOGOPEDIE_ENVELOPE_FILENAME } from './envelope';
import { cloneScenario } from './cloneScenario';
import { buildEditorPackageZip } from './scenarioPackage';

function fillNursingTexts(question: string) {
  fireEvent.change(screen.getByTestId('nursing-patient-name'), {
    target: { value: 'Testpatiënt' },
  });
  fireEvent.change(screen.getByTestId('nursing-education-type'), {
    target: { value: 'Eigen les' },
  });
  fireEvent.change(screen.getByTestId('nursing-step-name'), { target: { value: 'Stapnaam' } });
  fireEvent.change(screen.getByTestId('nursing-phase'), { target: { value: 'Fase' } });
  fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: question } });
  fireEvent.change(screen.getByTestId('nursing-option-text-n-1-high'), {
    target: { value: 'Goed antwoord' },
  });
  fireEvent.change(screen.getByTestId('nursing-option-text-n-1-partial'), {
    target: { value: 'Deels goed antwoord' },
  });
  fireEvent.change(screen.getByTestId('nursing-option-text-n-1-inappropriate'), {
    target: { value: 'Verkeerd antwoord' },
  });
}

describe('EditorApp', () => {
  it('edits a question on a clone, shows validation issues, and downloads JSON', async () => {
    const user = userEvent.setup();
    const originalPrompt = aphasiaIntakeScenario.nodes[0]?.prompt.text ?? '';
    const originalOption = aphasiaIntakeScenario.nodes[0]?.options[0]?.text ?? '';
    let captured: unknown;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      captured = value;
      return 'blob:editor-test';
    });
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-load-notice')).toHaveTextContent(
        'Geen opgeslagen logopedie.json gevonden.',
      );
    });

    expect(screen.getByTestId('screen-scenario-editor')).toBeInTheDocument();
    expect(screen.getByTestId('editor-demo-notice')).toHaveTextContent(
      'Dit is een demo-editor, geen les-app.',
    );
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
    expect(screen.getByTestId('editor-issues-ok')).toHaveTextContent('Geen validatiefouten.');
    expect(screen.getByTestId('logopedie-avatar')).toBeInTheDocument();
    expect(screen.getAllByText('Antwoord keuze').length).toBeGreaterThan(0);
    expect(screen.queryByText('Wat zegt de student?')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-media')).toBeInTheDocument();
    expect(screen.getByTestId('editor-preview-stage')).not.toHaveStyle({
      transform: 'scale(1.5)',
    });

    fireEvent.change(screen.getByTestId('prompt-text'), {
      target: { value: '' },
    });
    const firstOptionId = aphasiaIntakeScenario.nodes[0]?.options[0]?.id ?? 'd1-high';
    fireEvent.change(screen.getByTestId(`option-text-${firstOptionId}`), {
      target: { value: '   ' },
    });
    expect(screen.getByTestId('editor-issues-list')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('prompt-text'), {
      target: { value: 'Aangepaste cliëntvraag in de editor.' },
    });
    fireEvent.change(screen.getByTestId(`option-text-${firstOptionId}`), {
      target: { value: 'Aangepaste studentvraag in de editor.' },
    });
    await user.click(screen.getByTestId(`option-face-${firstOptionId}-frustrated`));
    expect(screen.getByTestId('preview-face-label')).toHaveTextContent('Gefrustreerd');
    expect(screen.getByTestId('logopedie-avatar')).toHaveAttribute(
      'data-avatar-variant',
      'gefrustreerd',
    );

    await user.click(screen.getByTestId('btn-download-json'));
    expect(click).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
    expect(captured).toBeInstanceOf(Blob);
    const json = JSON.parse(await (captured as Blob).text()) as {
      schemaVersion: number;
      module: string;
      scenario: { nodes: Array<{ prompt: { text: string }; options: Array<{ text: string }> }> };
    };
    expect(json.schemaVersion).toBe(1);
    expect(json.module).toBe('logopedie');
    expect(json.scenario.nodes[0]?.prompt.text).toBe('Aangepaste cliëntvraag in de editor.');
    expect(json.scenario.nodes[0]?.options[0]?.text).toBe('Aangepaste studentvraag in de editor.');
    expect(aphasiaIntakeScenario.nodes[0]?.prompt.text).toBe(originalPrompt);
    expect(aphasiaIntakeScenario.nodes[0]?.options[0]?.text).toBe(originalOption);
    expect(LOGOPEDIE_ENVELOPE_FILENAME).toBe('logopedie.json');
  });

  it('is not part of the student simulation routes', () => {
    renderApp(['/logopedie']);
    expect(screen.queryByTestId('screen-scenario-editor')).not.toBeInTheDocument();
    expect(screen.getByTestId('screen-logopedie-catalog')).toBeInTheDocument();
  });

  it('opens a valid logopedie JSON envelope and can download it again', async () => {
    const user = userEvent.setup();
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Vraag uit geopend JSON-bestand.';
    const file = new File([envelopeJson(draft)], 'logopedie.json', { type: 'application/json' });
    let captured: unknown;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      captured = value;
      return 'blob:editor-open';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-loaded-source')).toBeInTheDocument();
    });
    await user.upload(screen.getByTestId('input-open-json'), file);

    expect(await screen.findByTestId('prompt-text')).toHaveValue('Vraag uit geopend JSON-bestand.');
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: logopedie.json');
    expect(screen.queryByTestId('editor-open-error')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('btn-download-json'));
    expect(captured).toBeInstanceOf(Blob);
    const json = JSON.parse(await (captured as Blob).text()) as {
      module: string;
      scenario: { nodes: Array<{ prompt: { text: string } }> };
    };
    expect(json.module).toBe('logopedie');
    expect(json.scenario.nodes[0]?.prompt.text).toBe('Vraag uit geopend JSON-bestand.');
  });

  it('shows a clear error for invalid JSON and keeps the current draft', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-loaded-source')).toBeInTheDocument();
    });
    const original = (screen.getByTestId('prompt-text') as HTMLTextAreaElement).value;
    fireEvent.change(screen.getByTestId('prompt-text'), {
      target: { value: 'Nog in de editor, niet overschrijven.' },
    });

    const file = new File(['{dit is geen json'], 'kapot.json', { type: 'application/json' });
    await user.upload(screen.getByTestId('input-open-json'), file);

    expect(await screen.findByTestId('editor-open-error')).toHaveTextContent(
      'Dit bestand is geen geldige JSON.',
    );
    expect(screen.getByTestId('prompt-text')).toHaveValue('Nog in de editor, niet overschrijven.');
    expect(original).not.toBe('Nog in de editor, niet overschrijven.');
  });

  it('saves the current draft to this copy via the editor API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
    });
    fireEvent.change(screen.getByTestId('prompt-text'), {
      target: { value: 'Vraag opgeslagen in deze kopie.' },
    });
    await user.click(screen.getByTestId('btn-save-json'));
    expect(await screen.findByTestId('editor-save-ok')).toHaveTextContent(
      'Opgeslagen in deze kopie',
    );
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: logopedie.json');
    const post = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
    const body = JSON.parse(String(post?.[1]?.body)) as {
      schemaVersion: number;
      module: string;
      scenario: { nodes: Array<{ prompt: { text: string } }> };
    };
    expect(body.schemaVersion).toBe(1);
    expect(body.module).toBe('logopedie');
    expect(body.scenario.nodes[0]?.prompt.text).toBe('Vraag opgeslagen in deze kopie.');
  });

  it('loads saved logopedie.json on startup without Open JSON', async () => {
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Extra zin uit logopedie.json.';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET' || init?.method == null) {
          return new Response(envelopeJson(draft), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('prompt-text')).toHaveValue('Extra zin uit logopedie.json.');
    });
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: logopedie.json');
    expect(screen.queryByTestId('editor-load-notice')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-open-json')).toBeInTheDocument();
    expect(screen.getByTestId('btn-download-json')).toBeInTheDocument();
  });

  it('falls back to the start copy when saved JSON is invalid or missing', async () => {
    const original = aphasiaIntakeScenario.nodes[0]?.prompt.text ?? '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{niet-json', { status: 200 })),
    );
    const first = render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-load-notice')).toHaveTextContent('ongeldig');
    });
    expect(screen.getByTestId('prompt-text')).toHaveValue(original);
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
    first.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    );
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-load-notice')).toHaveTextContent(
        'Geen opgeslagen logopedie.json gevonden.',
      );
    });
    expect(screen.getByTestId('prompt-text')).toHaveValue(original);
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
  });

  it('restores the start copy after opening JSON', async () => {
    const user = userEvent.setup();
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Tijdelijk geopend.';
    const file = new File([envelopeJson(draft)], 'logopedie.json', { type: 'application/json' });
    const original = aphasiaIntakeScenario.nodes[0]?.prompt.text ?? '';

    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-loaded-source')).toBeInTheDocument();
    });
    await user.upload(screen.getByTestId('input-open-json'), file);
    expect(await screen.findByTestId('prompt-text')).toHaveValue('Tijdelijk geopend.');

    await user.click(screen.getByTestId('btn-reset-seed'));
    expect(screen.getByTestId('prompt-text')).toHaveValue(original);
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
    expect(screen.queryByTestId('editor-open-error')).not.toBeInTheDocument();
  });

  it('switches to Verpleegkunde, edits a step, and downloads JSON', async () => {
    const user = userEvent.setup();
    const originalQuestion = aphasiaIntakeScenario.nodes[0]?.prompt.text ?? '';
    let captured: unknown;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      captured = value;
      return 'blob:nursing-editor';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    expect(screen.getByTestId('nursing-question')).toBeInTheDocument();
    expect(screen.getByTestId('nursing-question')).toHaveValue('');
    expect(
      screen.queryByDisplayValue('Wat is nu je eerste actie bij de luchtweg?'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('nursing-weights-readonly')).not.toBeInTheDocument();
    expect(screen.queryByText(/Scoreformule/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Situatiebeschrijving')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fase')).not.toBeInTheDocument();
    expect(screen.queryByText('Gescoorde competenties')).not.toBeInTheDocument();
    expect(screen.queryByText('Onveilig')).not.toBeInTheDocument();
    expect(screen.queryByText('Volgende stap')).not.toBeInTheDocument();
    expect(screen.queryByText(/Stap n-/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stap 1' })).toBeInTheDocument();
    expect(screen.getByTestId('btn-editor-quit')).toBeInTheDocument();
    expect(screen.getByTestId('nursing-patient-name').closest('.field')).toHaveClass('is-empty');
    expect(screen.getByTestId('nursing-title').closest('.field')).not.toHaveClass('is-empty');
    expect(screen.getAllByRole('option', { name: 'Goed antwoord' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('option', { name: 'Goed (high)' })).not.toBeInTheDocument();
    expect(screen.queryByText('Kritieke fout (optioneel)')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nursing-sbar-field')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nursing-feedback-n-1-high')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-nursing-preview-stage')).not.toHaveStyle({
      transform: 'scale(1.5)',
    });
    expect(screen.queryByTestId('editor-media')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-nursing-media')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('nursing-question'), {
      target: { value: 'Aangepaste verpleegkundevraag in de editor.' },
    });
    expect(screen.getByTestId('preview-nursing-question')).toHaveTextContent(
      'Aangepaste verpleegkundevraag in de editor.',
    );

    await user.click(screen.getByTestId('btn-download-json'));
    expect(captured).toBeInstanceOf(Blob);
    const json = JSON.parse(await (captured as Blob).text()) as {
      schemaVersion: number;
      module: string;
      steps: Array<{ question: string }>;
    };
    expect(json.schemaVersion).toBe(1);
    expect(json.module).toBe('verpleegkunde');
    expect(json.steps[0]?.question).toBe('Aangepaste verpleegkundevraag in de editor.');

    await user.click(screen.getByTestId('editor-module-logopedie'));
    expect(screen.getByTestId('prompt-text')).toHaveValue(originalQuestion);
  });

  it('saves the nursing draft to this copy via the editor API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    fillNursingTexts('Vraag opgeslagen in deze verpleegkunde-kopie.');
    await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
    fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
      target: { value: 'Video volgt later.' },
    });
    await user.click(screen.getByTestId('btn-nursing-step-placeholder-save'));
    await user.click(screen.getByTestId('btn-save-json'));
    expect(await screen.findByTestId('editor-save-ok')).toHaveTextContent(
      'Opgeslagen in deze kopie',
    );
    const post = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('save-verpleegkunde'),
    );
    expect(post).toBeTruthy();
    const body = JSON.parse(String(post?.[1]?.body)) as {
      module: string;
      steps: Array<{ question: string }>;
    };
    expect(body.module).toBe('verpleegkunde');
    expect(body.steps[0]?.question).toBe('Vraag opgeslagen in deze verpleegkunde-kopie.');
  });

  it('replaces the current Verpleegkunde step video and previews it before save', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:nursing-replace');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    fillNursingTexts('Vraag met vervangen video.');
    expect(screen.getByTestId('nursing-step-video')).toBeInTheDocument();
    await user.click(screen.getByTestId('nursing-step-mode-video'));
    expect(screen.getByTestId('nursing-step-video-path')).toHaveTextContent(
      'Geen video gekoppeld.',
    );
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'vervanging.mp4', { type: 'video/mp4' });
    await user.upload(screen.getByTestId('input-nursing-step-replace'), file);
    await user.upload(screen.getByTestId('input-nursing-step-replace'), file);
    expect(screen.getByTestId('nursing-step-video-player')).toHaveAttribute(
      'src',
      'blob:nursing-replace',
    );
    expect(screen.getByTestId('editor-nursing-preview-stage')).not.toHaveStyle({
      transform: 'scale(1.5)',
    });
    await user.click(screen.getByTestId('btn-save-json'));
    expect(await screen.findByTestId('editor-save-ok')).toBeInTheDocument();
    const mediaPosts = fetchMock.mock.calls.filter(
      (call) => String(call[0]).includes('verpleegkunde-media') && call[1]?.method === 'POST',
    );
    expect(mediaPosts.length).toBeGreaterThan(0);
    const bodies = mediaPosts.map(
      (call) => JSON.parse(String(call[1]?.body)) as { relativePath: string; replace: boolean },
    );
    expect(bodies.every((body) => body.relativePath.startsWith('verpleegkunde/'))).toBe(true);
    expect(bodies.every((body) => !body.relativePath.includes('logopedie'))).toBe(true);
    expect(bodies.some((body) => body.replace)).toBe(true);
  });

  it('unlinks a step video without deleting logopedie media', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    await user.click(screen.getByTestId('nursing-step-mode-video'));
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'ontkoppel.mp4', { type: 'video/mp4' });
    await user.upload(screen.getByTestId('input-nursing-step-replace'), file);
    await user.click(screen.getByTestId('btn-nursing-step-unlink'));
    expect(screen.getByTestId('nursing-step-video-missing')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-media')).not.toBeInTheDocument();
  });

  it('blocks save when a logopedie question is empty and writes nothing', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
    });
    fireEvent.change(screen.getByTestId('prompt-text'), { target: { value: '' } });
    await user.click(screen.getByTestId('btn-save-json'));
    expect(screen.getByTestId('dialog-save-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-save-blocked-list')).toHaveTextContent(
      'stap zonder vraagtekst',
    );
    expect(screen.queryByTestId('editor-save-ok')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    await user.click(screen.getByTestId('btn-save-blocked-close'));
    expect(screen.queryByTestId('dialog-save-blocked')).not.toBeInTheDocument();
  });

  it('saves a filled Verpleegkunde step without a video and ignores a blank extra step', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    await user.click(screen.getByTestId('btn-save-json'));
    expect(screen.getByTestId('dialog-save-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-save-blocked-list')).not.toHaveTextContent('zonder video');
    expect(screen.getByTestId('dialog-save-blocked-list')).toHaveTextContent('Patiëntnaam');
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    await user.click(screen.getByTestId('btn-save-blocked-close'));
    fillNursingTexts('Vraag zonder video.');
    fireEvent.change(screen.getByTestId('nursing-patient-name'), {
      target: { value: 'Testpatiënt' },
    });
    expect(screen.getByTestId('nursing-patient-name').closest('.field')).not.toHaveClass(
      'is-empty',
    );
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    await user.click(screen.getByTestId('btn-save-json'));
    expect(await screen.findByTestId('editor-save-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('dialog-save-blocked')).not.toBeInTheDocument();
  });

  it('closes the editor window and asks the server to run the stop script', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('btn-editor-quit')).toBeInTheDocument();
    });
    expect(screen.queryByText('Volgende stap')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Node /)).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-editor-quit'));
    const quitCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/editor-api/quit'),
    );
    expect(quitCall?.[1]?.method).toBe('POST');
    expect(close).toHaveBeenCalled();
  });

  it('exports the current logopedie draft to this copy', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).includes('export-package')) {
        return new Response(
          JSON.stringify({
            ok: true,
            folder: 'exports/logopedie-test',
            zip: 'exports/logopedie-test.zip',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('btn-export-package')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('prompt-text'), {
      target: { value: 'Tekst voor export-pakket.' },
    });
    await user.click(screen.getByTestId('btn-export-package'));
    expect(await screen.findByTestId('editor-save-ok')).toHaveTextContent(
      'exports/logopedie-test.zip',
    );
    const post = fetchMock.mock.calls.find((call) => String(call[0]).includes('export-package'));
    const body = JSON.parse(String(post?.[1]?.body)) as {
      module: string;
      envelopeText: string;
    };
    expect(body.module).toBe('logopedie');
    expect(body.envelopeText).toContain('Tekst voor export-pakket.');
    expect(screen.getByTestId('btn-download-json')).toBeInTheDocument();
    expect(screen.getByTestId('btn-open-json')).toBeInTheDocument();
    expect(screen.getByTestId('btn-save-json')).toBeInTheDocument();
  });

  it('imports a valid logopedie package and blocks an incomplete one', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Tekst uit geïmporteerd pakket.';
    const zip = buildEditorPackageZip('logopedie', envelopeJson(draft), [
      {
        relativePath: 'logopedie/avatar/generated/erik/neutraal.png',
        data: new Uint8Array([1, 2]),
      },
    ]);
    const zipBytes = Uint8Array.from(zip);
    const file = new File([zipBytes], 'logopedie-pakket.zip', {
      type: 'application/zip',
    });

    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('input-import-package')).toBeInTheDocument();
    });
    await user.upload(screen.getByTestId('input-import-package'), file);
    expect(await screen.findByTestId('prompt-text')).toHaveValue('Tekst uit geïmporteerd pakket.');
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent(
      'Geladen: logopedie-pakket.zip',
    );
    expect(screen.getByTestId('logopedie-avatar')).toBeInTheDocument();
    const mediaPost = fetchMock.mock.calls.find((call) => String(call[0]).includes('import-media'));
    expect(mediaPost).toBeTruthy();

    const broken = cloneScenario();
    broken.nodes[0]!.prompt.text = '';
    const brokenZip = buildEditorPackageZip('logopedie', envelopeJson(broken), []);
    await user.upload(
      screen.getByTestId('input-import-package'),
      new File([Uint8Array.from(brokenZip)], 'kapot.zip', { type: 'application/zip' }),
    );
    expect(await screen.findByTestId('dialog-save-blocked')).toHaveTextContent(
      'Importeren geblokkeerd',
    );
    expect(screen.getByTestId('prompt-text')).toHaveValue('Tekst uit geïmporteerd pakket.');
  });

  it('opens a new empty Logopedie scenario without writing the current case', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
    });
    await user.click(screen.getByTestId('btn-new-scenario'));
    expect(screen.getByTestId('scenario-title')).toHaveValue('');
    expect(screen.getByTestId('prompt-text')).toHaveValue('');
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent(
      'Nieuw scenario (niet opgeslagen)',
    );
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    await user.click(screen.getByTestId('btn-save-json'));
    expect(screen.getByTestId('dialog-save-blocked')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    expect(screen.getByTestId('btn-download-json')).toBeInTheDocument();
    expect(screen.getByTestId('btn-open-json')).toBeInTheDocument();
    expect(screen.getByTestId('btn-export-package')).toBeInTheDocument();
    expect(screen.getByTestId('btn-import-package')).toBeInTheDocument();
  });

  it('opens a new empty Verpleegkunde scenario without video', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    await user.click(screen.getByTestId('btn-new-scenario'));
    expect(screen.getByTestId('nursing-title')).toHaveValue('');
    expect(screen.getByTestId('nursing-education-type')).toHaveValue('');
    expect(screen.getByTestId('nursing-question')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Stap 1' })).toBeInTheDocument();
    expect(screen.getByTestId('btn-add-nursing-step')).toBeInTheDocument();
    expect(screen.getByTestId('btn-remove-nursing-step')).toBeDisabled();
    expect(screen.getByTestId('nursing-step-video-missing')).toBeInTheDocument();
    expect(screen.queryByText('Feedback')).not.toBeInTheDocument();
    expect(screen.queryByText('Toelichting')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
  });

  it('adds a nursing step and never removes the last one', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    expect(screen.getByTestId('nursing-step-tab-n-extra-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-remove-nursing-step')).toBeEnabled();
    await user.click(screen.getByTestId('btn-remove-nursing-step'));
    expect(screen.queryByTestId('nursing-step-tab-n-extra-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('nursing-step-tab-n-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-remove-nursing-step')).toBeDisabled();
  });

  it('saves placeholder text on Video bij dit antwoord', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    await user.click(screen.getByTestId('nursing-option-mode-placeholder-n-1-high'));
    fireEvent.change(screen.getByTestId('nursing-option-placeholder-n-1-high'), {
      target: { value: 'Close-up van de handeling.' },
    });
    await user.click(screen.getByTestId('btn-nursing-option-placeholder-save-n-1-high'));
    expect(screen.getByTestId('nursing-option-placeholder-saved-n-1-high')).toBeInTheDocument();
  });

  it('reopens the last opened module on the next editor start', async () => {
    const user = userEvent.setup();
    const first = render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    expect(screen.getByTestId('nursing-question')).toBeInTheDocument();
    first.unmount();

    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('nursing-question')).toBeInTheDocument();
    });
    expect(screen.getByTestId('editor-module-nursing')).toHaveClass('is-active');
    expect(screen.queryByTestId('prompt-text')).not.toBeInTheDocument();
  });

  it('saves as a new case without posting to the overlay save API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).includes('save-as-case')) {
        return new Response(
          JSON.stringify({ ok: true, file: 'resources/scenarios/logopedie-casus-test.json' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('btn-save-as-case')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('btn-save-as-case'));
    expect(await screen.findByTestId('editor-save-ok')).toHaveTextContent(
      'Opgeslagen als nieuwe casus',
    );
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent(
      'Geladen: logopedie-casus-test.json',
    );
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('save-as-case'))).toBe(
      true,
    );
    expect(
      fetchMock.mock.calls.some(
        (call) => String(call[0]).includes('save-logopedie') && call[1]?.method === 'POST',
      ),
    ).toBe(false);
  });

  it('shows three Verpleegkunde answer videos and keeps the Logopedie still', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('logopedie-avatar')).toBeInTheDocument();
    });
    expect(screen.queryByText('Bij goed antwoord play video')).not.toBeInTheDocument();
    expect(screen.getByTestId('logopedie-avatar')).not.toHaveStyle({ transform: 'scale(1.5)' });

    await user.click(screen.getByTestId('editor-module-nursing'));
    expect(screen.getByText('Bij goed antwoord play video')).toBeInTheDocument();
    expect(screen.getByText('Bij deels goed antwoord play video')).toBeInTheDocument();
    expect(screen.getByText('Bij verkeerd antwoord play video')).toBeInTheDocument();
    expect(screen.getByTestId('nursing-step-video')).toBeInTheDocument();
    expect(screen.queryByTestId('logopedie-avatar')).not.toBeInTheDocument();
  });

  it('opens a print list of open placeholders and prints it', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    fireEvent.change(screen.getByTestId('nursing-title'), { target: { value: 'Opnamecasus' } });
    fireEvent.change(screen.getByTestId('nursing-step-name'), {
      target: { value: 'Eerste vraag' },
    });
    await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
    fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
      target: { value: 'Patiënt zit rechtop.' },
    });
    await user.click(screen.getByTestId('btn-nursing-step-placeholder-save'));
    await user.click(screen.getByTestId('nursing-answer-mode-placeholder-high'));
    fireEvent.change(screen.getByTestId('nursing-answer-placeholder-high'), {
      target: { value: 'Close-up van de meter.' },
    });
    await user.click(screen.getByTestId('btn-nursing-answer-placeholder-save-high'));

    await user.click(screen.getByTestId('btn-print-list'));
    expect(screen.getByTestId('print-list-title')).toHaveTextContent('Opnamecasus');
    expect(screen.getByRole('heading', { name: 'Eerste vraag' })).toBeInTheDocument();
    expect(screen.getByText('Startvideo van de vraag')).toBeInTheDocument();
    expect(screen.getByText('Patiënt zit rechtop.')).toBeInTheDocument();
    expect(screen.getByText('Goed antwoord')).toBeInTheDocument();
    expect(screen.getByText('Close-up van de meter.')).toBeInTheDocument();
    expect(screen.queryByText('Deels goed antwoord')).not.toBeInTheDocument();
    expect(screen.queryByText(/ABCDE|SBAR/)).not.toBeInTheDocument();

    await user.click(screen.getByTestId('btn-print-list-print'));
    expect(print).toHaveBeenCalledOnce();
    await user.click(screen.getByTestId('btn-print-list-close'));
    expect(screen.getByTestId('nursing-title')).toHaveValue('Opnamecasus');
  });

  it('opens a read-only node overview and leaves the form unchanged', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('logopedie-avatar')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('btn-nodes'));
    expect(screen.getByTestId('node-overview')).toBeInTheDocument();
    expect(screen.getAllByText('Scenario input').length).toBeGreaterThan(0);
    expect(screen.queryByText('Placeholder')).not.toBeInTheDocument();
    expect(screen.getByTestId('node-overview').querySelectorAll('input, textarea')).toHaveLength(0);
    await user.click(screen.getByTestId('btn-nodes-back'));
    expect(screen.getByTestId('logopedie-avatar')).not.toHaveStyle({ transform: 'scale(1.5)' });

    await user.click(screen.getByTestId('editor-module-nursing'));
    fireEvent.change(screen.getByTestId('nursing-title'), { target: { value: 'Opnamecasus' } });
    fireEvent.change(screen.getByTestId('nursing-step-name'), {
      target: { value: 'Eerste vraag' },
    });
    fireEvent.change(screen.getByTestId('nursing-phase'), { target: { value: 'Ademhaling' } });
    fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: 'Wat zie je?' } });
    await user.click(screen.getByTestId('nursing-answer-mode-placeholder-partial'));
    fireEvent.change(screen.getByTestId('nursing-answer-placeholder-partial'), {
      target: { value: 'Nog filmen: de ademhaling.' },
    });
    await user.click(screen.getByTestId('btn-nursing-answer-placeholder-save-partial'));
    await user.click(screen.getByTestId('btn-nodes'));

    const question = screen.getByTestId('node-question-n-1');
    expect(question).toHaveTextContent('Eerste vraag');
    expect(question).toHaveTextContent('Opnamecasus');
    expect(question).toHaveTextContent('Ademhaling');
    expect(question).toHaveTextContent('Wat zie je?');
    expect(screen.getByTestId('node-answer-n-1-partial')).toHaveTextContent(
      'Nog filmen: de ademhaling.',
    );
    expect(screen.getByTestId('node-answer-n-1-high')).toBeInTheDocument();
    expect(screen.getByTestId('node-wires').querySelector('path')).toHaveAttribute(
      'stroke-dasharray',
      '7 6',
    );

    await user.click(screen.getByTestId('btn-nodes-back'));
    expect(screen.getByTestId('nursing-title')).toHaveValue('Opnamecasus');
    expect(screen.getByTestId('nursing-step-name')).toHaveValue('Eerste vraag');
    expect(screen.getByTestId('nursing-question')).toHaveValue('Wat zie je?');
    expect(screen.getByTestId('nursing-answer-placeholder-partial')).toHaveValue(
      'Nog filmen: de ademhaling.',
    );
  });

  it('drags good forward, wrong back to the same question, and keeps the partial line', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    fireEvent.change(screen.getByTestId('nursing-title'), { target: { value: 'Opnamecasus' } });
    fireEvent.change(screen.getByTestId('nursing-step-name'), {
      target: { value: 'Eerste vraag' },
    });
    fireEvent.change(screen.getByTestId('nursing-phase'), { target: { value: 'Ademhaling' } });
    fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: 'Wat zie je?' } });
    await user.click(screen.getByTestId('nursing-answer-mode-placeholder-partial'));
    fireEvent.change(screen.getByTestId('nursing-answer-placeholder-partial'), {
      target: { value: 'Nog filmen: de ademhaling.' },
    });
    await user.click(screen.getByTestId('btn-nursing-answer-placeholder-save-partial'));
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    await user.click(screen.getByTestId('nursing-step-tab-n-1'));
    await user.click(screen.getByTestId('btn-nodes'));

    const previous = document.elementFromPoint;
    const drop = (fromPort: string, toPort: string) => {
      const from = document.querySelector(`[data-port="${fromPort}"]`);
      const to = document.querySelector(`[data-port="${toPort}"]`);
      if (!(from instanceof HTMLElement) || !(to instanceof Element)) {
        throw new Error(`Poort ontbreekt: ${fromPort} -> ${toPort}`);
      }
      document.elementFromPoint = () => to;
      act(() => {
        fireEvent.pointerDown(from, { clientX: 3, clientY: 3, button: 0 });
        window.dispatchEvent(
          new PointerEvent('pointerup', { clientX: 18, clientY: 18, bubbles: true }),
        );
      });
    };
    try {
      drop('a-out-n-1-partial', 'q-in-n-extra-1');
      drop('a-out-n-1-high', 'q-in-n-extra-1');
      drop('q-out-n-1-inappropriate', 'q-in-n-1');
      expect(screen.getByTestId('node-wire-a-out-n-1-high-to-q-in-n-extra-1')).toBeInTheDocument();
      expect(
        screen.getByTestId('node-wire-a-out-n-1-partial-to-q-in-n-extra-1'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('node-wire-a-out-n-1-inappropriate-to-q-in-n-1'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('node-overview').querySelectorAll('[data-wire-to="q-in-n-extra-1"]'),
      ).toHaveLength(2);
      expect(screen.getByTestId('node-answer-n-1-partial')).toHaveTextContent(
        'Nog filmen: de ademhaling.',
      );
      expect(screen.getByTestId('node-answer-n-1-high')).toBeInTheDocument();

      await user.click(screen.getByTestId('btn-delete-wire-a-out-n-1-partial'));
      expect(
        screen.queryByTestId('node-wire-a-out-n-1-partial-to-q-in-n-extra-1'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('node-answer-n-1-partial')).toBeInTheDocument();
      expect(screen.getByTestId('node-wire-a-out-n-1-high-to-q-in-n-extra-1')).toBeInTheDocument();
      expect(
        screen.getByTestId('node-wire-a-out-n-1-inappropriate-to-q-in-n-1'),
      ).toBeInTheDocument();

      drop('a-out-n-1-partial', 'q-in-n-extra-1');
      expect(
        screen.getByTestId('node-wire-a-out-n-1-partial-to-q-in-n-extra-1'),
      ).toBeInTheDocument();
    } finally {
      document.elementFromPoint = previous;
    }

    await user.click(screen.getByTestId('btn-nodes-back'));
    expect(screen.getByTestId('nursing-question')).toHaveValue('Wat zie je?');
    expect(screen.getByTestId('nursing-answer-placeholder-partial')).toHaveValue(
      'Nog filmen: de ademhaling.',
    );
    fireEvent.change(screen.getByTestId('nursing-question'), {
      target: { value: 'Wat zie je nu?' },
    });
    await user.click(screen.getByTestId('btn-nodes'));
    expect(screen.getByTestId('node-question-n-1')).toHaveTextContent('Wat zie je nu?');
    expect(screen.getByTestId('node-wire-a-out-n-1-high-to-q-in-n-extra-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-wire-a-out-n-1-partial-to-q-in-n-extra-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-wire-a-out-n-1-inappropriate-to-q-in-n-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-answer-n-1-partial')).toHaveTextContent(
      'Nog filmen: de ademhaling.',
    );
  });

  it('plays the current nursing lines from Start test and returns to the same form', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    expect(screen.getAllByText('Antwoord keuze').length).toBeGreaterThan(0);
    expect(screen.queryByText('Wat zegt de student?')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: 'Vraag een' } });
    await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
    fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
      target: { value: 'Plaatshouder een' },
    });
    await user.click(screen.getByTestId('btn-nursing-step-placeholder-save'));
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: 'Vraag twee' } });
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: 'Vraag drie' } });
    await user.click(screen.getByTestId('btn-nodes'));

    const previous = document.elementFromPoint;
    const drop = (fromPort: string, toPort: string) => {
      const from = document.querySelector(`[data-port="${fromPort}"]`);
      const to = document.querySelector(`[data-port="${toPort}"]`);
      if (!(from instanceof HTMLElement) || !(to instanceof Element)) {
        throw new Error(`Poort ontbreekt: ${fromPort} -> ${toPort}`);
      }
      document.elementFromPoint = () => to;
      act(() => {
        fireEvent.pointerDown(from, { clientX: 3, clientY: 3, button: 0 });
        window.dispatchEvent(
          new PointerEvent('pointerup', { clientX: 18, clientY: 18, bubbles: true }),
        );
      });
    };
    try {
      drop('a-out-n-1-high', 'q-in-n-extra-2');
      drop('a-out-n-1-partial', 'q-in-n-extra-1');
      drop('a-out-n-1-inappropriate', 'q-in-n-1');
      drop('a-out-n-extra-1-high', 'q-in-n-extra-2');
    } finally {
      document.elementFromPoint = previous;
    }

    await user.click(screen.getByTestId('btn-nodes-back'));
    await user.click(screen.getByTestId('nursing-step-tab-n-1'));
    expect(screen.getByTestId('nursing-question')).toHaveValue('Vraag een');
    expect(screen.getByTestId('nursing-step-placeholder')).toHaveValue('Plaatshouder een');

    await user.click(screen.getByTestId('btn-start-test'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Plaatshouder een');
    await user.click(screen.getByTestId('test-option-high'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag drie');

    await user.click(screen.getByTestId('btn-test-back'));
    await user.click(screen.getByTestId('btn-start-test'));
    await user.click(screen.getByTestId('test-option-partial'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag twee');
    await user.click(screen.getByTestId('test-option-partial'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag drie');

    await user.click(screen.getByTestId('btn-test-back'));
    await user.click(screen.getByTestId('btn-start-test'));
    await user.click(screen.getByTestId('test-option-inappropriate'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.getByTestId('test-media-stage')).toContainElement(
      screen.getByTestId('test-placeholder'),
    );
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Plaatshouder een');
    const replay = screen.getByTestId('test-replay');
    expect(replay.tagName).toBe('P');
    expect(replay.closest('button')).toBeNull();
    expect(replay).toHaveTextContent('Deze vraag komt opnieuw.');
    expect(
      screen.queryByRole('button', { name: 'Deze vraag komt opnieuw.' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('test-option-high')).toBeEnabled();
    await user.click(screen.getByTestId('test-option-inappropriate'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('test-option-high'));
    expect(screen.getByTestId('screen-scenario-test-results')).toBeInTheDocument();
    expect(screen.queryByTestId('score-value')).not.toBeInTheDocument();
    expect(screen.queryByText('Competentie scores')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('btn-test-back'));
    await user.click(screen.getByTestId('nursing-step-tab-n-1'));
    expect(screen.getByTestId('nursing-question')).toHaveValue('Vraag een');
    expect(screen.getByTestId('nursing-step-placeholder')).toHaveValue('Plaatshouder een');
  });
});
