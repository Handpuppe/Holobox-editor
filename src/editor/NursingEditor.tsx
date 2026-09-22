import { useMemo } from 'react';
import { publicResourceUrl } from '../media/logopedie/resolveAvatar';
import { mediaItemFromRelativePath } from '../media/matching';
import type { OptionQuality } from '../domain/types';
import {
  NURSING_COMPETENCIES,
  NURSING_WEIGHTS,
  type NursingCompetency,
  type NursingOption,
  type NursingScenario,
  type NursingStep,
} from '../nursing/types';
import { validateNursingScenario } from '../nursing/validateNursing';
import type { StagedNursingMediaOp } from './nursingMedia';

const QUALITY_LABELS: Record<OptionQuality, string> = {
  high: 'Goed (high)',
  partial: 'Gedeeltelijk (partial)',
  inappropriate: 'Ongepast (inappropriate)',
};

const QUALITIES: OptionQuality[] = ['high', 'partial', 'inappropriate'];

const COMPETENCY_LABELS: Record<NursingCompetency, string> = {
  abcdeSystematics: 'ABCDE-systematiek',
  observation: 'Observatie',
  patientSafety: 'Patiëntveiligheid',
  sbarCommunication: 'SBAR-overdracht',
  professionalBehaviour: 'Professioneel gedrag',
};

const SBAR_FIELDS = ['situation', 'background', 'assessment', 'recommendation'] as const;

