import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { OptionQuality } from '../domain/types';
import {
  ANSWER_SCORES,
  answerScoreOf,
  type AnswerScore,
  type NursingOption,
  type NursingScenario,
  type NursingStep,
} from '../nursing/types';
import { appendNursingStep } from './nursingSteps';
import { NursingAnswerVideos } from './NursingAnswerVideos';
import { NursingStepVideoCard } from './NursingStepVideoCard';
import {
  applyStagedNursingMedia,
  resetNursingStep,
  type NursingMediaItem,
  type StagedNursingMediaOp,
} from './nursingMedia';

const QUALITY_LABELS: Record<OptionQuality, string> = {
  high: 'Goed antwoord',
  partial: 'Deels goed antwoord',
  inappropriate: 'Verkeerd antwoord',
};

const QUALITIES: OptionQuality[] = ['high', 'partial', 'inappropriate'];

interface NursingEditorProps {
  draft: NursingScenario;
  onChange: (next: NursingScenario) => void;
  stagedMedia: StagedNursingMediaOp[];
  onStage: (op: StagedNursingMediaOp) => void;
  diskMedia: NursingMediaItem[];
  selectedStepId: string;
  onSelectStep: (id: string) => void;
  previewOptionIndex: number;
  onPreviewOption: (index: number) => void;
  stepHost?: HTMLElement | null;
}

function replaceStep(
  scenario: NursingScenario,
  stepId: string,
  next: NursingStep,
): NursingScenario {
  return {
    ...scenario,
    steps: scenario.steps.map((step) => (step.id === stepId ? next : step)),
  };
}

function replaceOption(step: NursingStep, optionIndex: number, next: NursingOption): NursingStep {
  const options: NursingStep['options'] = [step.options[0], step.options[1], step.options[2]];
  options[optionIndex] = next;
  return { ...step, options };
}

function nursingStepTitle(step: NursingStep, index: number): string {
  const name = step.stepName?.trim();
  return name || `Vraag ${index + 1}`;
}

function fieldClass(value: string, required: boolean): string {
  return required && !value.trim() ? 'field is-empty' : 'field';
}

