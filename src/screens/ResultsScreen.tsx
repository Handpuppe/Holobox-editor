import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { buildFeedback } from '../domain/feedback';
import { calculateScores } from '../domain/scoring';
import { activeDurationMs, formatDuration } from '../domain/session';
import { COMPETENCIES, type SavedResult } from '../domain/types';
import { useAppState } from '../state/AppState';

function qualityLabel(quality: 'high' | 'partial' | 'inappropriate'): string {
  if (quality === 'high') {
    return 'passend';
  }
  if (quality === 'partial') {
    return 'gedeeltelijk passend';
  }
  return 'minder passend';
}

export function ResultsScreen() {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const {
    session,
    store,
    saveCurrentResult,
    startNewSession,
    discardSession,
    startNursing,
    discardNursing,
    storageAvailable,
  } = useAppState();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const saved = resultId ? store.results.find((item) => item.id === resultId) : undefined;

  const derived: SavedResult | null = useMemo(() => {
    if (saved) {
      return saved;
    }
    if (!session || session.status !== 'completed' || !session.conclusion) {
      return null;
    }
    const score = calculateScores(session.history, aphasiaIntakeScenario);
    return {
      id: session.id,
      schemaVersion: session.schemaVersion,
      savedAt: session.updatedAt,
      appVersion: session.appVersion,
      scenarioId: session.scenarioId,
      scenarioVersion: session.scenarioVersion,
      rubricVersion: session.rubricVersion,
      durationMs: activeDurationMs(session),
      score,
      history: session.history,
      notes: session.notes,
      conclusion: session.conclusion,
      feedback: buildFeedback(session.history, aphasiaIntakeScenario, score),
      flags: session.flags,
      module: 'logopedie',
      criticalErrors: session.history
        .filter((event) => event.unsafe)
        .map((event) => event.delayedFeedback),
      completedParts: session.history.map((event) => event.nodeId),
    };
  }, [saved, session]);

  if (!derived) {
    return <Navigate to="/" replace />;
  }

  return (
    <Screen
      title="Resultaat en feedback"
      testId="screen-results"
      footer={
        <>
          <button
            type="button"
            className="btn"
            data-testid="btn-try-again"
            onClick={() => {
              if (derived.module === 'verpleegkunde') {
                discardNursing();
                startNursing();
                void navigate('/verpleegkunde/briefing');
                return;
              }
              discardSession();
              startNewSession();
              void navigate('/logopedie/briefing');
            }}
          >
            {copy.tryAgain}
          </button>
          {!resultId ? (
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-save-result"
              onClick={() => {
                const stored = saveCurrentResult();
                setSaveMessage(stored ? copy.resultsSaved : copy.resultsSaveFailed);
              }}
              disabled={!storageAvailable}
            >
              {copy.saveResult}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-results-home"
            onClick={() => {
              if (!resultId) {
                discardSession();
              }
              void navigate('/');
            }}
          >
            {copy.returnHome}
          </button>
        </>
      }
    >
      <section className="score-hero" data-testid="total-score">
        <span className="muted">{copy.scoreLabel}</span>
        <strong data-testid="score-value">{String(derived.score.total)}</strong>
        <span>van 100</span>
      </section>
      <p className="muted">
        {copy.durationLabel}: {formatDuration(derived.durationMs)} · scenario{' '}
        {derived.scenarioVersion} · app {derived.appVersion}
      </p>
      {saveMessage ? (
        <p className="notice" data-testid="save-message" role="status">
          {saveMessage}
        </p>
      ) : null}

      <section className="card">
        <h2>Competentie scores</h2>
        <ul className="list" data-testid="competency-scores">
          {COMPETENCIES.map((competency) => (
            <li key={competency}>
              {copy.competencyLabels[competency]}:{' '}
              {String(Math.round(derived.score.competencies[competency].percent))}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="positive">Sterke punten</h2>
        <ul className="list" data-testid="strengths">
          {derived.feedback.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="attention">Aandachtspunten</h2>
        {derived.feedback.improvements.length > 0 ? (
          <ul className="list" data-testid="improvements">
            {derived.feedback.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p data-testid="improvements">Geen prioritaire aandachtspunten in deze poging.</p>
        )}
      </section>

      <section className="card">
        <h2>Tijdlijn van keuzes</h2>
        <ol className="timeline" data-testid="timeline">
          {derived.feedback.timeline.map((item) => (
            <li key={item.nodeId}>
              <strong>{item.phaseLabel}</strong>
              <div>{item.choice}</div>
              <span className="muted">{qualityLabel(item.quality)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Toelichting bij beslissingen</h2>
        <ul className="list">
          {derived.feedback.keyDecisions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Observatie versus aanname</h2>
        <p data-testid="observation-feedback">{derived.feedback.observationVersusAssumption}</p>
      </section>

      <section className="card">
        <h2>Sterkere aanpak</h2>
        <p data-testid="stronger-approach">{derived.feedback.strongerApproach}</p>
      </section>
    </Screen>
  );
}
