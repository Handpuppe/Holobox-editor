import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { OptionQuality } from '../domain/types';
import type { NursingOption, NursingScenario, NursingStep } from '../nursing/types';
import { AnswerColumnMedia } from './NursingEditor';
import { NursingStepVideoCard } from './NursingStepVideoCard';
import {
  applyStagedNursingMedia,
  type NursingMediaItem,
  type StagedNursingMediaOp,
} from './nursingMedia';

const STEP_TITLES = [
  'Situatiebeschrijving',
  'Start video van deze vraag',
  'Vraag voor de student',
  'Antwoord 1',
  'Antwoord 2',
  'Antwoord 3',
  'Voorbeeld',
] as const;

const QUALITY_LABELS: Record<OptionQuality, string> = {
  high: 'Goed antwoord',
  partial: 'Deels goed antwoord',
  inappropriate: 'Verkeerd antwoord',
};

const QUALITIES: OptionQuality[] = ['high', 'partial', 'inappropriate'];

const POPUP_WIDTH_RATIO = 0.5;
const POPUP_HEIGHT_RATIO = 0.5;

interface WizardBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface NodeQuestionWizardProps {
  stepId: string;
  draft: NursingScenario;
  onChange: (next: NursingScenario) => void;
  stagedMedia: StagedNursingMediaOp[];
  onStage: (op: StagedNursingMediaOp) => void;
  diskMedia: NursingMediaItem[];
  onSaved: () => void;
}

function replaceStep(draft: NursingScenario, next: NursingStep): NursingScenario {
  return {
    ...draft,
    steps: draft.steps.map((step) => (step.id === next.id ? next : step)),
  };
}

function replaceOption(step: NursingStep, optionIndex: number, next: NursingOption): NursingStep {
  const options: NursingStep['options'] = [step.options[0], step.options[1], step.options[2]];
  options[optionIndex] = next;
  return { ...step, options };
}

function frameSize(): { width: number; height: number } {
  const frame = document.querySelector('[data-testid="node-overview"]');
  const rect = frame instanceof HTMLElement ? frame.getBoundingClientRect() : null;
  return {
    width: rect && rect.width > 80 ? rect.width : 960,
    height: rect && rect.height > 80 ? rect.height : 640,
  };
}

function initialBox(): WizardBox {
  const frame = frameSize();
  const width = Math.round(frame.width * POPUP_WIDTH_RATIO);
  const height = Math.round(frame.height * POPUP_HEIGHT_RATIO);
  return {
    width,
    height,
    left: Math.round((frame.width - width) / 2),
    top: Math.round((frame.height - height) / 2),
  };
}

