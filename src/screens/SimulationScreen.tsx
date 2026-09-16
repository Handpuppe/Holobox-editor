import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { SideAppMenu } from '../components/SideAppMenu';
import { copy } from '../content/nl';
import { CONCLUSION_NODE_ID } from '../domain/types';
import { PatientStage } from '../media/PatientStage';
import { defaultDisplayConfig } from '../media/scale';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAppState } from '../state/AppState';
import { NotesPanel } from './NotesPanel';

export function SimulationScreen() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const {
    session,
    dispatchSelect,
    completeTransition,
    pause,
    resume,
    endEarly,
    saveNotes,
    teacher,
    audio,
    scenario,
  } = useAppState();
  const [notesOpen, setNotesOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);

  const node = useMemo(
    () => scenario.nodes.find((item) => item.id === session?.currentNodeId),
    [scenario.nodes, session?.currentNodeId],
  );

  useEffect(() => {
    if (!session?.transitioning) {
      return;
    }
    const delay = reducedMotion ? 0 : 700;
    const timer = window.setTimeout(() => {
      completeTransition();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [completeTransition, reducedMotion, session?.transitioning]);

  const liveMessage = session
    ? `${session.lastClientResponse.text} ${session.lastClientResponse.context}${repeatCount > 0 ? ' (herhaald)' : ''}`
    : '';

  if (!session || session.status === 'completed') {
    return <Navigate to="/logopedie" replace />;
  }
  if (
    !session.transitioning &&
    (session.status === 'awaiting_conclusion' || session.currentNodeId === CONCLUSION_NODE_ID)
  ) {
    return <Navigate to="/logopedie/conclusie" replace />;
  }

  const progressIndex = Math.max(
    0,
    scenario.nodes.findIndex((item) => item.id === session.currentNodeId),
  );
  const progress =
    ((progressIndex + (session.transitioning ? 1 : 0)) / scenario.nodes.length) * 100;
  const optionsDisabled = session.transitioning || session.status === 'paused';

  const display = {
    ...defaultDisplayConfig(teacher.patientHeightByModule.logopedie, teacher.displayHeightCm),
    floorBaseline: teacher.floorBaseline,
    scaleCorrection: teacher.scaleCorrection,
  };

  return (
    <div className="sim-layout sim-layout-logopedie" data-testid="screen-simulation">
      <h1 id="screen-title" className="visually-hidden" tabIndex={-1}>
        Intake met {scenario.client.name}
      </h1>
      <PatientStage
        moduleId="logopedie"
        name={scenario.client.name}
        fictionalLabel={copy.clientFictional}
        state={session.clientEmotion === 'frustrated' ? 'gefrustreerd' : 'luisteren'}
        emotion={session.clientEmotion}
        caption={session.lastClientResponse.text}
        context={session.lastClientResponse.context}
        audioUnlocked={false}
        muted={audio.muted}
        volume={audio.volume}
        display={display}
        replayToken={repeatCount}
      />
      <aside className="question-panel" data-testid="question-panel" id="inhoud" lang="nl">
        <SideAppMenu />
        <p className="muted" data-testid="conversation-phase">
          {node?.phaseLabel ?? 'Intake'}
        </p>
        <div className="progress" data-testid="progress-indicator">
          <span className="visually-hidden">{copy.progressLabel}</span>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${String(Math.min(100, progress))}%` }}
            />
          </div>
          <p className="muted">
            {String(progressIndex + 1)}/{String(scenario.nodes.length)}
          </p>
        </div>
        <p className="patient-identity">
          {scenario.client.name} <span className="badge">{copy.clientFictional}</span>
        </p>
        <p className="panel-question">Wat zeg je nu?</p>
        <p data-testid="client-response">{session.lastClientResponse.text}</p>
        <p className="context" data-testid="client-context">
          {session.lastClientResponse.context}
        </p>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="visually-hidden"
          data-testid="live-region"
        >
          {liveMessage}
        </div>
        <fieldset className="option-list" disabled={optionsDisabled}>
          <legend className="visually-hidden">{copy.optionsLegend}</legend>
          {(node?.options ?? []).map((option) => (
            <button
              key={option.id}
              type="button"
              className="btn option-btn"
              data-testid={`option-${option.id}`}
              disabled={optionsDisabled}
              onClick={() => {
                setRepeatCount(0);
                dispatchSelect(option.id);
              }}
            >
              {option.text}
            </button>
          ))}
        </fieldset>
        <div className="panel-tools">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-repeat"
            onClick={() => setRepeatCount((count) => count + 1)}
          >
            {copy.repeatResponse}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-notes"
            onClick={() => setNotesOpen(true)}
          >
            {copy.makeNote}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-pause"
            onClick={() => {
              pause();
              setPauseOpen(true);
            }}
          >
            {copy.pause}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            data-testid="btn-end"
            onClick={() => setEndOpen(true)}
          >
            {copy.endSimulation}
          </button>
        </div>
      </aside>

      {notesOpen ? (
        <NotesPanel notes={session.notes} onSave={saveNotes} onClose={() => setNotesOpen(false)} />
      ) : null}

      {pauseOpen || session.status === 'paused' ? (
        <Dialog
          title={copy.pauseTitle}
          testId="dialog-pause"
          onClose={() => {
            resume();
            setPauseOpen(false);
          }}
        >
          <p>{copy.pauseBody}</p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn"
              data-testid="btn-resume"
              onClick={() => {
                resume();
                setPauseOpen(false);
              }}
            >
              {copy.resume}
            </button>
          </div>
        </Dialog>
      ) : null}

      {endOpen ? (
        <Dialog title={copy.endTitle} testId="dialog-end" onClose={() => setEndOpen(false)}>
          <p>{copy.endBody}</p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="btn-confirm-end"
              onClick={() => {
                endEarly();
                setEndOpen(false);
                void navigate('/logopedie/conclusie');
              }}
            >
              {copy.endSimulation}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEndOpen(false)}>
              {copy.cancel}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
