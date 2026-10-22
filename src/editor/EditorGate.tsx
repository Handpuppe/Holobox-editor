import { useState } from 'react';
import { EditorApp } from './EditorApp';
import { EDITOR_QUIT_TAB_MESSAGE, requestEditorQuit } from './editorQuit';
import {
  closeEditorSession,
  createAdminCode,
  createEditorLock,
  isEditorSessionOpen,
  holdEditorPassword,
  openEditorSession,
  readEditorLock,
  resetEditorPassword,
  verifyAdminCode,
  verifyEditorPassword,
  writeEditorLock,
  type EditorLockRecord,
} from './editorLock';

function EditorQuitButton() {
  const [quitNotice, setQuitNotice] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="btn-editor-quit"
        onClick={() => {
          void requestEditorQuit().then((kind) => {
            if (kind === 'browser') {
              setQuitNotice(EDITOR_QUIT_TAB_MESSAGE);
            }
          });
        }}
      >
        Afsluiten
      </button>
      {quitNotice ? (
        <p className="editor-load-notice" data-testid="editor-quit-notice" role="status">
          {quitNotice}
        </p>
      ) : null}
    </>
  );
}

function LockError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className="editor-lock-error" data-testid="editor-lock-error" role="alert">
      {message}
    </p>
  );
}

function EditorSetup({ onSaved }: { onSaved: (record: EditorLockRecord) => void }) {
  const [adminCode] = useState(createAdminCode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savedOutside, setSavedOutside] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    if (!savedOutside) {
      setError('Bevestig dat je de admincode buiten de app hebt bewaard.');
      return;
    }
    if (password.trim().length === 0) {
      setError('Kies een editorwachtwoord.');
      return;
    }
    if (password !== confirmPassword) {
      setError('De wachtwoorden zijn niet hetzelfde.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await createEditorLock(password, adminCode);
      if (!writeEditorLock(next)) {
        setError('Het wachtwoord kon niet worden bewaard.');
        setBusy(false);
        return;
      }
      holdEditorPassword(password);
      openEditorSession();
      onSaved(next);
    } catch {
      setError('Het wachtwoord kon niet worden bewaard.');
      setBusy(false);
    }
  }

  return (
    <div className="editor-lock" data-testid="screen-editor-setup" lang="nl">
      <h1>Editorwachtwoord kiezen</h1>
      <p className="editor-lock-lead">
        Kies een editorwachtwoord. Zonder dit wachtwoord opent de editor geen casus, nodes of
        antwoorden.
      </p>
      <div className="field">
        <span id="editor-admin-code-label">Admincode, eenmalig</span>
        <p
          className="editor-lock-code"
          data-testid="editor-admin-code"
          aria-labelledby="editor-admin-code-label"
        >
          {adminCode}
        </p>
      </div>
      <p className="editor-lock-warning" data-testid="editor-admin-warning">
        Bewaar de admincode buiten de app. Hij wordt niet opnieuw getoond.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="editor-lock-check" htmlFor="editor-admin-saved">
          <input
            id="editor-admin-saved"
            type="checkbox"
            data-testid="editor-admin-saved"
            checked={savedOutside}
            onChange={(event) => setSavedOutside(event.target.checked)}
          />
          <span>Ik heb de admincode buiten de app bewaard.</span>
        </label>
        <div className="field">
          <label htmlFor="editor-password">Editorwachtwoord</label>
          <input
            id="editor-password"
            data-testid="editor-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="editor-password-confirm">Herhaal editorwachtwoord</label>
          <input
            id="editor-password-confirm"
            data-testid="editor-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <LockError message={error} />
        <button type="submit" className="btn" data-testid="btn-set-editor-password" disabled={busy}>
          Wachtwoord instellen
        </button>
      </form>
      <EditorQuitButton />
    </div>
  );
}

