import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { renderApp } from '../test/renderApp';
import { EditorApp } from './EditorApp';
import { envelopeJson, LOGOPEDIE_ENVELOPE_FILENAME } from './envelope';
import { cloneScenario } from './cloneScenario';
import { buildEditorPackageZip } from './scenarioPackage';

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
    expect(screen.getByTestId('nursing-weights-readonly')).toBeInTheDocument();
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
    fireEvent.change(screen.getByTestId('nursing-question'), {
      target: { value: 'Vraag opgeslagen in deze verpleegkunde-kopie.' },
    });
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
    expect(screen.getByTestId('nursing-step-video')).toBeInTheDocument();
    expect(screen.getByTestId('nursing-step-video-path')).not.toHaveTextContent(
      'Geen video gekoppeld.',
    );
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'vervanging.mp4', { type: 'video/mp4' });
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
    const mediaPost = fetchMock.mock.calls.find(
      (call) => String(call[0]).includes('verpleegkunde-media') && call[1]?.method === 'POST',
    );
    expect(mediaPost).toBeTruthy();
    const mediaBody = JSON.parse(String(mediaPost?.[1]?.body)) as {
      relativePath: string;
      replace: boolean;
    };
    expect(mediaBody.relativePath.startsWith('verpleegkunde/')).toBe(true);
    expect(mediaBody.relativePath.includes('logopedie')).toBe(false);
    expect(mediaBody.replace).toBe(true);
  });

  it('unlinks a step video without deleting logopedie media', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
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

  it('blocks save when a Verpleegkunde step has no video', async () => {
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
    await user.click(screen.getByTestId('btn-nursing-step-unlink'));
    await user.click(screen.getByTestId('btn-save-json'));
    expect(screen.getByTestId('dialog-save-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-save-blocked-list')).toHaveTextContent('zonder video');
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
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
});
