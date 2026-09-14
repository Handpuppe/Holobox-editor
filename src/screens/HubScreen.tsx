import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { APP_VERSION } from '../domain/types';
import { useAppState } from '../state/AppState';

export function HubScreen() {
  const navigate = useNavigate();
  const { storageAvailable, storageNotice } = useAppState();

  return (
    <Screen
      title="Holobox Zorgsimulator"
      testId="screen-home"
      footer={
        <>
          <button
            type="button"
            className="btn"
            data-testid="btn-module-logopedie"
            onClick={() => void navigate('/logopedie')}
          >
            Logopedie
          </button>
          <button
            type="button"
            className="btn"
            data-testid="btn-module-nursing"
            onClick={() => void navigate('/verpleegkunde')}
          >
            Verpleegkunde
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-previous-results"
            onClick={() => void navigate('/geschiedenis')}
          >
            {copy.previousResults}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-teacher"
            onClick={() => void navigate('/docent')}
          >
            Docentconfiguratie
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-about"
            onClick={() => void navigate('/over')}
          >
            Over deze applicatie
          </button>
        </>
      }
    >
      <p className="lead">
        Kies een opleidingsmodule. Alle patiënten en cliënten in deze app zijn fictief.
      </p>
      <section className="card">
        <h2>Logopedie – Virtuele Cliëntsimulator</h2>
        <p>Intake met Erik de Vries, fictieve cliënt met afasie na een beroerte.</p>
      </section>
      <section className="card">
        <h2>Verpleegkunde – Virtuele Patiënt en Klinisch Redeneren</h2>
        <p>ABCDE en SBAR bij meneer de Vries, fictieve patiënt met acute benauwdheid.</p>
      </section>
      <p className="notice" data-testid="fictional-notice">
        {copy.fictionalNotice} {copy.educationalNotice}
      </p>
      {!storageAvailable ? (
        <p className="notice notice-attention" data-testid="storage-unavailable">
          {copy.storageUnavailable}
        </p>
      ) : null}
      {storageNotice && storageNotice !== 'unavailable' ? (
        <p className="notice notice-attention" data-testid="storage-notice">
          {copy.storageCorrupted}
        </p>
      ) : null}
      <p className="version-line" data-testid="app-version">
        {copy.versionLabel} {APP_VERSION}
      </p>
      <p className="version-line" data-testid="app-credit">
        Made by Rutger van Horssen
      </p>
    </Screen>
  );
}
