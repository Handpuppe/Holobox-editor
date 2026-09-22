import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { Dialog } from '../components/Dialog';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { formatDuration } from '../domain/session';
import { COMPETENCIES } from '../domain/types';
import { useAppState } from '../state/AppState';

export function PreviousResultsScreen() {
  const navigate = useNavigate();
  const { store, deleteResult } = useAppState();
  const [pendingId, setPendingId] = useState<string | null>(null);

  return (
    <Screen title={copy.previousResults} testId="screen-history" footer={<BackButton />}>
      {store.results.length === 0 ? (
        <p className="notice" data-testid="empty-history">
          {copy.emptyHistory}
        </p>
      ) : (
        store.results.map((result) => (
          <article className="card result-item" key={result.id} data-testid={`result-${result.id}`}>
            <h2>{new Date(result.savedAt).toLocaleString('nl-NL')}</h2>
            <p className="badge">
              {result.module === 'verpleegkunde' ? 'Verpleegkunde' : 'Logopedie'}
            </p>
            <p>
              {copy.scoreLabel}: {String(result.score.total)} · {copy.durationLabel}:{' '}
              {formatDuration(result.durationMs)}
            </p>
            <p className="muted">
              app {result.appVersion} · scenario {result.scenarioVersion} · rubriek{' '}
              {result.rubricVersion}
            </p>
            <ul className="list">
              {COMPETENCIES.map((competency) => (
                <li key={competency}>
                  {copy.competencyLabels[competency]}:{' '}
                  {String(Math.round(result.score.competencies[competency].percent))}
                </li>
              ))}
            </ul>
            <div className="btn-row">
              <button
                type="button"
                className="btn"
                data-testid={`btn-view-${result.id}`}
                onClick={() => void navigate(`/resultaat/${result.id}`)}
              >
                {copy.viewResult}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                data-testid={`btn-delete-${result.id}`}
                onClick={() => setPendingId(result.id)}
              >
                {copy.deleteResult}
              </button>
            </div>
          </article>
        ))
      )}

      {pendingId ? (
        <Dialog title={copy.deleteTitle} testId="dialog-delete" onClose={() => setPendingId(null)}>
          <p>{copy.deleteBody}</p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="btn-confirm-delete"
              onClick={() => {
                deleteResult(pendingId);
                setPendingId(null);
              }}
            >
              {copy.confirmDelete}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-cancel-delete"
              onClick={() => setPendingId(null)}
            >
              {copy.cancel}
            </button>
          </div>
        </Dialog>
      ) : null}
    </Screen>
  );
}
