import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';
import { Dialog } from './Dialog';

export function SideAppMenu() {
  const navigate = useNavigate();
  const { discardSession, discardNursing } = useAppState();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'restart' | 'quit' | null>(null);
  const [quitBlocked, setQuitBlocked] = useState(false);

  function goHome() {
    setOpen(false);
    void navigate('/');
  }

  function restartApp() {
    discardSession();
    discardNursing();
    window.location.assign('/');
  }

  function quitApp() {
    window.close();
    window.setTimeout(() => {
      setQuitBlocked(true);
    }, 400);
  }

  return (
    <div className="side-menu" data-testid="side-app-menu">
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="btn-side-menu"
        aria-expanded={open}
        aria-controls="side-menu-options"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Menu sluiten' : 'Menu'}
      </button>
      {open ? (
        <div className="side-menu-list" id="side-menu-options">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-menu-home"
            onClick={goHome}
          >
            Terug naar Hoofdmenu
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-menu-restart"
            onClick={() => setConfirm('restart')}
          >
            Herstart de app
          </button>
          <button
            type="button"
            className="btn btn-danger"
            data-testid="btn-menu-quit"
            onClick={() => setConfirm('quit')}
          >
            Sluit de app volledig af
          </button>
        </div>
      ) : null}

      {confirm === 'restart' ? (
        <Dialog title="App herstarten?" testId="dialog-restart" onClose={() => setConfirm(null)}>
          <p>De huidige oefening wordt afgesloten en de app start opnieuw.</p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn"
              data-testid="btn-confirm-restart"
              onClick={restartApp}
            >
              Ja, herstarten
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>
              Annuleren
            </button>
          </div>
        </Dialog>
      ) : null}

      {confirm === 'quit' ? (
        <Dialog title="App afsluiten?" testId="dialog-quit" onClose={() => setConfirm(null)}>
          {quitBlocked ? (
            <p>
              Deze browser laat sluiten vanuit de app niet toe. Gebruik Alt+F4 of sluit het
              kioskvenster.
            </p>
          ) : (
            <p>De Holobox-app wordt volledig afgesloten.</p>
          )}
          <div className="stack" style={{ marginTop: 24 }}>
            {quitBlocked ? (
              <button type="button" className="btn" onClick={() => setConfirm(null)}>
                Sluiten
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-testid="btn-confirm-quit"
                  onClick={quitApp}
                >
                  Ja, afsluiten
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirm(null)}
                >
                  Annuleren
                </button>
              </>
            )}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
