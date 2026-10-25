import { useRef, useState } from 'react';
import { copy } from '../content/nl';
import { followList } from '../domain/followLine';
import { formatDuration, createSession } from '../domain/session';
import {
  CONCLUSION_NODE_ID,
  type OptionQuality,
  type Scenario,
  type SimulationSession,
} from '../domain/types';
import { withBaseUrl } from '../media/baseUrl';
import { findByRelativePath } from '../media/matching';
import { nursingReducer } from '../nursing/reducer';
import { createNursingSession, currentNursingStep } from '../nursing/session';
import type { NursingScenario, NursingSession, NursingStep } from '../nursing/types';
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

function TestControls({
  canStepBack,
  onStepBack,
  onClose,
}: {
  canStepBack: boolean;
  onStepBack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="scenario-test-controls">
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="btn-test-step-back"
        onClick={onStepBack}
        disabled={!canStepBack}
      >
        Stap terug
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="btn-test-close"
        onClick={onClose}
      >
        Test sluiten
      </button>
    </div>
  );
}

interface TestReportRow {
  key: string;
  question: string;
  answer: string;
  feedback: string;
}

function reportFeedback(value: string | undefined): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  return value;
}

function TestResults({
  rows,
  durationMs,
  criticalErrors,
  canStepBack,
  onStepBack,
  onClose,
}: {
  rows: TestReportRow[];
  durationMs: number;
  criticalErrors: string[];
  canStepBack: boolean;
  onStepBack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="scenario-editor" data-testid="screen-scenario-editor" lang="nl">
      <div data-testid="screen-scenario-test-results">
        <h1>Resultaat</h1>
        <p className="muted">
          {copy.durationLabel}: {formatDuration(durationMs)}
        </p>
        <table className="test-report" data-testid="test-report">
          <thead>
            <tr>
              <th scope="col">Vraag</th>
              <th scope="col">Gekozen antwoord</th>
              <th scope="col">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} data-testid="test-report-row">
                <td>{row.question}</td>
                <td>{row.answer}</td>
                <td data-testid="test-report-feedback">{row.feedback}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {criticalErrors.length > 0 ? (
          <ul className="list" data-testid="critical-errors">
            {criticalErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="notice">Geen kritieke veiligheidfouten in deze poging.</p>
        )}
        <TestControls canStepBack={canStepBack} onStepBack={onStepBack} onClose={onClose} />
      </div>
    </div>
  );
}

interface NursingTestMemory {
  session: NursingSession;
  visit: number;
  replay: boolean;
}

function NursingScenarioTest({
  scenario,
  onClose,
}: {
  scenario: NursingScenario;
  onClose: () => void;
}) {
  const [session, setSession] = useState<NursingSession>(() =>
    createNursingSession(new Date(), scenario.meta),
  );
  const [visit, setVisit] = useState(0);
  const [replay, setReplay] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [history, setHistory] = useState<NursingTestMemory[]>([]);
  const replayBeforePending = useRef(false);
  const stepBack = () => {
    if (pendingId) {
      setPendingId(null);
      setReplay(replayBeforePending.current);
      return;
    }
    const previous = history[history.length - 1];
    if (!previous) {
      return;
    }
    setHistory((items) => items.slice(0, -1));
    setSession(previous.session);
    setVisit(previous.visit);
    setReplay(previous.replay);
  };
  const canStepBack = pendingId !== null || history.length > 0;
  const reportRows = session.history.map((event, index) => {
    const answered = scenario.steps.find((item) => item.id === event.stepId);
    const option = answered?.options.find((item) => item.id === event.optionId);
    return {
      key: `${event.id}-${String(index)}`,
      question: answered?.question ?? '',
      answer: option?.text ?? '',
      feedback: reportFeedback(option?.answerFeedback),
    };
  });
  if (session.status === 'completed') {
    return (
      <TestResults
        rows={reportRows}
        durationMs={session.accumulatedActiveMs}
        criticalErrors={session.criticalErrors}
        canStepBack={canStepBack}
        onStepBack={stepBack}
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
    setHistory((items) => [...items, { session, visit, replay }]);
    setReplay(!followed.done && followed.id === step.id);
    setSession(
      (current) =>
        nursingReducer(current, {
          type: 'select',
          optionId: pendingOption.id,
          at: new Date().toISOString(),
          steps: scenario.steps,
        }) ?? current,
    );
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
                        replayBeforePending.current = replay;
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
            <TestControls canStepBack={canStepBack} onStepBack={stepBack} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface LogopedieTestMemory {
  session: SimulationSession;
  visit: number;
  replay: boolean;
}

function LogopedieScenarioTest({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const [session, setSession] = useState<SimulationSession>(() => createSession(scenario));
  const [visit, setVisit] = useState(0);
  const [replay, setReplay] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [history, setHistory] = useState<LogopedieTestMemory[]>([]);
  const replayBeforePending = useRef(false);
  const stepBack = () => {
    if (pendingId) {
      setPendingId(null);
      setReplay(replayBeforePending.current);
      return;
    }
    const previous = history[history.length - 1];
    if (!previous) {
      return;
    }
    setHistory((items) => items.slice(0, -1));
    setSession(previous.session);
    setVisit(previous.visit);
    setReplay(previous.replay);
  };
  const canStepBack = pendingId !== null || history.length > 0;
  const reportRows = session.history.map((event, index) => {
    const answered = scenario.nodes.find((item) => item.id === event.nodeId);
    const option = answered?.options.find((item) => item.id === event.optionId);
    return {
      key: `${event.id}-${String(index)}`,
      question: answered?.prompt.text ?? '',
      answer: option?.text ?? '',
      feedback: reportFeedback(option?.answerFeedback),
    };
  });
  if (session.status === 'awaiting_conclusion' || session.status === 'completed') {
    return (
      <TestResults
        rows={reportRows}
        durationMs={session.accumulatedActiveMs}
        criticalErrors={[]}
        canStepBack={canStepBack}
        onStepBack={stepBack}
        onClose={onClose}
      />
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
    setHistory((items) => [...items, { session, visit, replay }]);
    setReplay(!followed.done && followed.id === node.id);
    const at = new Date().toISOString();
    setSession((current) => {
      const selected = simulationReducer(current, {
        type: 'select-option',
        optionId: pendingOption.id,
        scenario,
        at,
      });
      if (!selected) {
        return current;
      }
      return simulationReducer(selected, { type: 'complete-transition', scenario }) ?? current;
    });
    setPendingId(null);
    setVisit((value) => value + 1);
  };
  return (
    <div className="scenario-editor" data-testid="screen-scenario-editor" lang="nl">
      <div className="scenario-test" data-testid="screen-scenario-test">
        <div className="scenario-test-layout">
          <div
            className="editor-preview-stage scenario-test-stage"
            data-testid="test-media-stage"
          />
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
                        replayBeforePending.current = replay;
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
            <TestControls canStepBack={canStepBack} onStepBack={stepBack} onClose={onClose} />
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