export function answerFeedbackValue(value: string | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function withAnswerFeedback<T extends { answerFeedback?: string }>(
  option: T,
  value: string,
): T {
  if (value.length === 0) {
    if (option.answerFeedback == null) {
      return option;
    }
    const next = { ...option };
    delete next.answerFeedback;
    return next;
  }
  return { ...option, answerFeedback: value };
}

export function AnswerFeedbackField({
  optionId,
  value,
  rows,
  onChange,
}: {
  optionId: string;
  value: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  const id = `nursing-option-feedback-${optionId}`;
  return (
    <div className="field">
      <label htmlFor={id}>Feedback bij dit gekozen antwoord</label>
      <textarea
        id={id}
        data-testid={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function AnswerScoreField({
  option,
  onScore,
}: {
  option: NursingOption;
  onScore: (score: AnswerScore) => void;
}) {
  return (
    <div className="field field-score">
      <label htmlFor={`nursing-score-${option.id}`}>Score</label>
      <select
        id={`nursing-score-${option.id}`}
        data-testid={`nursing-option-score-${option.id}`}
        value={String(answerScoreOf(option.answerScore))}
        onChange={(event) => onScore(answerScoreOf(Number(event.target.value)))}
      >
        {ANSWER_SCORES.map((score) => (
          <option key={score} value={score}>
            {String(score)}
          </option>
        ))}
      </select>
    </div>
  );
}

function withoutStep(scenario: NursingScenario, stepId: string): NursingScenario {
  if (scenario.steps.length <= 1) {
    return scenario;
  }
  const remaining = scenario.steps.filter((item) => item.id !== stepId);
  const fallbackId = remaining[0]?.id;
  if (!fallbackId) {
    return scenario;
  }
  const steps = remaining.map((item) => ({
    ...item,
    options: item.options.map((option) =>
      option.nextStepId === stepId ? { ...option, nextStepId: fallbackId } : option,
    ) as NursingStep['options'],
  }));
  const startStepId = scenario.meta.startStepId === stepId ? fallbackId : scenario.meta.startStepId;
  return {
    ...scenario,
    meta: { ...scenario.meta, startStepId },
    steps,
  };
}

export function AnswerColumnMedia({
  draft,
  step,
  columnQuality,
  catalog,
  staged,
  onChange,
  onStage,
  deferFileDelete,
}: {
  draft: NursingScenario;
  step: NursingStep;
  columnQuality: OptionQuality;
  catalog: string[];
  staged: StagedNursingMediaOp[];
  onChange: (next: NursingScenario) => void;
  onStage: (op: StagedNursingMediaOp) => void;
  deferFileDelete?: boolean;
}) {
  return (
    <NursingAnswerVideos
      draft={draft}
      step={step}
      staged={staged}
      catalog={catalog}
      onChange={onChange}
      onStage={onStage}
      quality={columnQuality}
      deferFileDelete={deferFileDelete}
    />
  );
}

export function NursingEditor({
  draft,
  onChange,
  stagedMedia,
  onStage,
  diskMedia,
  selectedStepId,
  onSelectStep,
  previewOptionIndex,
  onPreviewOption,
  stepHost = null,
}: NursingEditorProps) {
  const mediaPathOptions = useMemo(() => {
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
  const step = draft.steps.find((item) => item.id === selectedStepId) ?? draft.steps[0];

  function updateSelected(next: NursingStep) {
    onChange(replaceStep(draft, next.id, next));
  }

  function addStep() {
    const added = appendNursingStep(draft);
    onChange(added.scenario);
    onSelectStep(added.step.id);
    onPreviewOption(0);
  }

  const steps = (
        <nav className="editor-nodes" aria-label="Stappen">
          <h2>Stappen</h2>
          <ol>
            {draft.steps.map((item) => (
              <li key={item.id}>
                <div className="editor-step-row">
                  <label
                    className={`editor-step-pick${item.id === step?.id ? ' is-active' : ''}`}
                    data-testid={`nursing-step-tab-${item.id}`}
                    htmlFor={`nursing-step-name-${item.id}`}
                  >
                    <span className="visually-hidden">Vraagnaam</span>
                    <input
                      id={`nursing-step-name-${item.id}`}
                      data-testid={
                        item.id === step?.id ? 'nursing-step-name' : `nursing-step-name-${item.id}`
                      }
                      className="nursing-step-list-name"
                      value={item.stepName ?? ''}
                      onFocus={() => {
                        onSelectStep(item.id);
                        onPreviewOption(0);
                      }}
                      onChange={(event) =>
                        onChange(
                          replaceStep(draft, item.id, { ...item, stepName: event.target.value }),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary editor-step-reset"
                    data-testid={`btn-reset-nursing-step-${item.id}`}
                    onClick={() => onChange(resetNursingStep(draft, item.id))}
                  >
                    Resetten
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-add-nursing-step"
            onClick={addStep}
          >
            Vraag toevoegen
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-remove-nursing-step"
            disabled={draft.steps.length <= 1}
            onClick={() => {
              if (!step || draft.steps.length <= 1) {
                return;
              }
              const next = withoutStep(draft, step.id);
              onChange(next);
              if (!next.steps.some((item) => item.id === step.id)) {
                onSelectStep(next.meta.startStepId);
                onPreviewOption(0);
              }
            }}
          >
            Stap verwijderen
          </button>
          <p className="muted">
            Precies drie antwoorden per stap. Extra antwoorden kan het model niet.
          </p>
        </nav>
  );

  return (
    <>
      {stepHost ? createPortal(steps, stepHost) : steps}
      {step ? (
          <main className="editor-main" id="inhoud">
            <section className="editor-card">
              <h2>Patiënt en scenario</h2>
              <div className="editor-patient-grid">
                <div className="field">
                  <label htmlFor="nursing-education-type">Type onderwijs</label>
                  <textarea
                    id="nursing-education-type"
                    data-testid="nursing-education-type"
                    rows={1}
                    value={draft.meta.educationType ?? ''}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        meta: { ...draft.meta, educationType: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="nursing-title">Titel</label>
                  <textarea
                    id="nursing-title"
                    data-testid="nursing-title"
                    rows={1}
                    value={draft.meta.title}
                    onChange={(event) =>
                      onChange({ ...draft, meta: { ...draft.meta, title: event.target.value } })
                    }
                  />
                </div>
                <div className={fieldClass(draft.patient.name, true)}>
                  <label htmlFor="nursing-patient-name">Patiëntnaam</label>
                  <textarea
                    id="nursing-patient-name"
                    data-testid="nursing-patient-name"
                    rows={1}
                    value={draft.patient.name}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        patient: { ...draft.patient, name: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="field editor-span-2">
                  <label htmlFor="nursing-patient-background">Achtergrond</label>
                  <textarea
                    id="nursing-patient-background"
                    data-testid="nursing-patient-background"
                    rows={2}
                    value={draft.patient.background}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        patient: { ...draft.patient, background: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="field editor-span-2">
                  <label htmlFor="nursing-objectives">Leerdoelen (één per regel)</label>
                  <textarea
                    id="nursing-objectives"
                    data-testid="nursing-objectives"
                    rows={2}
                    value={draft.learningObjectives.join('\n')}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        learningObjectives: event.target.value.split('\n'),
                      })
                    }
                  />
                </div>
              </div>
            </section>

            <section className="editor-card nursing-step-sheet" data-testid="nursing-step-sheet">
              <p className="nursing-step-name" data-testid="nursing-step-title">
                {nursingStepTitle(
                  step,
                  draft.steps.findIndex((item) => item.id === step.id),
                )}
              </p>
              <div className="nursing-step-top">
                <NursingStepVideoCard
                  draft={draft}
                  step={step}
                  staged={stagedMedia}
                  catalog={mediaPathOptions}
                  onChange={onChange}
                  onStage={onStage}
                />
                <div className="editor-card nursing-step-copy">
                  <div className={fieldClass(step.phaseLabel, true)}>
                    <label htmlFor="nursing-phase">Situatiebeschrijving</label>
                    <textarea
                      id="nursing-phase"
                      data-testid="nursing-phase"
                      rows={6}
                      value={step.phaseLabel}
                      onChange={(event) =>
                        updateSelected({ ...step, phaseLabel: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass(step.question, true)}>
                    <label htmlFor="nursing-question">Vraag voor de student</label>
                    <textarea
                      id="nursing-question"
                      data-testid="nursing-question"
                      rows={6}
                      value={step.question}
                      onChange={(event) =>
                        updateSelected({ ...step, question: event.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="nursing-step-answers">
                {step.options.map((option, optionIndex) => {
                  const columnQuality = QUALITIES[optionIndex];
                  return (
                    <div className="nursing-step-answer-col" key={option.id}>
                      <section
                        className={`editor-card option-card is-quality-${option.quality}${previewOptionIndex === optionIndex ? ' is-previewed' : ''}`}
                        data-testid={`nursing-option-editor-${option.id}`}
                      >
                        <div className="option-card-head">
                          <h2>Antwoord {String(optionIndex + 1)}</h2>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            data-testid={`btn-preview-nursing-option-${String(optionIndex)}`}
                            onClick={() => onPreviewOption(optionIndex)}
                          >
                            Toon voorbeeld
                          </button>
                        </div>
                        <div className="field">
                          <label htmlFor={`nursing-quality-${option.id}`}>Kwaliteit</label>
                          <select
                            id={`nursing-quality-${option.id}`}
                            data-testid={`nursing-option-quality-${option.id}`}
                            value={option.quality}
                            onChange={(event) =>
                              updateSelected(
                                replaceOption(step, optionIndex, {
                                  ...option,
                                  quality: event.target.value as OptionQuality,
                                }),
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
                        <AnswerScoreField
                          option={option}
                          onScore={(answerScore) =>
                            updateSelected(
                              replaceOption(step, optionIndex, { ...option, answerScore }),
                            )
                          }
                        />
                        <div className={fieldClass(option.text, true)}>
                          <label htmlFor={`nursing-option-text-${option.id}`}>Antwoord keuze</label>
                          <textarea
                            id={`nursing-option-text-${option.id}`}
                            data-testid={`nursing-option-text-${option.id}`}
                            rows={2}
                            value={option.text}
                            onChange={(event) =>
                              updateSelected(
                                replaceOption(step, optionIndex, {
                                  ...option,
                                  text: event.target.value,
                                }),
                              )
                            }
                          />
                        </div>
                        <AnswerFeedbackField
                          optionId={option.id}
                          rows={2}
                          value={answerFeedbackValue(option.answerFeedback)}
                          onChange={(answerFeedback) =>
                            updateSelected(
                              replaceOption(
                                step,
                                optionIndex,
                                withAnswerFeedback(option, answerFeedback),
                              ),
                            )
                          }
                        />
                        {columnQuality ? (
                          <AnswerColumnMedia
                            draft={draft}
                            step={step}
                            columnQuality={columnQuality}
                            catalog={mediaPathOptions}
                            staged={stagedMedia}
                            onChange={onChange}
                            onStage={onStage}
                          />
                        ) : null}
                      </section>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        ) : null}
    </>
  );
}