interface NursingEditorProps {
  draft: NursingScenario;
  onChange: (next: NursingScenario) => void;
  stagedMedia: StagedNursingMediaOp[];
  selectedStepId: string;
  onSelectStep: (id: string) => void;
  previewOptionIndex: number;
  onPreviewOption: (index: number) => void;
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

function nextCustomStepId(steps: NursingStep[]): string {
  let n = 1;
  const ids = new Set(steps.map((step) => step.id));
  while (ids.has(`n-extra-${String(n)}`)) {
    n += 1;
  }
  return `n-extra-${String(n)}`;
}

function emptyOption(
  stepId: string,
  quality: OptionQuality,
  nextStepId: string,
  scored: NursingCompetency[],
): NursingOption {
  const awards: NursingOption['competencyAwards'] = {};
  for (const competency of scored) {
    awards[competency] = quality === 'high' ? 1 : quality === 'partial' ? 0.5 : 0;
  }
  return {
    id: `${stepId}-${quality}`,
    text: '',
    quality,
    unsafe: quality === 'inappropriate',
    competencyAwards: awards,
    delayedFeedback: 'Feedback voor deze keuze.',
    educationalRationale: 'Toelichting voor deze keuze.',
    nextStepId,
  };
}

function createStep(existing: NursingStep[]): NursingStep {
  const id = nextCustomStepId(existing);
  const scored: NursingCompetency[] = ['abcdeSystematics'];
  const mediaSlotId = existing[0]?.mediaSlotId ?? 'nursing-airway';
  return {
    id,
    phaseLabel: 'Nieuwe stap',
    question: 'Nieuwe vraag',
    help: '',
    mediaSlotId,
    scoredCompetencies: scored,
    kind: 'choice',
    options: [
      emptyOption(id, 'high', 'completed', scored),
      emptyOption(id, 'partial', 'completed', scored),
      emptyOption(id, 'inappropriate', 'completed', scored),
    ],
  };
}

function slotMediaPath(
  draft: NursingScenario,
  slotId: string | undefined,
  staged: StagedNursingMediaOp[],
): { path: string | null; previewUrl: string | null } {
  if (!slotId) {
    return { path: null, previewUrl: null };
  }
  const slot = draft.mediaSlots.find((item) => item.slotId === slotId);
  const path = slot?.primaryMedia ?? null;
  if (!path) {
    return { path: null, previewUrl: null };
  }
  const stagedOp = staged.find((item) => item.relativePath === path);
  if (stagedOp && stagedOp.type !== 'delete') {
    return { path, previewUrl: stagedOp.previewUrl };
  }
  if (stagedOp?.type === 'delete') {
    return { path: null, previewUrl: null };
  }
  return { path, previewUrl: publicResourceUrl(path) };
}

export function NursingEditor({
  draft,
  onChange,
  stagedMedia,
  selectedStepId,
  onSelectStep,
  previewOptionIndex,
  onPreviewOption,
}: NursingEditorProps) {
  const issues = useMemo(() => validateNursingScenario(draft), [draft]);
  const mediaPathOptions = useMemo(() => {
    const paths = new Set<string>();
    for (const slot of draft.mediaSlots) {
      if (slot.primaryMedia) {
        paths.add(slot.primaryMedia);
      }
    }
    for (const op of stagedMedia) {
      if (op.type !== 'delete') {
        paths.add(op.relativePath);
      }
    }
    return [...paths].sort((a, b) => a.localeCompare(b, 'nl'));
  }, [draft.mediaSlots, stagedMedia]);
  const step = draft.steps.find((item) => item.id === selectedStepId) ?? draft.steps[0];
  const previewOption = step?.options[previewOptionIndex] ?? step?.options[0];
  const previewSlotId = previewOption?.mediaSlotId ?? step?.mediaSlotId;
  const previewMedia = slotMediaPath(draft, previewSlotId, stagedMedia);
  const nextTargets = [
    ...draft.steps.map((item) => ({ id: item.id, label: `${item.phaseLabel} (${item.id})` })),
    { id: 'completed', label: 'Afronden' },
  ];

  function updateSelected(next: NursingStep) {
    onChange(replaceStep(draft, next.id, next));
  }

  function addStep() {
    const next = createStep(draft.steps);
    onChange({ ...draft, steps: [...draft.steps, next] });
    onSelectStep(next.id);
    onPreviewOption(0);
  }

  return (
    <>
      <section
        className={`editor-issues${issues.length > 0 ? ' has-issues' : ''}`}
        data-testid="editor-nursing-issues"
        aria-live="polite"
      >
        <h2>Controle</h2>
        {issues.length === 0 ? (
          <p data-testid="editor-nursing-issues-ok">Geen validatiefouten.</p>
        ) : (
          <ul data-testid="editor-nursing-issues-list">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="editor-layout">
        <nav className="editor-nodes" aria-label="Stappen">
          <h2>Stappen</h2>
          <ol>
            {draft.steps.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === step?.id ? 'is-active' : undefined}
                  data-testid={`nursing-step-tab-${item.id}`}
                  onClick={() => {
                    onSelectStep(item.id);
                    onPreviewOption(0);
                  }}
                >
                  {String(index + 1)}. {item.phaseLabel}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-add-nursing-step"
            onClick={addStep}
          >
            Stap toevoegen
          </button>
          <p className="muted">
            Precies drie antwoorden per stap. Extra antwoorden kan het model niet.
          </p>
        </nav>

        {step ? (
          <main className="editor-main" id="inhoud">
            <section className="editor-card">
              <h2>Patiënt en scenario</h2>
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
              <div className="field">
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
              <div className="field">
                <label htmlFor="nursing-patient-background">Achtergrond</label>
                <textarea
                  id="nursing-patient-background"
                  data-testid="nursing-patient-background"
                  rows={3}
                  value={draft.patient.background}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      patient: { ...draft.patient, background: event.target.value },
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="nursing-objectives">Leerdoelen (één per regel)</label>
                <textarea
                  id="nursing-objectives"
                  data-testid="nursing-objectives"
                  rows={4}
                  value={draft.learningObjectives.join('\n')}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      learningObjectives: event.target.value.split('\n'),
                    })
                  }
                />
              </div>
            </section>

            <section className="editor-card editor-readonly" data-testid="nursing-weights-readonly">
              <h2>Scoreformule (niet bewerkbaar)</h2>
              <p className="muted">
                Gewichten zitten in de engine, niet in de JSON. Scenario-id {draft.meta.id},
                rubricversie {draft.meta.rubricVersion}.
              </p>
              <ul className="editor-readonly-list">
                {NURSING_COMPETENCIES.map((item) => (
                  <li key={item}>
                    {COMPETENCY_LABELS[item]}: {String(Math.round(NURSING_WEIGHTS[item] * 100))}%
                  </li>
                ))}
              </ul>
              <p className="muted">Staptype is choice. Vrije SBAR-tekst zit niet in de engine.</p>
            </section>

            <section className="editor-card">
              <h2>Vraag</h2>
              <p className="muted">Stap {step.id}</p>
              <div className="field">
                <label htmlFor="nursing-phase">Fase</label>
                <textarea
                  id="nursing-phase"
                  data-testid="nursing-phase"
                  rows={1}
                  value={step.phaseLabel}
                  onChange={(event) => updateSelected({ ...step, phaseLabel: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="nursing-question">Vraag aan de student</label>
                <textarea
                  id="nursing-question"
                  data-testid="nursing-question"
                  rows={3}
                  value={step.question}
                  onChange={(event) => updateSelected({ ...step, question: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="nursing-help">Toelichting</label>
                <textarea
                  id="nursing-help"
                  data-testid="nursing-help"
                  rows={2}
                  value={step.help}
                  onChange={(event) => updateSelected({ ...step, help: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="nursing-step-slot">Videospot</label>
                <select
                  id="nursing-step-slot"
                  data-testid="nursing-step-slot"
                  value={step.mediaSlotId}
                  onChange={(event) => updateSelected({ ...step, mediaSlotId: event.target.value })}
                >
                  {draft.mediaSlots.map((slot) => (
                    <option key={slot.slotId} value={slot.slotId}>
                      {slot.studentLabel} ({slot.slotId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="editor-readonly-label">Type (niet bewerkbaar)</span>
                <p className="editor-readonly-value" data-testid="nursing-step-kind">
                  {step.kind}
                </p>
              </div>
              <div className="field">
                <label htmlFor="nursing-sbar-field">SBAR-veld</label>
                <select
                  id="nursing-sbar-field"
                  data-testid="nursing-sbar-field"
                  value={step.sbarField ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateSelected({
                      ...step,
                      sbarField: value ? (value as (typeof SBAR_FIELDS)[number]) : undefined,
                    });
                  }}
                >
                  <option value="">Geen</option>
                  {SBAR_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="face-picker">
                <legend>Gescoorde competenties</legend>
                <div className="face-options">
                  {NURSING_COMPETENCIES.map((competency) => (
                    <label key={competency} className="face-option">
                      <input
                        type="checkbox"
                        checked={step.scoredCompetencies.includes(competency)}
                        data-testid={`nursing-scored-${step.id}-${competency}`}
                        onChange={(event) => {
                          const scored = event.target.checked
                            ? [...step.scoredCompetencies, competency]
                            : step.scoredCompetencies.filter((item) => item !== competency);
                          const options = step.options.map((option) => {
                            const awards = { ...option.competencyAwards };
                            if (event.target.checked) {
                              awards[competency] =
                                option.quality === 'high'
                                  ? 1
                                  : option.quality === 'partial'
                                    ? 0.5
                                    : 0;
                            } else {
                              delete awards[competency];
                            }
                            return { ...option, competencyAwards: awards };
                          }) as NursingStep['options'];
                          updateSelected({ ...step, scoredCompetencies: scored, options });
                        }}
                      />
                      {COMPETENCY_LABELS[competency]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            {step.options.map((option, optionIndex) => (
              <section
                key={option.id}
                className={`editor-card option-card${previewOptionIndex === optionIndex ? ' is-previewed' : ''}`}
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
                <div className="field">
                  <label htmlFor={`nursing-option-text-${option.id}`}>Wat zegt de student?</label>
                  <textarea
                    id={`nursing-option-text-${option.id}`}
                    data-testid={`nursing-option-text-${option.id}`}
                    rows={3}
                    value={option.text}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(step, optionIndex, { ...option, text: event.target.value }),
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor={`nursing-feedback-${option.id}`}>Feedback</label>
                  <textarea
                    id={`nursing-feedback-${option.id}`}
                    data-testid={`nursing-feedback-${option.id}`}
                    rows={2}
                    value={option.delayedFeedback}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(step, optionIndex, {
                          ...option,
                          delayedFeedback: event.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor={`nursing-rationale-${option.id}`}>Toelichting</label>
                  <textarea
                    id={`nursing-rationale-${option.id}`}
                    data-testid={`nursing-rationale-${option.id}`}
                    rows={2}
                    value={option.educationalRationale}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(step, optionIndex, {
                          ...option,
                          educationalRationale: event.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <label className="face-option">
                  <input
                    type="checkbox"
                    checked={option.unsafe}
                    data-testid={`nursing-option-unsafe-${option.id}`}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(step, optionIndex, {
                          ...option,
                          unsafe: event.target.checked,
                        }),
                      )
                    }
                  />
                  Onveilig
                </label>
                <div className="field">
                  <label htmlFor={`nursing-critical-${option.id}`}>Kritieke fout (optioneel)</label>
                  <textarea
                    id={`nursing-critical-${option.id}`}
                    data-testid={`nursing-option-critical-${option.id}`}
                    rows={2}
                    value={option.criticalError ?? ''}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(step, optionIndex, {
                          ...option,
                          criticalError: event.target.value.trim() ? event.target.value : undefined,
                        }),
                      )
                    }
                  />
                </div>
                {step.scoredCompetencies.map((competency) => (
                  <div className="field" key={competency}>
                    <label htmlFor={`nursing-award-${option.id}-${competency}`}>
                      Score {COMPETENCY_LABELS[competency]}
                    </label>
                    <select
                      id={`nursing-award-${option.id}-${competency}`}
                      data-testid={`nursing-award-${option.id}-${competency}`}
                      value={String(option.competencyAwards[competency] ?? 0)}
                      onChange={(event) =>
                        updateSelected(
                          replaceOption(step, optionIndex, {
                            ...option,
                            competencyAwards: {
                              ...option.competencyAwards,
                              [competency]: Number(event.target.value) as 0 | 0.5 | 1,
                            },
                          }),
                        )
                      }
                    >
                      <option value="0">0</option>
                      <option value="0.5">0.5</option>
                      <option value="1">1</option>
                    </select>
                  </div>
                ))}
                <div className="field">
                  <label htmlFor={`nursing-option-slot-${option.id}`}>Video bij dit antwoord</label>
                  <select
                    id={`nursing-option-slot-${option.id}`}
                    data-testid={`nursing-option-slot-${option.id}`}
                    value={option.mediaSlotId ?? ''}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(step, optionIndex, {
                          ...option,
                          mediaSlotId: event.target.value || undefined,
                        }),
                      )
                    }
                  >
                    <option value="">Zelfde als de stap</option>
                    {draft.mediaSlots.map((slot) => (
                      <option key={slot.slotId} value={slot.slotId}>
                        {slot.studentLabel} ({slot.slotId})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`nursing-next-${option.id}`}>Volgende stap</label>
                  <select
                    id={`nursing-next-${option.id}`}
                    data-testid={`nursing-option-next-${option.id}`}
                    value={option.nextStepId}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(step, optionIndex, {
                          ...option,
                          nextStepId: event.target.value,
                        }),
                      )
                    }
                  >
                    {nextTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            ))}

            <section className="editor-card">
              <h2>Videobestand per slot</h2>
              <p className="muted">
                Pad blijft onder resources/verpleegkunde/. Bestanden niet hernoemen.
              </p>
              {draft.mediaSlots.map((slot) => (
                <div className="field" key={slot.slotId}>
                  <label htmlFor={`slot-media-${slot.slotId}`}>{slot.studentLabel}</label>
                  <select
                    id={`slot-media-${slot.slotId}`}
                    data-testid={`nursing-slot-media-${slot.slotId}`}
                    value={slot.primaryMedia ?? ''}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        mediaSlots: draft.mediaSlots.map((item) =>
                          item.slotId === slot.slotId
                            ? { ...item, primaryMedia: event.target.value || null }
                            : item,
                        ),
                      })
                    }
                  >
                    <option value="">Geen</option>
                    {mediaPathOptions.map((path) => (
                      <option key={path} value={path}>
                        {path}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </section>
          </main>
        ) : null}

        <aside className="editor-preview">
          <h2>Voorbeeld</h2>
          <p className="muted" data-testid="preview-nursing-phase">
            {step?.phaseLabel}
          </p>
          <p data-testid="preview-nursing-question">{step?.question}</p>
          <p className="muted" data-testid="preview-nursing-option">
            {previewOption?.text}
          </p>
          <div className="editor-preview-stage" data-testid="editor-nursing-preview-stage">
            {previewMedia.previewUrl ? (
              /\.(mp4|webm|mov|m4v)$/i.test(previewMedia.path ?? '') ? (
                <video
                  src={previewMedia.previewUrl}
                  className="editor-preview-video"
                  data-testid="editor-nursing-preview-video"
                  controls
                  playsInline
                  preload="metadata"
                >
                  <track
                    kind="captions"
                    srcLang="nl"
                    label="Nederlands"
                    src="data:text/vtt,WEBVTT%0A%0A00:00.000%20--%3E%2000:59.000%0AVoorbeeldvideo"
                  />
                </video>
              ) : (
                <img
                  src={previewMedia.previewUrl}
                  alt=""
                  className="editor-media-preview-img"
                  data-testid="editor-nursing-preview-image"
                />
              )
            ) : (
              <p className="muted">Geen video voor dit antwoord.</p>
            )}
          </div>
          <p className="muted">{previewOption?.delayedFeedback}</p>
          {previewMedia.path ? (
            <p className="muted">
              {mediaItemFromRelativePath(previewMedia.path, 'verpleegkunde').relativePath}
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
