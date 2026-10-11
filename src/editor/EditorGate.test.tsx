import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorGate } from './EditorGate';
import {
  EDITOR_LOCK_STORAGE_KEY,
  closeEditorSession,
  createEditorLock,
  readEditorLock,
  writeEditorLock,
} from './editorLock';

async function setFirstPassword(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
): Promise<string> {
  const adminCode = screen.getByTestId('editor-admin-code').textContent?.trim() ?? '';
  expect(adminCode.length).toBeGreaterThan(0);
  await user.click(screen.getByTestId('btn-set-editor-password'));
  expect(screen.getByTestId('editor-lock-error')).toHaveTextContent(
    'Bevestig dat je de admincode buiten de app hebt bewaard.',
  );
  expect(window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY)).toBeNull();
  await user.click(screen.getByTestId('editor-admin-saved'));
  await user.type(screen.getByTestId('editor-password'), password);
  await user.type(screen.getByTestId('editor-password-confirm'), `${password}-anders`);
  await user.click(screen.getByTestId('btn-set-editor-password'));
  expect(screen.getByTestId('editor-lock-error')).toHaveTextContent(
    'De wachtwoorden zijn niet hetzelfde.',
  );
  await user.clear(screen.getByTestId('editor-password-confirm'));
  await user.type(screen.getByTestId('editor-password-confirm'), password);
  await user.click(screen.getByTestId('btn-set-editor-password'));
  return adminCode;
}

function expectEditorClosed() {
  expect(screen.queryByTestId('screen-scenario-editor')).not.toBeInTheDocument();
  expect(screen.queryByTestId('btn-nodes')).not.toBeInTheDocument();
  expect(screen.queryByTestId('nursing-question')).not.toBeInTheDocument();
  expect(screen.queryByText('Antwoord keuze')).not.toBeInTheDocument();
  expect(screen.queryByText('Goed antwoord')).not.toBeInTheDocument();
}

