import { useMemo, useState, type ReactNode } from 'react';
import type { OptionQuality, Scenario, StudentOption } from '../domain/types';
import type { NursingOption, NursingScenario, NursingStep } from '../nursing/types';
import { EDITOR_FACES } from './faces';
import { AnswerColumnMedia } from './NursingEditor';
import { NursingStepVideoCard } from './NursingStepVideoCard';
import type { NodeEditTarget } from './NodeOverview';
import {
  applyStagedNursingMedia,
  isOwnedQuestionVideo,
  saveNursingMediaOp,
  type NursingMediaItem,
  type StagedNursingMediaOp,
} from './nursingMedia';

const QUALITY_LABELS: Record<OptionQuality, string> = {
  high: 'Goed antwoord',
  partial: 'Deels goed antwoord',
  inappropriate: 'Verkeerd antwoord',
};

const QUALITIES: OptionQuality[] = ['high', 'partial', 'inappropriate'];

interface NursingNodeEditProps {
  module: 'verpleegkunde';
  target: NodeEditTarget;
  draft: NursingScenario;
  stagedMedia: StagedNursingMediaOp[];
  diskMedia: NursingMediaItem[];
  onStage: (op: StagedNursingMediaOp) => void;
  onSave: (next: NursingScenario) => void;
  onClose: () => void;
}

interface LogopedieNodeEditProps {
  module: 'logopedie';
  target: NodeEditTarget;
  scenario: Scenario;
  onSave: (next: Scenario) => void;
  onClose: () => void;
}

type NodeFieldEditorProps = NursingNodeEditProps | LogopedieNodeEditProps;

function replaceStep(draft: NursingScenario, next: NursingStep): NursingScenario {
  return {
    ...draft,
    steps: draft.steps.map((step) => (step.id === next.id ? next : step)),
  };
}

function replaceNursingOption(
  step: NursingStep,
  optionIndex: number,
  next: NursingOption,
): NursingStep {
  const options: NursingStep['options'] = [step.options[0], step.options[1], step.options[2]];
  options[optionIndex] = next;
  return { ...step, options };
}

function replaceLogopedieOption(
  node: Scenario['nodes'][number],
  optionIndex: number,
  next: StudentOption,
): Scenario['nodes'][number] {
  const options: Scenario['nodes'][number]['options'] = [
    node.options[0],
    node.options[1],
    node.options[2],
  ];
  options[optionIndex] = next;
  return { ...node, options };
}

function fieldClass(value: string): string {
  return value.trim() ? 'field' : 'field is-empty';
}

