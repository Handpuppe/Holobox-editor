import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { Dialog } from '../components/Dialog';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { APP_VERSION } from '../domain/types';
import { useAppState } from '../state/AppState';

export function HomeScreen() {
  const navigate = useNavigate();
  const { session, startNewSession, discardSession, storageAvailable, storageNotice } =
    useAppState();
  const unfinished = session && session.status !== 'completed';
  const [showResume, setShowResume] = useState(Boolean(unfinished));

  return (
    <Screen
      title="Logopedie – Virtuele Cliëntsimulator"
      testId="screen-logopedie-home"
      footer={
        <>
          <button
            type="button"
            className="btn"
            data-testid="btn-start-simulation"
            onClick={() => {
              if (unfinished) {
                setShowResume(true);
                return;
              }
              startNewSession();
              void navigate('/logopedie/briefing');
            }}
          >
            {copy.startSimulation}
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
            data-testid="btn-about"
            onClick={() => void navigate('/over')}
          >
            {copy.aboutTraining}
          </button>
          <BackButton fallback="/logopedie" />
        </>
      }
    >
      <p className="lead">
        Oefen een logopedische intake met Erik de Vries, een fictieve cliënt met afasie na een
        beroerte.
      </p>
      <section className="card">
        <h2>Eerste scenario</h2>
        <p>Intake met een cliënt met afasie na een beroerte. Geschatte duur: 10–15 minuten.</p>
        <p>Je oefent rapport, aangepaste taal, antwoordtijd en een voorlopige conclusie.</p>
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
      {showResume && unfinished ? (
        <Dialog
          title={copy.resumeTitle}
          testId="dialog-resume"
          onClose={() => setShowResume(false)}
        >
          <p>{copy.resumeBody}</p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn"
              data-testid="btn-resume-session"
              onClick={() => {
                setShowResume(false);
                if (session.status === 'awaiting_conclusion') {
                  void navigate('/logopedie/conclusie');
                  return;
                }
                void navigate('/logopedie/simulatie');
              }}
            >
              {copy.resumeSession}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-discard-session"
              onClick={() => {
                discardSession();
                startNewSession();
                setShowResume(false);
                void navigate('/logopedie/briefing');
              }}
            >
              {copy.discardSession}
            </button>
          </div>
        </Dialog>
      ) : null}
    </Screen>
  );
}