describe('EditorGate', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(window, 'fetch').mockRejectedValue(new Error('gesloten'));
  });

  it('shows Afsluiten on the setup and login screens and asks for the stop script', async () => {
    const user = userEvent.setup();
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    render(<EditorGate />);
    expect(screen.getByTestId('screen-editor-setup')).toBeInTheDocument();
    expect(screen.getByTestId('btn-editor-quit')).toHaveTextContent('Afsluiten');
    await user.click(screen.getByTestId('btn-editor-quit'));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    const setupQuit = vi
      .mocked(window.fetch)
      .mock.calls.find((call) => String(call[0]).includes('/editor-api/quit?immediate=1'));
    expect(setupQuit?.[1]).toMatchObject({ method: 'POST' });
    expect(window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY)).toBeNull();

    cleanup();
    close.mockClear();
    vi.mocked(window.fetch).mockClear();
    const record = await createEditorLock('slot-wachtwoord', 'WACHT-CODE-BUIT-APPX');
    expect(writeEditorLock(record)).toBe(true);
    render(<EditorGate />);
    expect(screen.getByTestId('screen-editor-login')).toBeInTheDocument();
    expect(screen.getByTestId('btn-editor-quit')).toHaveTextContent('Afsluiten');
    await user.click(screen.getByTestId('btn-editor-quit'));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    const loginQuit = vi
      .mocked(window.fetch)
      .mock.calls.find((call) => String(call[0]).includes('/editor-api/quit?immediate=1'));
    expect(loginQuit?.[1]).toMatchObject({ method: 'POST' });
    expect(readEditorLock()).toEqual(record);
  });

  it('chooses a password, keeps a wrong password closed, and resets with the admin code', async () => {
    const user = userEvent.setup();
    const firstPassword = 'eerste-wachtwoord';
    const nextPassword = 'nieuw-wachtwoord';
    const first = render(<EditorGate />);

    expect(screen.getByTestId('screen-editor-setup')).toBeInTheDocument();
    expect(screen.getByTestId('editor-admin-warning')).toHaveTextContent(
      'Bewaar de admincode buiten de app. Hij wordt niet opnieuw getoond.',
    );
    expectEditorClosed();

    const adminCode = await setFirstPassword(user, firstPassword);
    expect(await screen.findByTestId('screen-scenario-editor')).toBeInTheDocument();
    expect(await screen.findByTestId('editor-load-notice')).toBeInTheDocument();
    const storedAfterSetup = window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY) ?? '';
    const adminHash = readEditorLock()?.adminHash;
    const firstPasswordHash = readEditorLock()?.passwordHash;
    expect(storedAfterSetup).not.toContain(firstPassword);
    expect(storedAfterSetup).not.toContain(adminCode);
    expect(storedAfterSetup).not.toContain(adminCode.replaceAll('-', ''));
    expect(adminHash).toBeTruthy();

    first.unmount();
    closeEditorSession();
    const callsBeforeWrongPassword = vi.mocked(window.fetch).mock.calls.length;
    render(<EditorGate />);

    expect(screen.getByTestId('screen-editor-login')).toBeInTheDocument();
    expect(screen.getByTestId('btn-forgot-password')).toHaveTextContent('Wachtwoord vergeten');
    expectEditorClosed();
    expect(vi.mocked(window.fetch).mock.calls.length).toBe(callsBeforeWrongPassword);

    await user.type(screen.getByTestId('editor-password'), 'fout-wachtwoord');
    await user.click(screen.getByTestId('btn-unlock-editor'));
    expect(await screen.findByTestId('editor-lock-error')).toHaveTextContent(
      'Het wachtwoord klopt niet.',
    );
    expectEditorClosed();
    expect(vi.mocked(window.fetch).mock.calls.length).toBe(callsBeforeWrongPassword);
    expect(readEditorLock()?.passwordHash).toBe(firstPasswordHash);

    await user.click(screen.getByTestId('btn-forgot-password'));
    await user.type(screen.getByTestId('editor-admin-input'), 'FOUT-CODE');
    await user.click(screen.getByTestId('btn-check-admin-code'));
    expect(await screen.findByTestId('editor-lock-error')).toHaveTextContent(
      'De admincode klopt niet.',
    );
    expectEditorClosed();
    expect(screen.queryByTestId('editor-password')).not.toBeInTheDocument();
    expect(readEditorLock()?.adminHash).toBe(adminHash);
    expect(readEditorLock()?.passwordHash).toBe(firstPasswordHash);

    await user.clear(screen.getByTestId('editor-admin-input'));
    await user.type(screen.getByTestId('editor-admin-input'), adminCode.toLowerCase());
    await user.click(screen.getByTestId('btn-check-admin-code'));
    expect(await screen.findByTestId('editor-password')).toBeInTheDocument();
    expectEditorClosed();
    await user.type(screen.getByTestId('editor-password'), nextPassword);
    await user.type(screen.getByTestId('editor-password-confirm'), nextPassword);
    await user.click(screen.getByTestId('btn-set-new-password'));
    expect(await screen.findByTestId('screen-scenario-editor')).toBeInTheDocument();
    expect(await screen.findByTestId('editor-load-notice')).toBeInTheDocument();
    const storedAfterReset = window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY) ?? '';
    expect(readEditorLock()?.adminHash).toBe(adminHash);
    expect(readEditorLock()?.passwordHash).not.toBe(firstPasswordHash);
    expect(storedAfterReset).not.toContain(nextPassword);
    expect(storedAfterReset).not.toContain(adminCode);

    cleanup();
    closeEditorSession();
    render(<EditorGate />);
    expectEditorClosed();
    await user.type(screen.getByTestId('editor-password'), firstPassword);
    await user.click(screen.getByTestId('btn-unlock-editor'));
    expect(await screen.findByTestId('editor-lock-error')).toHaveTextContent(
      'Het wachtwoord klopt niet.',
    );
    expectEditorClosed();
    await user.clear(screen.getByTestId('editor-password'));
    await user.type(screen.getByTestId('editor-password'), nextPassword);
    await user.click(screen.getByTestId('btn-unlock-editor'));
    expect(await screen.findByTestId('screen-scenario-editor')).toBeInTheDocument();
  });
});
