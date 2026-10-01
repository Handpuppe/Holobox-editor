import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { formatDuration } from '../domain/session';
import { useAppState } from '../state/AppState';

export function NursingResultsScreen() {
  const navigate = useNavigate();
  const {
    nursingSession,
    saveNursingResult,
    discardNursing,
    startNursing,
    storageAvailable,
  } = useAppState();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (!nursingSession || nursingSession.status !== 'completed') {
    return <Navigate to="/verpleegkunde" replace />;
  }

  return (
    <Screen
      title="Resultaat verpleegkunde"
      testId="screen-nursing-results"
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={() => {
              discardNursing();
              startNursing();
              void navigate('/verpleegkunde/briefing');
            }}
          >
            {copy.tryAgain}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-save-nursing-result"
            disabled={!storageAvailable}
            onClick={() => {
              const stored = saveNursingResult();
              setSaveMessage(stored ? copy.resultsSaved : copy.resultsSaveFailed);
            }}
          >
            {copy.saveResult}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              discardNursing();
              void navigate('/');
            }}
          >
            {copy.returnHome}
          </button>
        </>
      }
    >
      <p className="muted">
        {copy.durationLabel}: {formatDuration(nursingSession.accumulatedActiveMs)} · module
        verpleegkunde
      </p>
      {saveMessage ? (
        <p className="notice" role="status">
          {saveMessage}
        </p>
      ) : null}
      {nursingSession.criticalErrors.length > 0 ? (
        <section className="card">
          <h2 className="danger-text">Kritieke fouten</h2>
          <ul className="list" data-testid="critical-errors">
            {nursingSession.criticalErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="notice">Geen kritieke veiligheidfouten in deze poging.</p>
      )}
    </Screen>
  );
}
