import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditorApp } from './EditorApp';

vi.mock('./editorHost', () => ({
  canSaveToThisCopy: () => false,
}));

const buttonIds = [
  'btn-new-scenario',
  'btn-open-json',
  'btn-nodes',
  'btn-start-test',
  'btn-save-json',
  'btn-save-as-case',
  'btn-download-json',
  'btn-reset-seed',
  'btn-import-package',
  'btn-holobox-package',
  'btn-delete-case',
  'btn-editor-quit',
];

describe('EditorApp on GitHub Pages', () => {
  it('downloads, opens the file picker, and clears the case in memory', async () => {
    const user = userEvent.setup();
    const downloads: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pages');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick(
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<EditorApp />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: nieuwe casus');
    });

    for (const id of buttonIds) {
      expect(screen.getByTestId(id)).toBeVisible();
    }
    expect(screen.getByTestId('btn-import-package')).toHaveTextContent('Casus importeren');
    expect(screen.getByTestId('input-import-package')).toHaveAttribute(
      'accept',
      '.json,application/json,.zip,application/zip',
    );

    await user.click(screen.getByTestId('btn-save-json'));
    await user.click(screen.getByTestId('btn-save-as-case'));
    await user.click(screen.getByTestId('btn-download-json'));
    await user.click(screen.getByTestId('btn-holobox-package'));
    await waitFor(() => {
      expect(downloads.filter((name) => name.endsWith('.zip')).length).toBe(1);
    });
    const jsonNames = downloads.filter((name) => name.endsWith('.json'));
    expect(jsonNames.filter((name) => name === 'verpleegkunde.json').length).toBe(2);
    expect(
      jsonNames.some((name) => name.startsWith('verpleegkunde-') && name !== 'verpleegkunde.json'),
    ).toBe(true);
    expect(screen.queryByTestId('dialog-save-blocked')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('btn-import-package'));
    expect(inputClick).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('nursing-question'), {
      target: { value: 'Tekst die weer weg moet.' },
    });
    await user.click(screen.getByTestId('btn-delete-case'));
    await user.click(await screen.findByTestId('btn-delete-case-continue'));
    await user.click(await screen.findByTestId('btn-delete-case-confirm'));
    expect(screen.getByTestId('nursing-question')).toHaveValue('');
    expect(screen.getByTestId('editor-loaded-source')).toHaveTextContent('Geladen: nieuwe casus');
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('delete-case'))).toBe(
      false,
    );
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/editor-api/quit'))).toBe(
      false,
    );

    await user.click(screen.getByTestId('btn-editor-quit'));
    expect(await screen.findByTestId('editor-quit-notice')).toHaveTextContent('Sluit het tabblad');
    expect(close).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/editor-api/quit'))).toBe(
      false,
    );
  });
});
