import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { APP_VERSION } from '../domain/types';
import { renderApp } from '../test/renderApp';
import { EditorApp } from './EditorApp';
import { formatCaseSavedAt } from './editorCases';
import { envelopeJson, LOGOPEDIE_ENVELOPE_FILENAME } from './envelope';
import { cloneScenario } from './cloneScenario';
import { emptyNursingScenario } from './emptyScenario';
import { alignFlowCards, nursingNodeOverview } from './nodeBoard';
import { embedNodeLayout } from './nodeLayoutFile';
import { appendNursingStep } from './nursingSteps';
import { nursingEnvelopeJson, parseVerpleegkundeEnvelope } from './nursingEnvelope';
import {
  removeQuestionFolder,
  restoreQuestionFolderBackup,
  writeQuestionFolderFiles,
} from './questionFolderWrite';
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
    expect(screen.queryByTestId('editor-demo-notice')).not.toBeInTheDocument();
    expect(screen.queryByText(/demo-editor/)).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-credit')).toHaveTextContent(
      `${APP_VERSION} Made by Rutger van Horssen`,
    );
    expect(screen.getByTestId('editor-module-nursing')).toHaveTextContent('Gesprekstechnieken');
    expect(screen.queryByTestId('input-open-json')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
    expect(screen.getByTestId('editor-issues-ok')).toHaveTextContent('Geen validatiefouten.');
    expect(screen.getByTestId('logopedie-avatar')).toBeInTheDocument();
    expect(screen.getAllByText('Antwoord keuze').length).toBeGreaterThan(0);
    expect(screen.queryByText('Wat zegt de student?')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-media')).toBeInTheDocument();
    expect(screen.getByTestId('editor-preview-stage')).not.toHaveStyle({
      transform: 'scale(1.5)',
    });
    expect(screen.getByTestId('btn-open-json')).toHaveTextContent('Casus openen');
    expect(screen.getByTestId('btn-download-json')).toHaveTextContent('Casus downloaden');
    expect(screen.getByTestId('btn-start-test')).toHaveTextContent('Test modus');
    expect(screen.getByTestId('btn-nodes')).toHaveTextContent('Node Editor');
    expect(
      [...document.querySelectorAll('.editor-actions > button')].map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual([
      'Nieuw scenario',
      'Casus openen',
      'Node Editor',
      'Test modus',
      'Opslaan',
      'Opslaan als nieuwe casus',
      'Casus downloaden',
      'Herstel startkopie',
      'Importeren',
      'Exporteren',
      'Casus verwijderen',
      'Afsluiten',
    ]);
    for (const button of document.querySelectorAll('.editor-actions > button')) {
      expect(button).toHaveClass('btn-secondary');
    }
    const actions = screen.getByTestId('btn-nodes').closest('.editor-actions');
    const preview = screen.getByTestId('editor-preview-stage').closest('.editor-preview');
    expect(preview).toHaveClass('editor-card');
    expect(actions?.parentElement).toBe(preview?.parentElement);
    expect(actions?.parentElement).toHaveClass('editor-header-side');
    expect(document.querySelector('.editor-layout .editor-preview')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Printlijst' })).not.toBeInTheDocument();

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

  it('opens a listed case without a file picker and can download it again', async () => {
    const user = userEvent.setup();
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Vraag uit geopend JSON-bestand.';
    const fileName = 'logopedie-extra-casus.json';
    let captured: unknown;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      captured = value;
      return 'blob:editor-open';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const target = String(url);
        if (target.includes('/editor-api/cases')) {
          return new Response(
            JSON.stringify({ ok: true, cases: [{ file: fileName, title: 'Extra casus' }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (target.includes(fileName)) {
          return new Response(envelopeJson(draft), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('missing', { status: 404 });
      }),
    );

    try {
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-loaded-source')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('input-open-json')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-open-json'));
      expect(await screen.findByTestId('dialog-open-case')).toBeInTheDocument();
      expect(screen.getByTestId('editor-case-list')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-open-case').querySelector('input[type="file"]')).toBeNull();
      await user.click(screen.getByTestId(`btn-open-case-${fileName}`));

      expect(await screen.findByTestId('prompt-text')).toHaveValue(
        'Vraag uit geopend JSON-bestand.',
      );
      expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent(`Geladen: ${fileName}`);
      expect(screen.queryByTestId('editor-open-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dialog-open-case')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('btn-download-json'));
      expect(captured).toBeInstanceOf(Blob);
      const json = JSON.parse(await (captured as Blob).text()) as {
        module: string;
        scenario: { nodes: Array<{ prompt: { text: string } }> };
      };
      expect(json.module).toBe('logopedie');
      expect(json.scenario.nodes[0]?.prompt.text).toBe('Vraag uit geopend JSON-bestand.');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows the last save time after each case name', async () => {
    const user = userEvent.setup();
    const older = '2026-10-02T11:50:00.000Z';
    const newer = '2026-10-05T08:15:00.000Z';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const target = String(url);
        if (target.includes('/editor-api/cases')) {
          return new Response(
            JSON.stringify({
              ok: true,
              cases: [
                { file: 'logopedie-a.json', title: 'Zelfde naam', savedAt: older },
                { file: 'logopedie-b.json', title: 'Zelfde naam', savedAt: newer },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('missing', { status: 404 });
      }),
    );
    try {
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-loaded-source')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-open-json'));
      const olderLabel = formatCaseSavedAt(older);
      const newerLabel = formatCaseSavedAt(newer);
      expect(await screen.findByTestId('case-saved-logopedie-a.json')).toHaveTextContent(
        olderLabel,
      );
      expect(screen.getByTestId('case-saved-logopedie-b.json')).toHaveTextContent(newerLabel);
      expect(olderLabel).not.toBe(newerLabel);
      const first = screen.getByTestId('btn-open-case-logopedie-a.json').textContent ?? '';
      expect(first.indexOf('Zelfde naam')).toBeGreaterThanOrEqual(0);
      expect(first.indexOf('Zelfde naam')).toBeLessThan(first.indexOf(olderLabel));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('asks twice before deleting the open case and then shows the case list', async () => {
    const user = userEvent.setup();
    const fileName = 'verpleegkunde-tijdelijk-wissen.json';
    const otherFile = 'verpleegkunde-bewaren.json';
    const draft = emptyNursingScenario();
    draft.meta.title = 'Tijdelijke casus';
    draft.steps[0]!.question = 'Blijft staan na verwijderen';
    draft.steps[0]!.questionFolder = 'gesprekstechnieken/Tijdelijke casus-Vraag2';
    let caseReads = 0;
    const deleteCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        if (target.includes('/editor-api/delete-case')) {
          deleteCalls.push(String(init?.body ?? ''));
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (target.includes('/editor-api/cases')) {
          caseReads += 1;
          const cases =
            caseReads === 1
              ? [
                  {
                    file: fileName,
                    title: 'Tijdelijke casus',
                    savedAt: '2026-10-05T08:00:00.000Z',
                  },
                  { file: otherFile, title: 'Bewaren', savedAt: '2026-10-04T08:00:00.000Z' },
                ]
              : [{ file: otherFile, title: 'Bewaren', savedAt: '2026-10-04T08:00:00.000Z' }];
          return new Response(JSON.stringify({ ok: true, cases }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (target.includes(fileName)) {
          return new Response(nursingEnvelopeJson(draft), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('missing', { status: 404 });
      }),
    );
    try {
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('editor-module-nursing'));
      await user.click(screen.getByTestId('btn-open-json'));
      await user.click(await screen.findByTestId(`btn-open-case-${fileName}`));
      expect(await screen.findByTestId('nursing-question')).toHaveValue(
        'Blijft staan na verwijderen',
      );

      await user.click(screen.getByTestId('btn-delete-case'));
      expect(await screen.findByTestId('dialog-delete-case-1')).toBeInTheDocument();
      expect(screen.queryByTestId('dialog-delete-case-2')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-delete-case-cancel-1'));
      expect(deleteCalls).toHaveLength(0);
      expect(screen.queryByTestId('dialog-open-case')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('btn-delete-case'));
      await user.click(await screen.findByTestId('btn-delete-case-continue'));
      expect(await screen.findByTestId('dialog-delete-case-2')).toBeInTheDocument();
      expect(screen.queryByTestId('dialog-delete-case-1')).not.toBeInTheDocument();
      expect(deleteCalls).toHaveLength(0);
      await user.click(screen.getByTestId('btn-delete-case-cancel-2'));
      expect(deleteCalls).toHaveLength(0);
      expect(screen.getByTestId('nursing-question')).toHaveValue('Blijft staan na verwijderen');

      await user.click(screen.getByTestId('btn-delete-case'));
      await user.click(await screen.findByTestId('btn-delete-case-continue'));
      await user.click(await screen.findByTestId('btn-delete-case-confirm'));

      expect(await screen.findByTestId('dialog-open-case')).toBeInTheDocument();
      expect(screen.queryByTestId(`btn-open-case-${fileName}`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`btn-open-case-${otherFile}`)).toBeInTheDocument();
      expect(screen.getByTestId('screen-scenario-editor')).toBeInTheDocument();
      expect(screen.getByTestId('nursing-question')).toHaveValue('Blijft staan na verwijderen');
      expect(deleteCalls).toHaveLength(1);
      const body = JSON.parse(deleteCalls[0] ?? '{}') as { file?: string; folders?: string[] };
      expect(body.file).toBe(fileName);
      expect(body.folders).toContain('gesprekstechnieken/Tijdelijke casus-Vraag2');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('deletes ABCDE from the case list after two confirms and does not open it', async () => {
    const user = userEvent.setup();
    const abcdeFile = 'verpleegkunde-abcde-en-sbar-bij-acute-benauwdheid-test.json';
    const keptFile = 'verpleegkunde-bewaren.json';
    const abcde = emptyNursingScenario();
    abcde.meta.title = 'ABCDE en SBAR bij acute benauwdheid';
    abcde.steps[0]!.questionFolder = 'gesprekstechnieken/ABCDE voorbeeld-Vraag1';
    const keptQuestion = 'Deze vraag blijft in de editor';
    let caseReads = 0;
    const deleteCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        if (target.includes('/editor-api/delete-case')) {
          deleteCalls.push(String(init?.body ?? ''));
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (target.includes('/editor-api/cases')) {
          caseReads += 1;
          const cases =
            deleteCalls.length === 0
              ? [
                  {
                    file: abcdeFile,
                    title: 'ABCDE en SBAR bij acute benauwdheid',
                    savedAt: '2026-10-02T13:50:15.000Z',
                  },
                  { file: keptFile, title: 'Bewaren', savedAt: '2026-10-04T08:00:00.000Z' },
                ]
              : [{ file: keptFile, title: 'Bewaren', savedAt: '2026-10-04T08:00:00.000Z' }];
          return new Response(JSON.stringify({ ok: true, cases }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (target.includes(abcdeFile)) {
          return new Response(nursingEnvelopeJson(abcde), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('missing', { status: 404 });
      }),
    );
    try {
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('editor-module-nursing'));
      fireEvent.change(screen.getByTestId('nursing-question'), {
        target: { value: keptQuestion },
      });
      await user.click(screen.getByTestId('btn-open-json'));
      await user.click(await screen.findByTestId(`btn-open-case-${abcdeFile}`));
      expect(await screen.findByTestId('editor-open-error')).toHaveTextContent(
        'De voorbeeldcasus ABCDE/SBAR wordt niet geopend.',
      );
      expect(screen.getByTestId('nursing-question')).toHaveValue(keptQuestion);
      expect(
        screen.queryByText('Deze casus is niet opgeslagen. Er is niets verwijderd.'),
      ).not.toBeInTheDocument();

      await user.click(screen.getByTestId('btn-open-json'));
      await user.click(await screen.findByTestId(`btn-delete-listed-case-${abcdeFile}`));
      expect(await screen.findByTestId('dialog-delete-listed-case-1')).toHaveTextContent(
        'ABCDE en SBAR bij acute benauwdheid',
      );
      expect(screen.queryByTestId('dialog-delete-listed-case-2')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-delete-listed-cancel-1'));
      expect(deleteCalls).toHaveLength(0);
      expect(screen.getByTestId(`btn-open-case-${abcdeFile}`)).toBeInTheDocument();

      await user.click(screen.getByTestId(`btn-delete-listed-case-${abcdeFile}`));
      await user.click(await screen.findByTestId('btn-delete-listed-continue'));
      expect(await screen.findByTestId('dialog-delete-listed-case-2')).toBeInTheDocument();
      expect(deleteCalls).toHaveLength(0);
      await user.click(screen.getByTestId('btn-delete-listed-cancel-2'));
      expect(screen.getByTestId(`btn-open-case-${abcdeFile}`)).toBeInTheDocument();

      await user.click(screen.getByTestId(`btn-delete-listed-case-${abcdeFile}`));
      await user.click(await screen.findByTestId('btn-delete-listed-continue'));
      await user.click(await screen.findByTestId('btn-delete-listed-confirm'));

      expect(await screen.findByTestId('dialog-open-case')).toBeInTheDocument();
      expect(screen.queryByTestId(`btn-open-case-${abcdeFile}`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`btn-open-case-${keptFile}`)).toBeInTheDocument();
      expect(
        screen.queryByText('Deze casus is niet opgeslagen. Er is niets verwijderd.'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('nursing-question')).toHaveValue(keptQuestion);
      expect(deleteCalls).toHaveLength(1);
      const body = JSON.parse(deleteCalls[0] ?? '{}') as { file?: string; module?: string };
      expect(body.file).toBe(abcdeFile);
      expect(body.module).toBe('verpleegkunde');
      expect(caseReads).toBeGreaterThan(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('remembers node positions after leaving the node editor and after save', async () => {
    const user = userEvent.setup();
    let savedBody = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        if (init?.method === 'POST' && target.includes('save-verpleegkunde')) {
          savedBody = String(init.body ?? '');
          return new Response(
            JSON.stringify({ ok: true, file: 'resources/scenarios/verpleegkunde.json' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (target.includes('verpleegkunde-media')) {
          return new Response(JSON.stringify({ ok: true, items: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (target.includes('verpleegkunde.json') && savedBody) {
          return new Response(savedBody, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('missing', { status: 404 });
      }),
    );
    try {
      const first = render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('editor-module-nursing'));
      fillNursingTexts('Waar staat de vraag?');
      await user.click(screen.getByTestId('btn-nodes'));
      const card = await screen.findByTestId('node-question-n-1');
      const title = card.querySelector('.node-card-title') ?? card;
      fireEvent.pointerDown(title, { button: 0, clientX: 10, clientY: 12 });
      fireEvent.pointerMove(window, { clientX: 170, clientY: 92 });
      fireEvent.pointerUp(window, { clientX: 170, clientY: 92 });
      const left = card.style.left;
      const top = card.style.top;
      expect(left).toBe('328px');
      expect(top).toBe('80px');

      await user.click(screen.getByTestId('btn-nodes-back'));
      expect(screen.queryByTestId('node-overview')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-nodes'));
      const again = await screen.findByTestId('node-question-n-1');
      expect(again.style.left).toBe(left);
      expect(again.style.top).toBe(top);
      await user.click(screen.getByTestId('btn-nodes-back'));

      await user.click(screen.getByTestId('btn-save-json'));
      expect(await screen.findByTestId('editor-save-ok')).toHaveTextContent(
        'Opgeslagen in deze kopie',
      );
      const saved = JSON.parse(savedBody) as {
        nodeLayout?: Record<string, { x: number; y: number }>;
      };
      expect(saved.nodeLayout?.['q:n-1']).toEqual({ x: 328, y: 80 });

      first.unmount();
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('verpleegkunde.json');
      });
      await user.click(screen.getByTestId('btn-nodes'));
      const restored = await screen.findByTestId('node-question-n-1');
      expect(restored.style.left).toBe('328px');
      expect(restored.style.top).toBe('80px');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('aligns two questions and keeps that layout after Terug naar editor', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    );
    try {
      render(<EditorApp />);
      await user.click(await screen.findByTestId('editor-module-nursing'));
      await user.click(screen.getByTestId('btn-add-nursing-step'));
      await user.click(screen.getByTestId('btn-nodes'));
      const second = await screen.findByTestId('node-question-n-extra-1');
      const wires = [...document.querySelectorAll('[data-wire-from]')].map(
        (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
      );
      fireEvent.pointerDown(second, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(window, { clientX: 20, clientY: 240 });
      fireEvent.pointerUp(window, { clientX: 20, clientY: 240 });
      expect(second.style.top).not.toBe('0px');
      expect(screen.getByTestId('btn-node-undo')).toBeDisabled();
      await user.click(screen.getByTestId('btn-node-align'));
      const expected = alignFlowCards(
        nursingNodeOverview(appendNursingStep(emptyNursingScenario()).scenario).rows,
      );
      const read = (testId: string) => {
        const card = screen.getByTestId(testId);
        return {
          x: Number.parseFloat(card.style.left),
          y: Number.parseFloat(card.style.top),
        };
      };
      expect(read('node-question-n-1')).toEqual(expected['q:n-1']);
      expect(read('node-answer-n-1-high')).toEqual(expected['a:n-1:high']);
      expect(read('node-answer-n-1-partial').y).toBeLessThan(
        read('node-answer-n-1-inappropriate').y,
      );
      expect(read('node-question-n-extra-1')).toEqual(expected['q:n-extra-1']);
      expect(read('node-question-n-extra-1').y).toBe(0);
      expect(read('node-question-n-extra-1').x).toBeGreaterThan(read('node-answer-n-1-high').x);
      expect(read('node-answer-n-extra-1-high').y).toBeLessThan(
        read('node-answer-n-extra-1-partial').y,
      );
      expect(read('node-answer-n-extra-1-partial').y).toBeLessThan(
        read('node-answer-n-extra-1-inappropriate').y,
      );
      expect(screen.getByTestId('btn-node-edit-n-1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-node-undo')).toBeDisabled();
      const after = [...document.querySelectorAll('[data-wire-from]')].map(
        (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
      );
      expect(after).toEqual(wires);
      await user.click(screen.getByTestId('btn-nodes-back'));
      expect(screen.queryByTestId('node-overview')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-nodes'));
      await screen.findByTestId('node-question-n-extra-1');
      expect(read('node-question-n-1')).toEqual(expected['q:n-1']);
      expect(read('node-question-n-extra-1')).toEqual(expected['q:n-extra-1']);
      expect(read('node-answer-n-1-inappropriate')).toEqual(expected['a:n-1:inappropriate']);
      expect(read('node-answer-n-extra-1-high')).toEqual(expected['a:n-extra-1:high']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('writes aligned positions into the case file and shows them after a restart', async () => {
    const user = userEvent.setup();
    const scenario = appendNursingStep(emptyNursingScenario()).scenario;
    scenario.meta.title = 'Posities blijven';
    let caseText = nursingEnvelopeJson(scenario);
    const posts: Array<Record<string, { x: number; y: number }>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        if (init?.method === 'POST' && target.includes('/editor-api/node-layout')) {
          const body = JSON.parse(String(init.body)) as {
            module: 'verpleegkunde';
            file: string;
            nodeLayout: Record<string, { x: number; y: number }>;
          };
          const embedded = embedNodeLayout(caseText, body.module, body.nodeLayout);
          if (!embedded.ok) {
            return new Response(JSON.stringify({ ok: false, error: embedded.error }), {
              status: 400,
            });
          }
          caseText = embedded.json;
          posts.push(body.nodeLayout);
          return new Response(
            JSON.stringify({ ok: true, file: 'resources/scenarios/verpleegkunde.json' }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        if (target.includes('verpleegkunde.json')) {
          return new Response(caseText, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('missing', { status: 404 });
      }),
    );
    try {
      const first = render(<EditorApp />);
      await user.click(await screen.findByTestId('editor-module-nursing'));
      await waitFor(() => {
        expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('verpleegkunde.json');
      });
      await user.click(screen.getByTestId('btn-nodes'));
      const second = await screen.findByTestId('node-question-n-extra-1');
      const wires = [...document.querySelectorAll('[data-wire-from]')].map(
        (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
      );
      fireEvent.pointerDown(second, { button: 0, clientX: 30, clientY: 16 });
      fireEvent.pointerMove(window, { clientX: 30, clientY: 90 });
      fireEvent.pointerUp(window, { clientX: 30, clientY: 90 });
      await waitFor(() => {
        expect(posts.at(-1)?.['q:n-extra-1']?.y).toBeGreaterThan(0);
      });
      const moved = posts.at(-1)?.['q:n-extra-1'];
      expect(screen.getByTestId('node-question-n-extra-1').style.top).toBe(`${moved?.y}px`);
      await user.click(screen.getByTestId('btn-node-align'));
      const expected = alignFlowCards(nursingNodeOverview(scenario).rows);
      await waitFor(() => {
        expect(posts.at(-1)?.['q:n-1']).toEqual(expected['q:n-1']);
        expect(posts.at(-1)?.['a:n-1:partial']).toEqual(expected['a:n-1:partial']);
        expect(posts.at(-1)?.['a:n-extra-1:inappropriate']).toEqual(
          expected['a:n-extra-1:inappropriate'],
        );
      });
      expect(expected['q:n-1']?.y).toBe(expected['q:n-extra-1']?.y);
      expect(expected['a:n-1:high']?.y).toBe(expected['a:n-extra-1:high']?.y);
      expect(expected['a:n-1:partial']?.y).toBe(expected['a:n-extra-1:partial']?.y);
      expect(expected['a:n-1:inappropriate']?.y).toBe(expected['a:n-extra-1:inappropriate']?.y);
      expect(expected['a:n-extra-1:high']!.x - expected['q:n-extra-1']!.x).toBe(
        expected['a:n-1:high']!.x - expected['q:n-1']!.x,
      );
      const after = [...document.querySelectorAll('[data-wire-from]')].map(
        (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
      );
      expect(after).toEqual(wires);
      const stored = parseVerpleegkundeEnvelope(caseText);
      expect(stored.ok).toBe(true);
      if (stored.ok) {
        expect(stored.scenario.meta.title).toBe('Posities blijven');
        expect(stored.scenario.nodeLayout).toEqual(expected);
      }
      first.unmount();

      render(<EditorApp />);
      await user.click(await screen.findByTestId('editor-module-nursing'));
      await waitFor(() => {
        expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('verpleegkunde.json');
      });
      await user.click(screen.getByTestId('btn-nodes'));
      await screen.findByTestId('node-question-n-extra-1');
      const read = (testId: string) => {
        const card = screen.getByTestId(testId);
        return {
          x: Number.parseFloat(card.style.left),
          y: Number.parseFloat(card.style.top),
        };
      };
      expect(read('node-question-n-1')).toEqual(expected['q:n-1']);
      expect(read('node-question-n-extra-1')).toEqual(expected['q:n-extra-1']);
      expect(read('node-answer-n-1-high')).toEqual(expected['a:n-1:high']);
      expect(read('node-answer-n-1-partial')).toEqual(expected['a:n-1:partial']);
      expect(read('node-answer-n-extra-1-inappropriate')).toEqual(
        expected['a:n-extra-1:inappropriate'],
      );
      expect(screen.getByTestId('btn-node-edit-n-1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-node-undo')).toBeDisabled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows a clear error for invalid JSON and keeps the current draft', async () => {
    const user = userEvent.setup();
    const fileName = 'logopedie-kapot.json';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const target = String(url);
        if (target.includes('/editor-api/cases')) {
          return new Response(
            JSON.stringify({ ok: true, cases: [{ file: fileName, title: 'Kapot' }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (target.includes(fileName)) {
          return new Response('{dit is geen json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('missing', { status: 404 });
      }),
    );
    try {
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-loaded-source')).toBeInTheDocument();
      });
      const original = (screen.getByTestId('prompt-text') as HTMLTextAreaElement).value;
      fireEvent.change(screen.getByTestId('prompt-text'), {
        target: { value: 'Nog in de editor, niet overschrijven.' },
      });

      await user.click(screen.getByTestId('btn-open-json'));
      await user.click(await screen.findByTestId(`btn-open-case-${fileName}`));

      expect(await screen.findByTestId('editor-open-error')).toHaveTextContent(
        'Dit bestand is geen geldige JSON.',
      );
      expect(screen.getByTestId('prompt-text')).toHaveValue(
        'Nog in de editor, niet overschrijven.',
      );
      expect(original).not.toBe('Nog in de editor, niet overschrijven.');
      expect(screen.queryByTestId('input-open-json')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('restores the start copy after opening a listed case', async () => {
    const user = userEvent.setup();
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Tijdelijk geopend.';
    const fileName = 'logopedie-tijdelijk.json';
    const original = aphasiaIntakeScenario.nodes[0]?.prompt.text ?? '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const target = String(url);
        if (target.includes('/editor-api/cases')) {
          return new Response(
            JSON.stringify({ ok: true, cases: [{ file: fileName, title: 'Tijdelijk' }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (target.includes(fileName)) {
          return new Response(envelopeJson(draft), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('missing', { status: 404 });
      }),
    );

    try {
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-loaded-source')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-open-json'));
      await user.click(await screen.findByTestId(`btn-open-case-${fileName}`));
      expect(await screen.findByTestId('prompt-text')).toHaveValue('Tijdelijk geopend.');

      await user.click(screen.getByTestId('btn-reset-seed'));
      expect(screen.getByTestId('prompt-text')).toHaveValue(original);
      expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: startkopie');
      expect(screen.queryByTestId('editor-open-error')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('switches to Gesprekstechnieken, edits a step, and downloads JSON', async () => {
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
    expect(
      screen.getByRole('heading', { name: 'Gesprekstechnieken-scenariobewerker' }),
    ).toBeInTheDocument();
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
    expect(screen.getByTestId('nursing-step-name')).toHaveValue('Vraag.1');
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
    expect(bodies.every((body) => body.relativePath.startsWith('gesprekstechnieken/'))).toBe(true);
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
    expect(screen.queryByTestId('btn-nodes-back')).not.toBeInTheDocument();
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
    expect(screen.getByTestId('nursing-step-name')).toHaveValue('Vraag.1');
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
    expect(screen.getByTestId('nursing-step-name')).toHaveValue('Vraag.1');
    expect(screen.getByTestId('btn-add-nursing-step')).toHaveTextContent('Vraag toevoegen');
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    expect(screen.getByTestId('nursing-step-name')).toHaveValue('Vraag.2');
    expect(screen.getByTestId('nursing-step-tab-n-extra-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-remove-nursing-step')).toBeEnabled();
    await user.click(screen.getByTestId('btn-remove-nursing-step'));
    expect(screen.queryByTestId('nursing-step-tab-n-extra-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('nursing-step-tab-n-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-remove-nursing-step')).toBeDisabled();
  });

  it('saves each play-video placeholder on its own answer', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    expect(screen.queryByText('Video bij dit antwoord')).not.toBeInTheDocument();
    expect(screen.queryByText('Optionele video toevoegen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-optional-video-n-1-high')).not.toBeInTheDocument();
    const plays = [
      ['high', 'Close-up van de handeling.'],
      ['partial', 'Deels goed filmen.'],
      ['inappropriate', 'Verkeerd filmen.'],
    ] as const;
    for (const [quality, text] of plays) {
      await user.click(screen.getByTestId(`nursing-answer-mode-placeholder-${quality}`));
      fireEvent.change(screen.getByTestId(`nursing-answer-placeholder-${quality}`), {
        target: { value: text },
      });
      await user.click(screen.getByTestId(`btn-nursing-answer-placeholder-save-${quality}`));
      const card = screen.getByTestId(`nursing-answer-video-${quality}`);
      const preview = screen.getByTestId(`nursing-answer-placeholder-preview-${quality}`);
      expect(card).toContainElement(preview);
      expect(preview).toHaveTextContent(text);
      expect(screen.getByTestId(`nursing-answer-placeholder-saved-${quality}`)).toBeInTheDocument();
    }
    fireEvent.change(screen.getByTestId('nursing-answer-placeholder-high'), {
      target: { value: '   ' },
    });
    expect(screen.getByTestId('nursing-answer-placeholder-preview-high')).not.toHaveTextContent(
      'Close-up',
    );
    expect(screen.getByTestId('nursing-answer-placeholder-preview-partial')).toHaveTextContent(
      'Deels goed filmen.',
    );
    expect(
      screen.getByTestId('nursing-answer-placeholder-preview-inappropriate'),
    ).toHaveTextContent('Verkeerd filmen.');
  });

  it('reads placeholder texts back from the written case file after a restart', async () => {
    const user = userEvent.setup();
    const caseFile = join(tmpdir(), `verpleegkunde-placeholders-${Date.now()}.json`);
    const texts = {
      start: 'Start: vrouw zit rechtop en kijkt langs de student.',
      highPlay: 'Close-up: vrouw knikt langzaam en haar schouders zakken.',
      partialPlay: 'Close-up: deels goed, schouders blijven hoog.',
      inappropriatePlay: 'Close-up: verkeerd, kin zakt naar de borst.',
    };
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (init?.method === 'POST' && target.includes('save-verpleegkunde')) {
        const parsed = JSON.parse(String(init.body)) as unknown;
        writeFileSync(caseFile, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
        return new Response(
          JSON.stringify({ ok: true, file: 'resources/scenarios/verpleegkunde.json' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (target.includes('verpleegkunde.json') && existsSync(caseFile)) {
        return new Response(readFileSync(caseFile, 'utf8'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (target.includes('verpleegkunde-media')) {
        return new Response(JSON.stringify({ ok: true, items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const first = render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('editor-module-nursing'));
      fillNursingTexts('Wat zeg je als eerste?');

      await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
      fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
        target: { value: texts.start },
      });
      const answers = [
        ['high', texts.highPlay],
        ['partial', texts.partialPlay],
        ['inappropriate', texts.inappropriatePlay],
      ] as const;
      for (const [quality, play] of answers) {
        await user.click(screen.getByTestId(`nursing-answer-mode-placeholder-${quality}`));
        fireEvent.change(screen.getByTestId(`nursing-answer-placeholder-${quality}`), {
          target: { value: play },
        });
      }

      await user.click(screen.getByTestId('btn-save-json'));
      expect(await screen.findByTestId('editor-save-ok')).toHaveTextContent(
        'Opgeslagen in deze kopie',
      );

      const written = readFileSync(caseFile, 'utf8');
      const parsed = parseVerpleegkundeEnvelope(written);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      const step = parsed.scenario.steps[0];
      expect(step?.stepVideoPlaceholder).toBe(texts.start);
      expect(step?.options.map((option) => option.videoPlaceholder)).toEqual([
        texts.highPlay,
        texts.partialPlay,
        texts.inappropriatePlay,
      ]);
      expect(step?.options[0]?.answerCardPlaceholder ?? '').not.toBe(texts.highPlay);

      first.unmount();
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('nursing-step-placeholder')).toHaveValue(texts.start);
      });
      expect(screen.getByTestId('nursing-step-placeholder-preview')).toHaveTextContent(texts.start);
      for (const [quality, play] of answers) {
        expect(screen.getByTestId(`nursing-answer-placeholder-${quality}`)).toHaveValue(play);
        expect(
          screen.getByTestId(`nursing-answer-placeholder-preview-${quality}`),
        ).toHaveTextContent(play);
        expect(
          screen.getByTestId(`nursing-answer-placeholder-preview-${quality}`),
        ).not.toHaveTextContent(texts.start);
      }
    } finally {
      vi.unstubAllGlobals();
      if (existsSync(caseFile)) {
        unlinkSync(caseFile);
      }
    }
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
    expect(screen.getByLabelText('Vraag voor de student')).toBeInTheDocument();
    expect(screen.queryByTestId('logopedie-avatar')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('editor-nursing-preview-stage').closest('.editor-preview'),
    ).toHaveClass('editor-card');

    const sheet = screen.getByTestId('nursing-step-sheet');
    const name = screen.getByTestId('nursing-step-name');
    expect(name).toHaveValue('Vraag.1');
    expect(name.tagName).toBe('INPUT');
    expect(name.closest('.editor-nodes')).toBeTruthy();
    expect(sheet.contains(name)).toBe(false);
    expect(sheet.querySelector('[data-testid="nursing-step-name"]')).toBeNull();
    const shown = screen.getByTestId('nursing-step-title');
    expect(sheet.contains(shown)).toBe(true);
    expect(shown.tagName).not.toBe('INPUT');
    expect(shown.tagName).not.toBe('TEXTAREA');
    expect(shown).toHaveTextContent('Vraag.1');
    const top = sheet.querySelector('.nursing-step-top');
    expect(top).toBeTruthy();
    expect(shown.compareDocumentPosition(top!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(top?.querySelector('[data-testid="nursing-step-video"]')).toBeTruthy();
    expect(top?.querySelector('#nursing-phase')).toBeTruthy();
    expect(top?.querySelector('#nursing-question')).toBeTruthy();
    const columns = sheet.querySelectorAll('.nursing-step-answer-col');
    expect(columns).toHaveLength(3);
    expect(columns[0]).toHaveTextContent('Antwoord 1');
    expect(columns[0]).toHaveTextContent('Bij goed antwoord play video');
    expect(columns[0]?.querySelector('[data-testid="nursing-answer-video-high"]')).toBeTruthy();
    expect(columns[1]).toHaveTextContent('Antwoord 2');
    expect(columns[1]).toHaveTextContent('Bij deels goed antwoord play video');
    expect(columns[2]).toHaveTextContent('Antwoord 3');
    expect(columns[2]).toHaveTextContent('Bij verkeerd antwoord play video');
    const optionCard = columns[0]?.querySelector('[data-testid="nursing-option-editor-n-1-high"]');
    const answerVideo = columns[0]?.querySelector('[data-testid="nursing-answer-video-high"]');
    expect(optionCard).toBeTruthy();
    expect(answerVideo).toBeTruthy();
    expect(columns[0]?.querySelector('[data-testid="btn-optional-video-n-1-high"]')).toBeNull();
    expect(optionCard).toContainElement(answerVideo as HTMLElement);
    expect(screen.queryByText('Optionele video toevoegen')).not.toBeInTheDocument();
    expect(screen.queryByText('Video bij dit antwoord')).not.toBeInTheDocument();
  });

  it('resets one nursing step and leaves the next step filled', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await user.click(screen.getByTestId('editor-module-nursing'));
    await waitFor(() => {
      expect(screen.getByTestId('nursing-question')).toHaveValue('');
    });
    expect(screen.queryByDisplayValue(/ABCDE|SBAR/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: 'Vraag een' } });
    fireEvent.change(screen.getByTestId('nursing-option-text-n-1-high'), {
      target: { value: 'Antwoord een' },
    });
    await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
    fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
      target: { value: 'Film de start' },
    });
    await user.click(screen.getByTestId('btn-nursing-step-placeholder-save'));
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    fireEvent.change(screen.getByTestId('nursing-question'), { target: { value: 'Vraag twee' } });
    await user.click(screen.getByTestId('nursing-step-tab-n-1'));
    await user.click(screen.getByTestId('btn-reset-nursing-step-n-1'));
    expect(screen.getByTestId('nursing-question')).toHaveValue('');
    expect(screen.getByTestId('nursing-option-text-n-1-high')).toHaveValue('');
    expect(screen.queryByDisplayValue('Film de start')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('nursing-step-tab-n-extra-1'));
    expect(screen.getByTestId('nursing-question')).toHaveValue('Vraag twee');
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

    expect(screen.queryByRole('button', { name: 'Printlijst' })).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-nodes'));
    await user.click(screen.getByTestId('btn-task-list'));
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
    expect(screen.getByTestId('node-overview')).toBeInTheDocument();
    await user.click(screen.getByTestId('btn-nodes-back'));
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
    expect(screen.queryByTestId('btn-node-new-question')).not.toBeInTheDocument();
    expect(screen.getAllByText('Scenario In').length).toBeGreaterThan(0);
    expect(screen.queryByText('Scenario input')).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag drie');

    await user.click(screen.getByTestId('btn-test-close'));
    await user.click(screen.getByTestId('btn-start-test'));
    await user.click(screen.getByTestId('test-option-partial'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag twee');
    await user.click(screen.getByTestId('test-option-partial'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag drie');

    await user.click(screen.getByTestId('btn-test-close'));
    await user.click(screen.getByTestId('btn-start-test'));
    await user.click(screen.getByTestId('test-option-inappropriate'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-media-stage')).toContainElement(
      screen.getByTestId('test-placeholder'),
    );
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Verkeerd antwoord');
    await user.click(screen.getByTestId('btn-test-continue'));
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
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('btn-test-continue'));
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('screen-scenario-test-results')).toBeInTheDocument();
    expect(screen.queryByTestId('score-value')).not.toBeInTheDocument();
    expect(screen.queryByText('Competentie scores')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('btn-test-close'));
    await user.click(screen.getByTestId('nursing-step-tab-n-1'));
    expect(screen.getByTestId('nursing-question')).toHaveValue('Vraag een');
    expect(screen.getByTestId('nursing-step-placeholder')).toHaveValue('Plaatshouder een');
  });

  it('adds Vraag.4 from Node Modus and shows that same question in the editor and test', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    await user.click(screen.getByTestId('btn-add-nursing-step'));
    await user.click(screen.getByTestId('btn-nodes'));
    await user.click(screen.getByTestId('btn-node-new-question'));

    const emptyButton = screen.getByRole('button', { name: 'Leeg' });
    const stepId = emptyButton.getAttribute('data-testid')?.replace('btn-node-empty-', '') ?? '';
    expect(screen.getByTestId(`node-question-${stepId}`)).toHaveTextContent('Vraag.4');
    await user.click(emptyButton);

    const wizard = screen.getByTestId('node-question-wizard');
    const width = wizard.style.width;
    const height = wizard.style.height;
    expect(width.endsWith('px')).toBe(true);
    expect(height.endsWith('px')).toBe(true);
    const left = Number.parseFloat(wizard.style.left);
    const top = Number.parseFloat(wizard.style.top);
    fireEvent.pointerDown(screen.getByTestId('node-wizard-bar'), {
      clientX: 10,
      clientY: 12,
      button: 0,
    });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 36 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 36 });
    expect(wizard.style.width).toBe(width);
    expect(wizard.style.height).toBe(height);
    expect(Number.parseFloat(wizard.style.left)).toBe(left + 40);
    expect(Number.parseFloat(wizard.style.top)).toBe(top + 24);

    fireEvent.pointerDown(screen.getByTestId('node-wizard-resize'), {
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(window, { clientX: 36, clientY: 28 });
    fireEvent.pointerUp(window, { clientX: 36, clientY: 28 });
    const resizedWidth = wizard.style.width;
    const resizedHeight = wizard.style.height;
    expect(resizedWidth).not.toBe(width);
    expect(resizedHeight).not.toBe(height);

    fireEvent.change(screen.getByTestId('node-wizard-phase'), {
      target: { value: 'Nacht op de afdeling' },
    });
    await user.click(screen.getByTestId('btn-node-wizard-next'));
    expect(wizard.style.width).toBe(resizedWidth);
    expect(wizard.style.height).toBe(resizedHeight);
    await user.click(screen.getByTestId('btn-node-wizard-back'));
    expect(screen.getByTestId('node-wizard-phase')).toHaveValue('Nacht op de afdeling');
    expect(wizard.style.width).toBe(resizedWidth);
    expect(wizard.style.height).toBe(resizedHeight);

    await user.click(screen.getByTestId('btn-node-wizard-next'));
    await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
    fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
      target: { value: 'Startzin vraag vier' },
    });
    await user.click(screen.getByTestId('btn-node-wizard-next'));
    fireEvent.change(screen.getByTestId('node-wizard-question'), {
      target: { value: 'Wat doe je eerst?' },
    });
    await user.click(screen.getByTestId('btn-node-wizard-next'));
    expect(screen.getByText('Bij goed antwoord play video')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId(`nursing-option-text-${stepId}-high`), {
      target: { value: 'Eerst meten' },
    });
    await user.click(screen.getByTestId('btn-node-wizard-next'));
    expect(screen.getByText('Bij deels goed antwoord play video')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId(`nursing-option-text-${stepId}-partial`), {
      target: { value: 'Alleen kijken' },
    });
    await user.click(screen.getByTestId('btn-node-wizard-next'));
    expect(screen.getByText('Bij verkeerd antwoord play video')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId(`nursing-option-text-${stepId}-inappropriate`), {
      target: { value: 'Niets doen' },
    });
    await user.click(screen.getByTestId('btn-node-wizard-next'));
    expect(wizard.style.width).toBe(resizedWidth);
    expect(wizard.style.height).toBe(resizedHeight);
    const preview = screen.getByTestId('node-wizard-preview');
    expect(preview).toHaveTextContent('Nacht op de afdeling');
    expect(preview).toHaveTextContent('Wat doe je eerst?');
    expect(preview).toHaveTextContent('Startzin vraag vier');
    expect(preview).toHaveTextContent('Eerst meten');
    await user.click(screen.getByTestId('btn-node-wizard-save'));

    expect(screen.queryByRole('button', { name: 'Leeg' })).not.toBeInTheDocument();
    expect(screen.getByTestId(`node-question-${stepId}`)).toHaveTextContent('Wat doe je eerst?');
    expect(screen.getByTestId(`node-question-${stepId}`)).toHaveTextContent('Nacht op de afdeling');

    await user.click(screen.getByTestId('btn-nodes-back'));
    expect(screen.getByTestId('nursing-step-name')).toHaveValue('Vraag.4');
    expect(screen.getByTestId('nursing-phase')).toHaveValue('Nacht op de afdeling');
    expect(screen.getByTestId('nursing-question')).toHaveValue('Wat doe je eerst?');
    expect(screen.getByTestId('nursing-step-placeholder')).toHaveValue('Startzin vraag vier');
    expect(screen.getByTestId(`nursing-option-text-${stepId}-high`)).toHaveValue('Eerst meten');
    expect(screen.getByTestId(`nursing-option-text-${stepId}-partial`)).toHaveValue(
      'Alleen kijken',
    );
    expect(screen.getByTestId(`nursing-option-text-${stepId}-inappropriate`)).toHaveValue(
      'Niets doen',
    );
    expect(screen.getByTestId('nursing-step-tab-n-1')).toBeInTheDocument();
    expect(screen.getByTestId('nursing-step-tab-n-extra-1')).toBeInTheDocument();
    expect(screen.getByTestId('nursing-step-tab-n-extra-2')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('nursing-step-name'), { target: { value: 'Nazorg' } });
    await user.click(screen.getByTestId('btn-nodes'));
    expect(screen.getByTestId(`node-question-${stepId}`)).toHaveTextContent('Nazorg');

    const previous = document.elementFromPoint;
    document.elementFromPoint = () =>
      document.querySelector(`[data-port="q-in-${stepId}"]`) as Element;
    try {
      const from = document.querySelector('[data-port="a-out-n-1-high"]');
      if (!(from instanceof HTMLElement)) {
        throw new Error('Uitgang ontbreekt.');
      }
      act(() => {
        fireEvent.pointerDown(from, { clientX: 3, clientY: 3, button: 0 });
        window.dispatchEvent(
          new PointerEvent('pointerup', { clientX: 18, clientY: 18, bubbles: true }),
        );
      });
    } finally {
      document.elementFromPoint = previous;
    }
    expect(screen.getByTestId(`node-wire-a-out-n-1-high-to-q-in-${stepId}`)).toBeInTheDocument();

    await user.click(screen.getByTestId('btn-nodes-back'));
    await user.click(screen.getByTestId('btn-start-test'));
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-step-title')).toHaveTextContent('Nazorg');
    expect(screen.getByTestId('test-question')).toHaveTextContent('Wat doe je eerst?');
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Startzin vraag vier');
    expect(screen.getByTestId('test-option-high')).toHaveTextContent('Eerst meten');
  });

  it('deletes one node question and keeps the other question and its line', async () => {
    const user = userEvent.setup();
    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('editor-module-nursing'));
    await user.click(screen.getByTestId('btn-add-nursing-step'));
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
      drop('a-out-n-1-high', 'q-in-n-extra-1');
      drop('a-out-n-1-partial', 'q-in-n-1');
    } finally {
      document.elementFromPoint = previous;
    }

    await user.click(screen.getByTestId('btn-node-menu-n-extra-1'));
    await user.click(screen.getByTestId('btn-node-delete-n-extra-1'));
    expect(screen.queryByTestId('node-question-n-extra-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('node-question-n-1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('node-wire-a-out-n-1-high-to-q-in-n-extra-1'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('node-wire-a-out-n-1-partial-to-q-in-n-1')).toBeInTheDocument();

    await user.click(screen.getByTestId('btn-nodes-back'));
    expect(screen.queryByTestId('nursing-step-tab-n-extra-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('nursing-step-name')).toHaveValue('Vraag.1');
    await user.click(screen.getByTestId('btn-nodes'));
    expect(screen.getByTestId('node-wire-a-out-n-1-partial-to-q-in-n-1')).toBeInTheDocument();
    expect(screen.queryByTestId('node-question-n-extra-1')).not.toBeInTheDocument();
  });

  it('creates a question folder, uploads into Videos, and keeps the text after restart', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vraagmap');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const root = join(tmpdir(), `vraagmap-editor-${Date.now()}`);
    const caseFile = join(root, 'verpleegkunde.json');
    const kept = join(root, 'gesprekstechnieken', 'oud.mp4');
    mkdirSync(join(root, 'gesprekstechnieken'), { recursive: true });
    writeFileSync(kept, 'bestaand', 'utf8');
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (init?.method === 'POST' && target.includes('question-folder')) {
        const body = JSON.parse(String(init.body)) as {
          folder: string;
          files: Record<string, string>;
        };
        const written = writeQuestionFolderFiles(root, body.folder, body.files);
        return new Response(JSON.stringify(written), {
          status: written.ok ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (init?.method === 'DELETE' && target.includes('verpleegkunde-media')) {
        const parsed = new URL(target, 'http://127.0.0.1');
        const relative = parsed.searchParams.get('path') ?? '';
        const file = join(root, ...relative.split('/'));
        if (existsSync(file)) {
          unlinkSync(file);
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (init?.method === 'POST' && target.includes('verpleegkunde-media')) {
        const body = JSON.parse(String(init.body)) as { relativePath: string };
        const parts = body.relativePath.split('/');
        mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
        writeFileSync(join(root, ...parts), 'video', 'utf8');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (init?.method === 'POST' && target.includes('save-verpleegkunde')) {
        writeFileSync(caseFile, String(init.body), 'utf8');
        return new Response(
          JSON.stringify({ ok: true, file: 'resources/scenarios/verpleegkunde.json' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (target.includes('verpleegkunde.json') && existsSync(caseFile)) {
        return new Response(readFileSync(caseFile, 'utf8'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const first = render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('editor-module-nursing'));
      fireEvent.change(screen.getByTestId('nursing-title'), {
        target: { value: 'Slechtnieuwsgesprek' },
      });
      fillNursingTexts('Eerste vraag');
      await user.click(screen.getByTestId('nursing-step-mode-video'));
      await user.upload(
        screen.getByTestId('input-nursing-step-upload'),
        new File([new Uint8Array([1])], 'oud.mp4', { type: 'video/mp4' }),
      );
      expect(screen.getByTestId('nursing-step-video-path')).toHaveTextContent(
        'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-Vraag1-startvideo.mp4',
      );

      await user.click(screen.getByTestId('btn-add-nursing-step'));
      expect(screen.getByTestId('nursing-step-name')).toHaveValue('Vraag.2');
      const folderPosts = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('question-folder'),
      );
      const created = JSON.parse(String(folderPosts[0]?.[1]?.body)) as {
        folder: string;
        files: Record<string, string>;
      };
      expect(created.folder).toBe('gesprekstechnieken/Slechtnieuwsgesprek-Vraag2');
      expect(created.files['vraag-startvideo.txt']).toBe('');
      expect(existsSync(join(root, created.folder, 'Videos'))).toBe(true);

      await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
      fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
        target: { value: 'Start van vraag twee' },
      });
      await user.click(screen.getByTestId('nursing-answer-mode-video-high'));
      await user.upload(
        screen.getByTestId('input-nursing-answer-upload-high'),
        new File([new Uint8Array([2])], 'ander.mp4', { type: 'video/mp4' }),
      );
      expect(screen.getByTestId('nursing-answer-video-path-high')).toHaveTextContent(
        'gesprekstechnieken/Slechtnieuwsgesprek-Vraag2/Videos/antwoord-goed.mp4',
      );
      await user.click(screen.getByTestId('nursing-step-mode-video'));
      await user.upload(
        screen.getByTestId('input-nursing-step-upload'),
        new File([new Uint8Array([4])], 'start-origineel.mp4', { type: 'video/mp4' }),
      );
      expect(screen.getByTestId('nursing-step-video-path')).toHaveTextContent(
        'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-Vraag2-startvideo.mp4',
      );

      await user.click(screen.getByTestId('btn-save-json'));
      expect(await screen.findByTestId('editor-save-ok')).toBeInTheDocument();
      expect(existsSync(kept)).toBe(true);
      expect(
        existsSync(join(root, 'gesprekstechnieken/Slechtnieuwsgesprek-Vraag2/Videos/oud.mp4')),
      ).toBe(false);
      expect(
        existsSync(
          join(root, 'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-Vraag2-startvideo.mp4'),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(root, 'gesprekstechnieken/Slechtnieuwsgesprek-Vraag2/Videos/vraag-startvideo.mp4'),
        ),
      ).toBe(false);
      expect(
        existsSync(
          join(root, 'gesprekstechnieken/Slechtnieuwsgesprek-Vraag2/Videos/antwoord-goed.mp4'),
        ),
      ).toBe(true);
      expect(
        readFileSync(
          join(root, 'gesprekstechnieken/Slechtnieuwsgesprek-Vraag2/vraag-startvideo.txt'),
          'utf8',
        ),
      ).toBe('Start van vraag twee');

      first.unmount();
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('nursing-title')).toHaveValue('Slechtnieuwsgesprek');
      });
      await user.click(screen.getByTestId('nursing-step-tab-n-extra-1'));
      expect(screen.getByTestId('nursing-step-video-path')).toHaveTextContent(
        'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-Vraag2-startvideo.mp4',
      );
      await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
      expect(screen.getByTestId('dialog-placeholder-delete-step')).toBeInTheDocument();
      await user.click(screen.getByTestId('btn-confirm-placeholder-delete-step'));
      expect(screen.getByTestId('nursing-step-placeholder')).toHaveValue('Start van vraag twee');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('undoes a deleted node question and restores its folder', async () => {
    const user = userEvent.setup();
    const root = join(tmpdir(), `vraagmap-undo-${Date.now()}`);
    const kept = join(root, 'gesprekstechnieken', 'oud.mp4');
    mkdirSync(join(root, 'gesprekstechnieken'), { recursive: true });
    writeFileSync(kept, 'bestaand', 'utf8');
    const folder = 'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3';
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (init?.method === 'POST' && target.includes('question-folder')) {
        const body = JSON.parse(String(init.body)) as {
          action?: string;
          folder: string;
          files?: Record<string, string> | { name: string; contentBase64: string }[];
        };
        if (body.action === 'delete') {
          const removed = removeQuestionFolder(root, body.folder);
          return new Response(JSON.stringify(removed), {
            status: removed.ok ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (body.action === 'restore' && Array.isArray(body.files)) {
          const restored = restoreQuestionFolderBackup(root, body.folder, body.files);
          return new Response(JSON.stringify(restored), {
            status: restored.ok ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const written = writeQuestionFolderFiles(
          root,
          body.folder,
          (body.files ?? {}) as Record<string, string>,
        );
        return new Response(JSON.stringify(written), {
          status: written.ok ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      render(<EditorApp />);
      await waitFor(() => {
        expect(screen.getByTestId('editor-module-nursing')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('editor-module-nursing'));
      fireEvent.change(screen.getByTestId('nursing-title'), {
        target: { value: 'Slechtnieuwsgesprek oefenen' },
      });
      await user.click(screen.getByTestId('btn-nodes'));
      const undo = screen.getByTestId('btn-node-undo');
      expect(undo).toBeDisabled();
      expect(undo.parentElement?.querySelector('button')).toBe(undo);
      await user.click(screen.getByTestId('btn-node-new-question'));
      await user.click(screen.getByTestId('btn-node-new-question'));
      expect(screen.getByTestId('node-question-n-extra-2')).toHaveTextContent('Vraag.3');
      expect(screen.getByTestId('btn-node-undo')).toBeEnabled();
      await user.click(screen.getByTestId('btn-nodes-back'));
      await user.click(screen.getByTestId('nursing-step-mode-placeholder'));
      fireEvent.change(screen.getByTestId('nursing-step-placeholder'), {
        target: { value: 'tekst blijft' },
      });
      const note = join(root, folder, 'vraag-startvideo.txt');
      const video = join(root, folder, 'Videos', 'antwoord-goed.mp4');
      await waitFor(() => {
        expect(readFileSync(note, 'utf8')).toBe('tekst blijft');
      });
      writeFileSync(video, 'beeld', 'utf8');
      await user.click(screen.getByTestId('btn-nodes'));
      await user.click(screen.getByTestId('btn-node-menu-n-extra-2'));
      await user.click(screen.getByTestId('btn-node-delete-n-extra-2'));
      expect(screen.queryByTestId('node-question-n-extra-2')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(existsSync(join(root, folder))).toBe(false);
      });
      expect(readFileSync(kept, 'utf8')).toBe('bestaand');
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });
      await user.click(screen.getByTestId('btn-node-undo'));
      await waitFor(() => {
        expect(screen.getByTestId('node-question-n-extra-2')).toBeInTheDocument();
        expect(readFileSync(video, 'utf8')).toBe('beeld');
        expect(readFileSync(note, 'utf8')).toBe('tekst blijft');
      });
      expect(readFileSync(kept, 'utf8')).toBe('bestaand');
      await user.click(screen.getByTestId('btn-node-undo'));
      await waitFor(() => {
        expect(existsSync(join(root, folder))).toBe(false);
      });
      expect(screen.queryByTestId('node-question-n-extra-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('node-question-n-extra-1')).toBeInTheDocument();
      expect(existsSync(join(root, 'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag2'))).toBe(
        true,
      );
      expect(readFileSync(kept, 'utf8')).toBe('bestaand');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uploads vraag 3 and the start video, edits a node, and keeps the wrong-answer line', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vraag3');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const root = join(tmpdir(), `vraag3-upload-${Date.now()}`);
    const loose = join(root, 'gesprekstechnieken', 'Staat is pijn.mp4');
    mkdirSync(join(root, 'gesprekstechnieken'), { recursive: true });
    writeFileSync(loose, 'los-bestand', 'utf8');
    const caseText = readFileSync(join('resources', 'scenarios', 'verpleegkunde.json'), 'utf8');
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.includes('/editor-api/cases')) {
        return new Response(
          JSON.stringify({
            ok: true,
            cases: [
              {
                file: 'verpleegkunde.json',
                title: 'Slechtnieuwsgesprek oefenen',
                savedAt: '2026-10-05T08:15:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (init?.method === 'POST' && target.includes('save-verpleegkunde')) {
        return new Response(
          JSON.stringify({ ok: true, file: 'resources/scenarios/verpleegkunde.json' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (init?.method === 'POST' && target.includes('verpleegkunde-media')) {
        const body = JSON.parse(String(init.body)) as { relativePath: string };
        const parts = body.relativePath.split('/');
        mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
        writeFileSync(join(root, ...parts), 'video', 'utf8');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (target.includes('verpleegkunde.json')) {
        return new Response(caseText, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      render(<EditorApp />);
      await user.click(screen.getByTestId('editor-module-nursing'));
      await waitFor(() => {
        expect(screen.getByTestId('nursing-title')).toHaveValue('Slechtnieuwsgesprek oefenen');
      });
      expect(screen.getByRole('heading', { name: 'Voorbeeld - Vraag.1' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Beschikbare media' })).toBeInTheDocument();

      await user.click(screen.getByTestId('btn-open-json'));
      expect(await screen.findByTestId('dialog-open-case')).toBeInTheDocument();
      await user.click(screen.getByTestId('btn-open-case-back'));
      expect(screen.queryByTestId('dialog-open-case')).not.toBeInTheDocument();
      expect(screen.getByTestId('nursing-title')).toHaveValue('Slechtnieuwsgesprek oefenen');

      await user.click(screen.getByTestId('nursing-step-tab-n-extra-2'));
      expect(screen.getByRole('heading', { name: 'Voorbeeld - Vraag.3' })).toBeInTheDocument();
      await user.click(screen.getByTestId('nursing-answer-mode-video-high'));
      expect(screen.getByTestId('nursing-answer-upload-target-high')).toHaveTextContent(
        'resources/gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/Videos/antwoord-goed.mp4',
      );
      await user.upload(
        screen.getByTestId('input-nursing-answer-upload-high'),
        new File([new Uint8Array([3])], 'goed.mp4', { type: 'video/mp4' }),
      );
      await user.click(screen.getByTestId('nursing-step-mode-video'));
      expect(screen.getByTestId('nursing-step-upload-target')).toHaveTextContent(
        'resources/gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-oefenen-Vraag3-startvideo.mp4',
      );
      await user.upload(
        screen.getByTestId('input-nursing-step-upload'),
        new File([new Uint8Array([4])], 'start.mp4', { type: 'video/mp4' }),
      );
      await user.click(screen.getByTestId('btn-save-json'));
      expect(await screen.findByTestId('editor-save-ok')).toBeInTheDocument();
      expect(
        readFileSync(
          join(
            root,
            'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/Videos/antwoord-goed.mp4',
          ),
          'utf8',
        ),
      ).toBe('video');
      expect(
        readFileSync(
          join(
            root,
            'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-oefenen-Vraag3-startvideo.mp4',
          ),
          'utf8',
        ),
      ).toBe('video');
      expect(readFileSync(loose, 'utf8')).toBe('los-bestand');
      expect(
        existsSync(
          join(
            root,
            'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/Videos/Staat is pijn.mp4',
          ),
        ),
      ).toBe(false);

      await user.click(screen.getByTestId('btn-nodes'));
      expect(
        screen.getByTestId('node-wire-a-out-n-extra-2-inappropriate-to-q-in-n-extra-2'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('node-wire-a-out-n-extra-9-high-to-q-in-completed'),
      ).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-node-edit-n-1'));
      fireEvent.change(screen.getByTestId('nursing-question'), {
        target: { value: 'Wat zeg je als eerste, in je eigen woorden?' },
      });
      await user.click(screen.getByTestId('btn-node-edit-save'));
      expect(screen.getByTestId('node-question-n-1')).toHaveTextContent(
        'Wat zeg je als eerste, in je eigen woorden?',
      );
      await user.click(screen.getByTestId('btn-nodes-back'));
      expect(screen.getByTestId('nursing-question')).toHaveValue(
        'Wat zeg je als eerste, in je eigen woorden?',
      );
      expect(screen.getByTestId('nursing-title')).toHaveValue('Slechtnieuwsgesprek oefenen');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('asks before a placeholder replaces an uploaded video and then deletes that file', async () => {
    const user = userEvent.setup();
    const root = join(tmpdir(), `placeholder-delete-${Date.now()}`);
    const video = join(
      root,
      'gesprekstechnieken',
      'Slechtnieuwsgesprek oefenen-Vraag3',
      'Videos',
      'antwoord-goed.mp4',
    );
    const loose = join(root, 'gesprekstechnieken', 'Staat is pijn.mp4');
    mkdirSync(join(video, '..'), { recursive: true });
    writeFileSync(video, 'antwoord-goed', 'utf8');
    mkdirSync(join(root, 'gesprekstechnieken'), { recursive: true });
    writeFileSync(loose, 'los-bestand', 'utf8');
    const caseText = readFileSync(join('resources', 'scenarios', 'verpleegkunde.json'), 'utf8');
    const keptPlaceholder = 'Close-up: vrouw knikt langzaam en haar schouders zakken.';
    const projectVideo = join(
      'resources',
      'gesprekstechnieken',
      'Slechtnieuwsgesprek oefenen-Vraag3',
      'Videos',
      'antwoord-goed.mp4',
    );
    const projectVideoExisted = existsSync(projectVideo);
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.includes('/editor-api/cases')) {
        return new Response(
          JSON.stringify({
            ok: true,
            cases: [
              {
                file: 'verpleegkunde.json',
                title: 'Slechtnieuwsgesprek oefenen',
                savedAt: '2026-10-05T08:15:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (init?.method === 'DELETE' && target.includes('verpleegkunde-media')) {
        const parsed = new URL(target, 'http://127.0.0.1');
        const relative = parsed.searchParams.get('path') ?? '';
        const file = join(root, ...relative.split('/'));
        if (existsSync(file)) {
          unlinkSync(file);
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (target.includes('verpleegkunde.json')) {
        return new Response(caseText, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      render(<EditorApp />);
      await user.click(screen.getByTestId('editor-module-nursing'));
      await waitFor(() => {
        expect(screen.getByTestId('nursing-title')).toHaveValue('Slechtnieuwsgesprek oefenen');
      });
      await user.click(screen.getByTestId('nursing-step-tab-n-extra-2'));
      expect(screen.getByTestId('nursing-answer-video-path-high')).toHaveTextContent(
        'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3/Videos/antwoord-goed.mp4',
      );
      await user.click(screen.getByTestId('nursing-answer-mode-placeholder-high'));
      expect(screen.getByTestId('dialog-placeholder-delete-high')).toBeInTheDocument();
      expect(existsSync(video)).toBe(true);
      await user.click(screen.getByTestId('btn-cancel-placeholder-delete-high'));
      expect(screen.queryByTestId('dialog-placeholder-delete-high')).not.toBeInTheDocument();
      expect(screen.getByTestId('nursing-answer-video-path-high')).toHaveTextContent(
        'antwoord-goed.mp4',
      );
      expect(existsSync(video)).toBe(true);
      await user.click(screen.getByTestId('nursing-answer-mode-placeholder-high'));
      await user.click(screen.getByTestId('btn-confirm-placeholder-delete-high'));
      await waitFor(() => {
        expect(existsSync(video)).toBe(false);
      });
      expect(screen.getByTestId('nursing-answer-placeholder-high')).toHaveValue(keptPlaceholder);
      expect(readFileSync(loose, 'utf8')).toBe('los-bestand');
      await user.click(screen.getByTestId('nursing-answer-mode-video-high'));
      expect(screen.getByTestId('nursing-answer-video-path-high')).toHaveTextContent(
        'Geen video gekoppeld.',
      );
      expect(existsSync(projectVideo)).toBe(projectVideoExisted);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
