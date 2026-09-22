import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { SideAppMenu } from '../components/SideAppMenu';
import { copy } from '../content/nl';
import { PatientStage } from '../media/PatientStage';
import { defaultDisplayConfig } from '../media/scale';
import { slotById } from '../media/scenarioMedia';
import { currentNursingStep } from '../nursing/session';
import { useAppState } from '../state/AppState';

export function NursingSimulationScreen() {
  const {
    nursingSession,
    selectNursing,
    pauseNursing,
    resumeNursing,
    teacher,
    audio,
    saveAudio,
    audioBlocked,
    setAudioBlocked,
    unlockNursingAudio,
    nursingScenario,
  } = useAppState();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const steps = nursingScenario.steps;
  const patient = nursingScenario.patient;
  const step = nursingSession ? currentNursingStep(nursingSession, steps) : undefined;

  if (!nursingSession) {
    return <Navigate to="/verpleegkunde" replace />;
  }
  if (nursingSession.status === 'completed') {
    return <Navigate to="/verpleegkunde/resultaat" replace />;
  }

  const display = {
    ...defaultDisplayConfig(teacher.patientHeightByModule.verpleegkunde, teacher.displayHeightCm),
    floorBaseline: teacher.floorBaseline,
    scaleCorrection: teacher.scaleCorrection,
  };
  const last = nursingSession.history.at(-1);
  const mediaSlotId = last
    ? (steps
        .find((item) => item.id === last.stepId)
        ?.options.find((item) => item.id === last.optionId)?.mediaSlotId ?? step?.mediaSlotId)
    : step?.mediaSlotId;
  const slot = mediaSlotId ? slotById(mediaSlotId, nursingScenario.mediaSlots) : undefined;
  const progress = (nursingSession.history.length / Math.max(1, steps.length)) * 100;
  const override = mediaSlotId ? teacher.mediaOverrides[mediaSlotId] : undefined;

  return (
    <div className="sim-layout" data-testid="screen-nursing-simulation">
      <h1 id="screen-title" className="visually-hidden" tabIndex={-1}>
        ABCDE en SBAR met {patient.name}
      </h1>
      <PatientStage
        moduleId="verpleegkunde"
        name={patient.name}
        fictionalLabel={copy.clientFictional}
        mediaSlotId={mediaSlotId}
        mediaOverride={override}
        state={nursingSession.mediaState}
        caption={slot?.transcript ?? 'Observeer de patiënt en beantwoord de vraag rechts.'}
        audioUnlocked={nursingSession.audioUnlocked}
        muted={audio.muted}
        volume={audio.volume}
        display={display}
        replayToken={replayToken}
        onAudioBlocked={() => setAudioBlocked(true)}
        slots={nursingScenario.mediaSlots}
      />
      <aside className="question-panel" data-testid="question-panel" id="inhoud" lang="nl">
        <SideAppMenu />
        <p className="patient-identity">
          {patient.name} <span className="badge">{copy.clientFictional}</span>
        </p>
        <p className="muted" data-testid="nursing-phase">
          {step?.phaseLabel}
        </p>
        <div className="progress">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${String(Math.min(100, progress))}%` }}
            />
          </div>
          <p className="muted">
            {String(nursingSession.history.length + 1)}/{String(steps.length)}
          </p>
        </div>
        <p className="panel-question" data-testid="nursing-step-question">
          {step?.question}
        </p>
        <p className="muted">{step?.help}</p>
        <p data-testid="client-response">
          {slot?.transcript ?? 'Observeer de patiënt en beantwoord de vraag.'}
        </p>
        {audioBlocked ? (
          <p className="notice notice-attention" data-testid="audio-blocked">
            De browser heeft audio geblokkeerd. Tik op Start geluid.
          </p>
        ) : null}
        <fieldset className="option-list" disabled={nursingSession.status === 'paused'}>
          <legend className="visually-hidden">Kies één antwoord</legend>
          {(step?.options ?? []).map((option) => (
            <button
              key={option.id}
              type="button"
              className="btn option-btn"
              data-testid={`option-${option.id}`}
              onClick={() => selectNursing(option.id)}
            >
              {option.text}
            </button>
          ))}
        </fieldset>
        <div className="panel-tools">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-replay-video"
            onClick={() => setReplayToken((value) => value + 1)}
          >
            Video opnieuw afspelen
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-unlock-audio"
            onClick={() => {
              unlockNursingAudio();
              setAudioBlocked(false);
            }}
          >
            Start geluid
          </button>
          <label className="mute-row">
            <input
              type="checkbox"
              checked={audio.muted}
              onChange={(event) => saveAudio({ ...audio, muted: event.target.checked })}
            />
            Dempen
          </label>
          <label className="volume-row" htmlFor="volume">
            Volume
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.volume}
              onChange={(event) => saveAudio({ ...audio, volume: Number(event.target.value) })}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-pause-nursing"
            onClick={() => {
              pauseNursing();
              setPauseOpen(true);
            }}
          >
            {copy.pause}
          </button>
        </div>
      </aside>
      {pauseOpen || nursingSession.status === 'paused' ? (
        <Dialog
          title={copy.pauseTitle}
          testId="dialog-pause"
          onClose={() => {
            resumeNursing();
            setPauseOpen(false);
          }}
        >
          <p>{copy.pauseBody}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              resumeNursing();
              setPauseOpen(false);
            }}
          >
            {copy.resume}
          </button>
        </Dialog>
      ) : null}
    </div>
  );
}
