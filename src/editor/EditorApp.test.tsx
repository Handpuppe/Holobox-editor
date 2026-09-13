import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { renderApp } from '../test/renderApp';
import { EditorApp } from './EditorApp';
import { LOGOPEDIE_ENVELOPE_FILENAME } from './envelope';

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

    expect(screen.getByTestId('screen-scenario-editor')).toBeInTheDocument();
    expect(screen.getByTestId('editor-issues-ok')).toHaveTextContent('Geen validatiefouten.');
    expect(screen.getByTestId('logopedie-avatar')).toBeInTheDocument();
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
    expect(screen.getByTestId('screen-logopedie-home')).toBeInTheDocument();
  });
});
