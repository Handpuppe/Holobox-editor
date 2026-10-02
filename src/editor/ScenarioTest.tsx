import { useReducer, useState } from 'react';
import { copy } from '../content/nl';
import { followList } from '../domain/followLine';
import { formatDuration, createSession } from '../domain/session';
import { CONCLUSION_NODE_ID, type OptionQuality, type Scenario } from '../domain/types';
import { withBaseUrl } from '../media/baseUrl';
import { findByRelativePath } from '../media/matching';
import { LogopedieAvatar } from '../media/logopedie/LogopedieAvatar';
import { nursingReducer } from '../nursing/reducer';
import { createNursingSession, currentNursingStep } from '../nursing/session';
import type { NursingScenario, NursingStep } from '../nursing/types';
import { simulationReducer } from '../state/simulationReducer';
import { stepPrimaryMediaPath } from './nursingMedia';

const QUALITY_LABELS: Record<OptionQuality, string> = {
  high: 'Goed antwoord',
  partial: 'Deels goed antwoord',
  inappropriate: 'Verkeerd antwoord',
};

const QUALITIES: OptionQuality[] = ['high', 'partial', 'inappropriate'];

interface ScenarioTestProps {
  module: 'logopedie' | 'verpleegkunde';
  scenario: Scenario;
  nursing: NursingScenario;
  onClose: () => void;
}

function videoSrc(path: string): string {
  const published = findByRelativePath(path)?.publicUrl;
  if (published) {
    return published;
  }
  return withBaseUrl(`/resources/${path.replace(/^\/+/, '')}`);
}

function isVideoFile(path: string | null): path is string {
  return Boolean(path && /\.(mp4|webm|mov|m4v)$/i.test(path));
}

function chosenNursingText(option: NursingStep['options'][number]): string {
  if (option.answerVideoMode === 'placeholder') {
    const placeholder = (option.videoPlaceholder ?? '').trim();
    if (placeholder) {
      return placeholder;
    }
  }
  return option.text.trim() || QUALITY_LABELS[option.quality];
}

function chosenLogopedieText(option: { text: string; quality: OptionQuality }): string {
  return option.text.trim() || QUALITY_LABELS[option.quality];
}

function stepPlaceholderText(step: NursingStep): string {
  if (step.stepVideoMode !== 'placeholder') {
    return '';
  }
  return (step.stepVideoPlaceholder ?? '').trim();
}

function NursingMedia({
  scenario,
  step,
  visit,
  reactionText,
}: {
  scenario: NursingScenario;
  step: NursingStep;
  visit: number;
  reactionText: string;
}) {
  const text = reactionText.trim() || stepPlaceholderText(step);
  if (text) {
    return (
      <div
        key={`${step.id}-${String(visit)}-${text}`}
        className="video-placeholder-stage scenario-test-placeholder"
        data-testid="test-placeholder"
      >
        <p>{text}</p>
      </div>
    );
  }
  const path = step.stepVideoMode === 'placeholder' ? null : stepPrimaryMediaPath(scenario, step);
  if (isVideoFile(path)) {
    return (
      <video
        key={`${step.id}-${String(visit)}`}
        className="editor-preview-video"
        data-testid="test-video"
        src={videoSrc(path)}
        playsInline
        preload="metadata"
        controls={false}
      >
        <track kind="captions" srcLang="nl" label="Nederlands" src="data:text/vtt,WEBVTT" />
      </video>
    );
  }
  return (
    <div
      key={`${step.id}-${String(visit)}`}
      className="video-placeholder-stage scenario-test-placeholder"
      data-testid="test-media-empty"
    />
  );
}

function ReplayNote({ show }: { show: boolean }) {
  if (!show) {
    return null;
  }
  return (
    <p className="scenario-test-replay" data-testid="test-replay">
      Deze vraag komt opnieuw.
    </p>
  );
}