function EditorLogin({
  record,
  onForgot,
  onUnlocked,
}: {
  record: EditorLockRecord;
  onForgot: () => void;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    if (password.length === 0) {
      setError('Vul het editorwachtwoord in.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyEditorPassword(record, password);
      if (!ok) {
        setError('Het wachtwoord klopt niet.');
        setBusy(false);
        return;
      }
      holdEditorPassword(password);
      openEditorSession();
      onUnlocked();
    } catch {
      setError('Het wachtwoord klopt niet.');
      setBusy(false);
    }
  }

  return (
    <div className="editor-lock" data-testid="screen-editor-login" lang="nl">
      <h1>Editorwachtwoord</h1>
      <p className="editor-lock-lead">
        De editor opent pas na het editorwachtwoord. Zonder wachtwoord blijft de casus gesloten.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="field">
          <label htmlFor="editor-password">Editorwachtwoord</label>
          <input
            id="editor-password"
            data-testid="editor-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <LockError message={error} />
        <button type="submit" className="btn" data-testid="btn-unlock-editor" disabled={busy}>
          Open editor
        </button>
      </form>
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="btn-forgot-password"
        onClick={() => {
          closeEditorSession();
          onForgot();
        }}
      >
        Wachtwoord vergeten
      </button>
      <EditorQuitButton />
    </div>
  );
}

function EditorReset({
  record,
  onCancel,
  onSaved,
}: {
  record: EditorLockRecord;
  onCancel: () => void;
  onSaved: (record: EditorLockRecord) => void;
}) {
  const [adminCode, setAdminCode] = useState('');
  const [adminOk, setAdminOk] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function checkAdmin() {
    if (busy) {
      return;
    }
    if (adminCode.trim().length === 0) {
      setError('Vul de admincode in.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyAdminCode(record, adminCode);
      if (!ok) {
        setAdminOk(false);
        setError('De admincode klopt niet.');
        return;
      }
      setAdminOk(true);
    } catch {
      setAdminOk(false);
      setError('De admincode klopt niet.');
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword() {
    if (busy) {
      return;
    }
    if (password.trim().length === 0) {
      setError('Kies een editorwachtwoord.');
      return;
    }
    if (password !== confirmPassword) {
      setError('De wachtwoorden zijn niet hetzelfde.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await resetEditorPassword(record, adminCode, password);
      if (!next) {
        setAdminOk(false);
        setError('De admincode klopt niet.');
        setBusy(false);
        return;
      }
      if (!writeEditorLock(next)) {
        setError('Het wachtwoord kon niet worden bewaard.');
        setBusy(false);
        return;
      }
      holdEditorPassword(password);
      openEditorSession();
      onSaved(next);
    } catch {
      setError('Het wachtwoord kon niet worden bewaard.');
      setBusy(false);
    }
  }

  return (
    <div className="editor-lock" data-testid="screen-editor-reset" lang="nl">
      <h1>Nieuw editorwachtwoord</h1>
      <p className="editor-lock-lead">
        Vul de admincode in. De admincode blijft hetzelfde en wordt niet opnieuw getoond.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (adminOk) {
            void submitNewPassword();
            return;
          }
          void checkAdmin();
        }}
      >
        <div className="field">
          <label htmlFor="editor-admin-input">Admincode</label>
          <input
            id="editor-admin-input"
            data-testid="editor-admin-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={adminCode}
            readOnly={adminOk}
            onChange={(event) => setAdminCode(event.target.value)}
          />
        </div>
        {adminOk ? (
          <>
            <div className="field">
              <label htmlFor="editor-password">Nieuw editorwachtwoord</label>
              <input
                id="editor-password"
                data-testid="editor-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="editor-password-confirm">Herhaal editorwachtwoord</label>
              <input
                id="editor-password-confirm"
                data-testid="editor-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </>
        ) : null}
        <LockError message={error} />
        {adminOk ? (
          <button type="submit" className="btn" data-testid="btn-set-new-password" disabled={busy}>
            Nieuw wachtwoord instellen
          </button>
        ) : (
          <button type="submit" className="btn" data-testid="btn-check-admin-code" disabled={busy}>
            Controleer admincode
          </button>
        )}
      </form>
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="btn-lock-back"
        onClick={onCancel}
      >
        Terug
      </button>
    </div>
  );
}

export function EditorGate() {
  const [record, setRecord] = useState<EditorLockRecord | null>(() => readEditorLock());
  const [unlocked, setUnlocked] = useState(
    () => readEditorLock() !== null && isEditorSessionOpen(),
  );
  const [forgot, setForgot] = useState(false);

  if (unlocked && record) {
    return <EditorApp />;
  }
  if (!record) {
    return (
      <EditorSetup
        onSaved={(next) => {
          setRecord(next);
          setUnlocked(true);
        }}
      />
    );
  }
  if (forgot) {
    return (
      <EditorReset
        record={record}
        onCancel={() => setForgot(false)}
        onSaved={(next) => {
          setRecord(next);
          setForgot(false);
          setUnlocked(true);
        }}
      />
    );
  }
  return (
    <EditorLogin
      record={record}
      onForgot={() => setForgot(true)}
      onUnlocked={() => setUnlocked(true)}
    />
  );
}