function EditFrame({
  title,
  children,
  onSave,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="node-edit-layer" data-testid="node-edit-dialog">
      <div className="node-edit" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <div className="node-edit-actions">
          <button type="button" className="btn" data-testid="btn-node-edit-save" onClick={onSave}>
            Opslaan
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-node-edit-cancel"
            onClick={onClose}
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}

function NursingNodeEdit({
  target,
  draft,
  stagedMedia,
  diskMedia,
  onStage,
  onSave,
  onClose,
}: NursingNodeEditProps) {
  const [local, setLocal] = useState(draft);
  const [extraStaged, setExtraStaged] = useState<StagedNursingMediaOp[]>([]);
  const staged = useMemo(() => {
    const map = new Map(stagedMedia.map((op) => [op.relativePath, op]));
    for (const op of extraStaged) {
      map.set(op.relativePath, op);
    }
    return [...map.values()];
  }, [extraStaged, stagedMedia]);
  const catalog = useMemo(() => {
    const seed = new Map<string, NursingMediaItem>();
    for (const slot of local.mediaSlots) {
      if (slot.primaryMedia) {
        seed.set(slot.primaryMedia, { relativePath: slot.primaryMedia, sizeBytes: 0 });
      }
    }
    for (const item of diskMedia) {
      seed.set(item.relativePath, item);
    }
    return applyStagedNursingMedia([...seed.values()], staged).map((item) => item.relativePath);
  }, [diskMedia, local.mediaSlots, staged]);
  const step = local.steps.find((item) => item.id === target.stepId);
  if (!step) {
    return null;
  }
  const optionIndex =
    target.quality === null
      ? -1
      : step.options.findIndex((option) => option.quality === target.quality);
  const option = optionIndex >= 0 ? step.options[optionIndex] : undefined;

  async function save() {
    for (const op of extraStaged) {
      if (op.type === 'delete' && isOwnedQuestionVideo(op.relativePath)) {
        try {
          await saveNursingMediaOp(op);
        } catch {
          return;
        }
      }
      onStage(op);
    }
    onSave(local);
    onClose();
  }

  if (target.quality === null || !option) {
    return (
      <EditFrame
        title={`Bewerken ${step.stepName?.trim() || 'vraag'}`}
        onSave={save}
        onClose={onClose}
      >
        <NursingStepVideoCard
          draft={local}
          step={step}
          staged={staged}
          catalog={catalog}
          onChange={setLocal}
          deferFileDelete
          onStage={(op) => {
            setExtraStaged((current) => [
              ...current.filter((item) => item.relativePath !== op.relativePath),
              op,
            ]);
          }}
        />
        <div className={fieldClass(step.phaseLabel)}>
          <label htmlFor="nursing-phase">Situatiebeschrijving</label>
          <textarea
            id="nursing-phase"
            data-testid="nursing-phase"
            rows={6}
            value={step.phaseLabel}
            onChange={(event) =>
              setLocal(replaceStep(local, { ...step, phaseLabel: event.target.value }))
            }
          />
        </div>
        <div className={fieldClass(step.question)}>
          <label htmlFor="nursing-question">Vraag voor de student</label>
          <textarea
            id="nursing-question"
            data-testid="nursing-question"
            rows={6}
            value={step.question}
            onChange={(event) =>
              setLocal(replaceStep(local, { ...step, question: event.target.value }))
            }
          />
        </div>
      </EditFrame>
    );
  }

  return (
    <EditFrame title={`Bewerken ${QUALITY_LABELS[option.quality]}`} onSave={save} onClose={onClose}>
      <div className="field">
        <label htmlFor={`nursing-quality-${option.id}`}>Kwaliteit</label>
        <select
          id={`nursing-quality-${option.id}`}
          data-testid={`nursing-option-quality-${option.id}`}
          value={option.quality}
          onChange={(event) =>
            setLocal(
              replaceStep(
                local,
                replaceNursingOption(step, optionIndex, {
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
      <div className={fieldClass(option.text)}>
        <label htmlFor={`nursing-option-text-${option.id}`}>Antwoord keuze</label>
        <textarea
          id={`nursing-option-text-${option.id}`}
          data-testid={`nursing-option-text-${option.id}`}
          rows={3}
          value={option.text}
          onChange={(event) =>
            setLocal(
              replaceStep(
                local,
                replaceNursingOption(step, optionIndex, { ...option, text: event.target.value }),
              ),
            )
          }
        />
      </div>
      <AnswerColumnMedia
        draft={local}
        step={step}
        columnQuality={option.quality}
        catalog={catalog}
        staged={staged}
        onChange={setLocal}
        deferFileDelete
        onStage={(op) => {
          setExtraStaged((current) => [
            ...current.filter((item) => item.relativePath !== op.relativePath),
            op,
          ]);
        }}
      />
    </EditFrame>
  );
}

function LogopedieNodeEdit({ target, scenario, onSave, onClose }: LogopedieNodeEditProps) {
  const [local, setLocal] = useState(scenario);
  const node = local.nodes.find((item) => item.id === target.stepId);
  if (!node) {
    return null;
  }
  const optionIndex =
    target.quality === null
      ? -1
      : node.options.findIndex((option) => option.quality === target.quality);
  const option = optionIndex >= 0 ? node.options[optionIndex] : undefined;

  function updateNode(next: Scenario['nodes'][number]) {
    setLocal({
      ...local,
      nodes: local.nodes.map((item) => (item.id === next.id ? next : item)),
    });
  }

  function save() {
    onSave(local);
    onClose();
  }

  if (target.quality === null || !option) {
    return (
      <EditFrame
        title={`Bewerken ${node.phaseLabel.trim() || 'vraag'}`}
        onSave={save}
        onClose={onClose}
      >
        <div className={fieldClass(node.prompt.text)}>
          <label htmlFor="prompt-text">Wat zegt de cliënt?</label>
          <textarea
            id="prompt-text"
            data-testid="prompt-text"
            rows={3}
            value={node.prompt.text}
            onChange={(event) =>
              updateNode({ ...node, prompt: { ...node.prompt, text: event.target.value } })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="prompt-context">Wat is zichtbaar?</label>
          <textarea
            id="prompt-context"
            data-testid="prompt-context"
            rows={2}
            value={node.prompt.context}
            onChange={(event) =>
              updateNode({ ...node, prompt: { ...node.prompt, context: event.target.value } })
            }
          />
        </div>
      </EditFrame>
    );
  }

  return (
    <EditFrame title={`Bewerken ${QUALITY_LABELS[option.quality]}`} onSave={save} onClose={onClose}>
      <div className="field">
        <label htmlFor={`quality-${option.id}`}>Kwaliteit</label>
        <select
          id={`quality-${option.id}`}
          data-testid={`option-quality-${option.id}`}
          value={option.quality}
          onChange={(event) =>
            updateNode(
              replaceLogopedieOption(node, optionIndex, {
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
      <div className={fieldClass(option.text)}>
        <label htmlFor={`option-text-${option.id}`}>Antwoord keuze</label>
        <textarea
          id={`option-text-${option.id}`}
          data-testid={`option-text-${option.id}`}
          rows={3}
          value={option.text}
          onChange={(event) =>
            updateNode(
              replaceLogopedieOption(node, optionIndex, { ...option, text: event.target.value }),
            )
          }
        />
      </div>
      <div className={fieldClass(option.clientResponse.text)}>
        <label htmlFor={`client-response-${option.id}`}>Reactie van de cliënt</label>
        <textarea
          id={`client-response-${option.id}`}
          data-testid={`client-response-${option.id}`}
          rows={2}
          value={option.clientResponse.text}
          onChange={(event) =>
            updateNode(
              replaceLogopedieOption(node, optionIndex, {
                ...option,
                clientResponse: { ...option.clientResponse, text: event.target.value },
              }),
            )
          }
        />
      </div>
      <fieldset className="face-picker">
        <legend>Gezicht na dit antwoord</legend>
        <div className="face-options">
          {EDITOR_FACES.map((face) => (
            <label key={face.emotion} className="face-option">
              <input
                type="radio"
                name={`face-${option.id}`}
                value={face.emotion}
                checked={option.emotion === face.emotion}
                data-testid={`option-face-${option.id}-${face.emotion}`}
                onChange={() =>
                  updateNode(
                    replaceLogopedieOption(node, optionIndex, { ...option, emotion: face.emotion }),
                  )
                }
              />
              {face.label}
            </label>
          ))}
        </div>
      </fieldset>
    </EditFrame>
  );
}

export function NodeFieldEditor(props: NodeFieldEditorProps) {
  if (props.module === 'verpleegkunde') {
    return <NursingNodeEdit {...props} />;
  }
  return <LogopedieNodeEdit {...props} />;
}