function TestResults({
  durationMs,
  criticalErrors,
  onClose,
}: {
  durationMs: number;
  criticalErrors: string[];
  onClose: () => void;
}) {
  return (
    <div className="scenario-editor" data-testid="screen-scenario-editor" lang="nl">
      <div data-testid="screen-scenario-test-results">
        <h1>Resultaat</h1>
        <p className="muted">
          {copy.durationLabel}: {formatDuration(durationMs)}
        </p>
        {criticalErrors.length > 0 ? (
          <ul className="list" data-testid="critical-errors">
            {criticalErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="notice">Geen kritieke veiligheidfouten in deze poging.</p>
        )}
        <button type="button" className="btn" data-testid="btn-test-back" onClick={onClose}>
          Terug
        </button>
      </div>
    </div>
  );
}

function NursingScenarioTest({
  scenario,
  onClose,
}: {
  scenario: NursingScenario;
  onClose: () => void;
}) {
  const [session, dispatch] = useReducer(nursingReducer, null, () =>
    createNursingSession(new Date(), scenario.meta),
  );
  const [visit, setVisit] = useState(0);
  const [replay, setReplay] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  if (!session) {
    return null;
  }
  if (session.status === 'completed') {
    return (
      <TestResults
        durationMs={session.accumulatedActiveMs}
        criticalErrors={session.criticalErrors}
        onClose={onClose}
      />
    );
  }
  const step = currentNursingStep(session, scenario.steps);
  const pendingOption = step?.options.find((item) => item.id === pendingId);
  const reactionText = pendingOption ? chosenNursingText(pendingOption) : '';
  const continueAfterAnswer = () => {
    if (!step || !pendingOption) {
      return;
    }
    const followed = followList(
      scenario.steps.map((item) => item.id),
      step.id,
      pendingOption.nextStepId,
      'completed',
    );
    setReplay(!followed.done && followed.id === step.id);
    dispatch({
      type: 'select',
      optionId: pendingOption.id,
      at: new Date().toISOString(),
      steps: scenario.steps,
    });
    setPendingId(null);
    setVisit((value) => value + 1);
  };
  return (
    <div className="scenario-editor" data-testid="screen-scenario-editor" lang="nl">
      <div className="scenario-test" data-testid="screen-scenario-test">
        <div className="scenario-test-layout">
          <div className="editor-preview-stage scenario-test-stage" data-testid="test-media-stage">
            {step ? (
              <NursingMedia
                scenario={scenario}
                step={step}
                visit={visit}
                reactionText={reactionText}
              />
            ) : null}
          </div>
          <div key={step ? `${step.id}-${String(visit)}` : 'empty'}>
            {step ? (
              <p className="muted" data-testid="test-step-title">
                {step.stepName?.trim() ||
                  `Vraag ${scenario.steps.findIndex((item) => item.id === step.id) + 1}`}
              </p>
            ) : null}
            <p className="panel-question" data-testid="test-question">
              {step?.question}
            </p>
            <ReplayNote show={replay && !pendingOption} />
            <div className="option-list">
              {pendingOption ? (
                <button
                  type="button"
                  className="btn"
                  data-testid="btn-test-continue"
                  onClick={continueAfterAnswer}
                >
                  Verder
                </button>
              ) : (
                QUALITIES.map((quality) => {
                  const option = step?.options.find((item) => item.quality === quality);
                  if (!option || !step) {
                    return null;
                  }
                  const label = option.text.trim() || QUALITY_LABELS[quality];
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="btn option-btn"
                      data-testid={`test-option-${quality}`}
                      onClick={() => {
                        setReplay(false);
                        setPendingId(option.id);
                      }}
                    >
                      {label}
                    </button>
                  );
                })
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-test-back"
              onClick={onClose}
            >
              Terug
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogopedieScenarioTest({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const [session, dispatch] = useReducer(simulationReducer, null, () => createSession(scenario));
  const [visit, setVisit] = useState(0);
  const [replay, setReplay] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  if (!session) {
    return null;
  }
  if (session.status === 'awaiting_conclusion' || session.status === 'completed') {
    return (
      <TestResults durationMs={session.accumulatedActiveMs} criticalErrors={[]} onClose={onClose} />
    );
  }
  const node =
    scenario.nodes.find((item) => item.id === session.currentNodeId) ?? scenario.nodes[0];
  const pendingOption = node?.options.find((item) => item.id === pendingId);
  const continueAfterAnswer = () => {
    if (!node || !pendingOption) {
      return;
    }
    const followed = followList(
      scenario.nodes.map((item) => item.id),
      node.id,
      pendingOption.nextNodeId,
      CONCLUSION_NODE_ID,
    );
    setReplay(!followed.done && followed.id === node.id);
    const at = new Date().toISOString();
    dispatch({ type: 'select-option', optionId: pendingOption.id, scenario, at });
    dispatch({ type: 'complete-transition', scenario });
    setPendingId(null);
    setVisit((value) => value + 1);
  };
  return (
    <div className="scenario-editor" data-testid="screen-scenario-editor" lang="nl">
      <div className="scenario-test" data-testid="screen-scenario-test">
        <div className="scenario-test-layout">
          <div className="editor-preview-stage scenario-test-stage" data-testid="test-media-stage">
            <LogopedieAvatar
              key={`${node?.id ?? 'erik'}-${String(visit)}`}
              emotion={node?.promptEmotion ?? 'neutral'}
              heightPx={240}
              name={scenario.client.name}
            />
          </div>
          <div key={node ? `${node.id}-${String(visit)}` : 'empty'}>
            {node ? (
              <p className="muted" data-testid="test-step-title">
                {node.phaseLabel.trim() ||
                  `Vraag ${scenario.nodes.findIndex((item) => item.id === node.id) + 1}`}
              </p>
            ) : null}
            <p className="panel-question" data-testid="test-question">
              {node?.prompt.text}
            </p>
            <ReplayNote show={replay && !pendingOption} />
            {pendingOption ? (
              <p className="panel-question" data-testid="test-answer-reaction">
                {chosenLogopedieText(pendingOption)}
              </p>
            ) : null}
            <div className="option-list">
              {pendingOption ? (
                <button
                  type="button"
                  className="btn"
                  data-testid="btn-test-continue"
                  onClick={continueAfterAnswer}
                >
                  Verder
                </button>
              ) : (
                QUALITIES.map((quality) => {
                  const option = node?.options.find((item) => item.quality === quality);
                  if (!option || !node) {
                    return null;
                  }
                  const label = option.text.trim() || QUALITY_LABELS[quality];
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="btn option-btn"
                      data-testid={`test-option-${quality}`}
                      onClick={() => {
                        setReplay(false);
                        setPendingId(option.id);
                      }}
                    >
                      {label}
                    </button>
                  );
                })
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-test-back"
              onClick={onClose}
            >
              Terug
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScenarioTest({ module, scenario, nursing, onClose }: ScenarioTestProps) {
  if (module === 'verpleegkunde') {
    return <NursingScenarioTest scenario={nursing} onClose={onClose} />;
  }
  return <LogopedieScenarioTest scenario={scenario} onClose={onClose} />;
}