export function NodeQuestionWizard({
  stepId,
  draft,
  onChange,
  stagedMedia,
  onStage,
  diskMedia,
  onSaved,
}: NodeQuestionWizardProps) {
  const [index, setIndex] = useState(0);
  const [trackedStepId, setTrackedStepId] = useState(stepId);
  const [box, setBox] = useState<WizardBox>(initialBox);
  if (trackedStepId !== stepId) {
    setTrackedStepId(stepId);
    setIndex(0);
  }
  const step = draft.steps.find((item) => item.id === stepId);
  const catalog = useMemo(() => {
    const seed = new Map<string, NursingMediaItem>();
    for (const slot of draft.mediaSlots) {
      if (slot.primaryMedia) {
        seed.set(slot.primaryMedia, { relativePath: slot.primaryMedia, sizeBytes: 0 });
      }
    }
    for (const item of diskMedia) {
      seed.set(item.relativePath, item);
    }
    return applyStagedNursingMedia([...seed.values()], stagedMedia).map(
      (item) => item.relativePath,
    );
  }, [diskMedia, draft.mediaSlots, stagedMedia]);

  if (!step) {
    return null;
  }

  const last = index === STEP_TITLES.length - 1;

  function updateStep(next: NursingStep) {
    onChange(replaceStep(draft, next));
  }

  function onBarPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest('button')) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = box;
    if (!origin) {
      return;
    }
    const move = (moveEvent: PointerEvent) => {
      setBox({
        ...origin,
        left: origin.left + (moveEvent.clientX - startX),
        top: origin.top + (moveEvent.clientY - startY),
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || !box) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = box;
    const move = (moveEvent: PointerEvent) => {
      setBox({
        ...origin,
        width: Math.max(260, origin.width + (moveEvent.clientX - startX)),
        height: Math.max(180, origin.height + (moveEvent.clientY - startY)),
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  return (
    <div
      className="node-wizard"
      role="dialog"
      aria-label={STEP_TITLES[index]}
      data-testid="node-question-wizard"
      data-wizard-step={String(index)}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <div
        className="node-wizard-bar"
        data-testid="node-wizard-bar"
        onPointerDown={onBarPointerDown}
      >
        <div className="node-wizard-side">
          {index > 0 ? (
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-node-wizard-back"
              onClick={() => setIndex((current) => current - 1)}
            >
              Terug
            </button>
          ) : null}
        </div>
        <h2 className="node-wizard-title">{STEP_TITLES[index]}</h2>
        <div className="node-wizard-side node-wizard-side-end">
          {last ? (
            <button
              type="button"
              className="btn"
              data-testid="btn-node-wizard-save"
              onClick={onSaved}
            >
              Opslaan
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              data-testid="btn-node-wizard-next"
              onClick={() => setIndex((current) => current + 1)}
            >
              Volgende
            </button>
          )}
        </div>
      </div>
      <div className="node-wizard-body">
        {index === 0 ? (
          <div className="field">
            <label htmlFor="node-wizard-phase">Situatiebeschrijving</label>
            <textarea
              id="node-wizard-phase"
              data-testid="node-wizard-phase"
              rows={4}
              value={step.phaseLabel}
              onChange={(event) => updateStep({ ...step, phaseLabel: event.target.value })}
            />
          </div>
        ) : null}
        {index === 1 ? (
          <NursingStepVideoCard
            draft={draft}
            step={step}
            staged={stagedMedia}
            catalog={catalog}
            onChange={onChange}
            onStage={onStage}
          />
        ) : null}
        {index === 2 ? (
          <div className="field">
            <label htmlFor="node-wizard-question">Vraag voor de student</label>
            <textarea
              id="node-wizard-question"
              data-testid="node-wizard-question"
              rows={4}
              value={step.question}
              onChange={(event) => updateStep({ ...step, question: event.target.value })}
            />
          </div>
        ) : null}
        {index >= 3 && index <= 5 ? (
          <AnswerStep
            draft={draft}
            step={step}
            optionIndex={index - 3}
            catalog={catalog}
            stagedMedia={stagedMedia}
            onChange={onChange}
            onStage={onStage}
          />
        ) : null}
        {index === 6 ? <PreviewStep step={step} /> : null}
      </div>
      <button
        type="button"
        className="node-wizard-resize"
        data-testid="node-wizard-resize"
        aria-label="Formaat wijzigen"
        onPointerDown={onResizePointerDown}
      />
    </div>
  );
}

function AnswerStep({
  draft,
  step,
  optionIndex,
  catalog,
  stagedMedia,
  onChange,
  onStage,
}: {
  draft: NursingScenario;
  step: NursingStep;
  optionIndex: number;
  catalog: string[];
  stagedMedia: StagedNursingMediaOp[];
  onChange: (next: NursingScenario) => void;
  onStage: (op: StagedNursingMediaOp) => void;
}) {
  const option = step.options[optionIndex];
  const columnQuality = QUALITIES[optionIndex];
  if (!option || !columnQuality) {
    return null;
  }
  return (
    <div data-testid={`node-wizard-answer-${String(optionIndex + 1)}`}>
      <div className="field">
        <label htmlFor={`nursing-quality-${option.id}`}>Kwaliteit</label>
        <select
          id={`nursing-quality-${option.id}`}
          data-testid={`nursing-option-quality-${option.id}`}
          value={option.quality}
          onChange={(event) =>
            onChange(
              replaceStep(
                draft,
                replaceOption(step, optionIndex, {
                  ...option,
                  quality: event.target.value as OptionQuality,
                }),
              ),
            )
          }
        >
          {QUALITIES.map((quality) => (
            <option key={quality} value={quality}>
              {QUALITY_LABELS[quality]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`nursing-option-text-${option.id}`}>Antwoord keuze</label>
        <textarea
          id={`nursing-option-text-${option.id}`}
          data-testid={`nursing-option-text-${option.id}`}
          rows={3}
          value={option.text}
          onChange={(event) =>
            onChange(
              replaceStep(
                draft,
                replaceOption(step, optionIndex, { ...option, text: event.target.value }),
              ),
            )
          }
        />
      </div>
      <AnswerColumnMedia
        draft={draft}
        step={step}
        columnQuality={columnQuality}
        catalog={catalog}
        staged={stagedMedia}
        onChange={onChange}
        onStage={onStage}
      />
    </div>
  );
}

function PreviewStep({ step }: { step: NursingStep }) {
  return (
    <div data-testid="node-wizard-preview">
      <p className="node-wizard-preview-label">Situatiebeschrijving</p>
      <p>{step.phaseLabel}</p>
      <p className="node-wizard-preview-label">Vraag voor de student</p>
      <p>{step.question}</p>
      {step.stepVideoMode === 'placeholder' && step.stepVideoPlaceholder?.trim() ? (
        <p>{step.stepVideoPlaceholder}</p>
      ) : null}
      {step.options.map((option, optionIndex) => (
        <p key={option.id}>
          Antwoord {String(optionIndex + 1)}: {option.text}
        </p>
      ))}
    </div>
  );
}
