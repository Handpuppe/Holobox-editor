import { useEffect, useMemo, useRef, useState } from 'react';
import { LogopedieAvatar } from '../media/logopedie/LogopedieAvatar';
import { avatarSourceChain } from '../media/logopedie/resolveAvatar';
import {
  CONCLUSION_NODE_ID,
  type DecisionNode,
  type OptionQuality,
  type Scenario,
  type StudentOption,
} from '../domain/types';
import { validateScenario } from '../domain/scenarioValidation';
import { cloneScenario } from './cloneScenario';
import { EditorMediaPanel } from './EditorMediaPanel';
import { downloadEnvelope, parseLogopedieEnvelope, saveEnvelopeToCopy } from './envelope';
import { EDITOR_FACES, faceLabel } from './faces';
import { editorSourceLabel, loadEditorStartupScenario } from './loadSavedScenario';
import { saveLogopedieMediaOp, type StagedMediaOp } from './logopedieMedia';

const QUALITY_LABELS: Record<OptionQuality, string> = {
  high: 'Goed (high)',
  partial: 'Gedeeltelijk (partial)',
  inappropriate: 'Ongepast (inappropriate)',
};

const QUALITIES: OptionQuality[] = ['high', 'partial', 'inappropriate'];

function canSaveToThisCopy(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
}

function replaceNode(scenario: Scenario, nodeId: string, next: DecisionNode): Scenario {
  return {
    ...scenario,
    nodes: scenario.nodes.map((node) => (node.id === nodeId ? next : node)),
  };
}

function replaceOption(node: DecisionNode, optionIndex: number, next: StudentOption): DecisionNode {
  const options: DecisionNode['options'] = [node.options[0], node.options[1], node.options[2]];
  options[optionIndex] = next;
  return { ...node, options };
}

export function EditorApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  const [scenario, setScenario] = useState<Scenario>(() => cloneScenario());
  const [selectedNodeId, setSelectedNodeId] = useState(scenario.startNodeId);
  const [previewOptionIndex, setPreviewOptionIndex] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [loadedLabel, setLoadedLabel] = useState(() => editorSourceLabel('seed'));
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stagedMedia, setStagedMedia] = useState<StagedMediaOp[]>([]);
  const saveOnThisPc = canSaveToThisCopy();

  useEffect(() => {
    let cancelled = false;
    void loadEditorStartupScenario().then((result) => {
      if (cancelled || dirtyRef.current) {
        return;
      }
      setScenario(result.scenario);
      setSelectedNodeId(result.scenario.startNodeId);
      setPreviewOptionIndex(0);
      setLoadedLabel(result.label);
      setLoadNotice(result.notice);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function markDirty() {
    dirtyRef.current = true;
  }

  function resetToSeed() {
    markDirty();
    const seeded = cloneScenario();
    setScenario(seeded);
    setSelectedNodeId(seeded.startNodeId);
    setPreviewOptionIndex(0);
    setOpenError(null);
    setLoadNotice(null);
    setLoadedLabel(editorSourceLabel('seed'));
    setSaveMessage(null);
    setSaveError(null);
    setStagedMedia([]);
  }

  async function openJsonFile(file: File | undefined) {
    if (!file) {
      return;
    }
    try {
      const parsed = parseLogopedieEnvelope(await file.text());
      if (!parsed.ok) {
        setOpenError(parsed.error);
        return;
      }
      markDirty();
      setScenario(parsed.scenario);
      setSelectedNodeId(parsed.scenario.startNodeId);
      setPreviewOptionIndex(0);
      setOpenError(null);
      setLoadNotice(null);
      setLoadedLabel(editorSourceLabel('json', file.name));
    } catch {
      setOpenError('Het bestand kon niet worden gelezen.');
    }
  }

  async function saveToCopy() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const result = await saveEnvelopeToCopy(scenario);
    if (!result.ok) {
      setSaving(false);
      setSaveError(result.error);
      return;
    }
    try {
      for (const op of stagedMedia) {
        await saveLogopedieMediaOp(op);
      }
      setStagedMedia([]);
      setLoadedLabel(editorSourceLabel('json'));
      setLoadNotice(null);
      setSaveMessage(
        'Opgeslagen in deze kopie. Start de simulator opnieuw om de wijziging te zien.',
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Media opslaan is mislukt.');
    } finally {
      setSaving(false);
    }
  }

  const issues = useMemo(() => validateScenario(scenario), [scenario]);
  const node = scenario.nodes.find((item) => item.id === selectedNodeId) ?? scenario.nodes[0];
  const previewOption = node?.options[previewOptionIndex] ?? node?.options[0];
  const previewEmotion = previewOption?.emotion ?? node?.promptEmotion ?? 'neutral';
  const previewAvatarPath = avatarSourceChain(previewEmotion)[0]?.relativePath ?? null;
  const stagedAvatar = stagedMedia.find(
    (op) => op.type !== 'delete' && op.relativePath === previewAvatarPath,
  );
  const avatarOverride =
    stagedAvatar && stagedAvatar.type !== 'delete' ? stagedAvatar.previewUrl : null;
  const nextTargets = [
    ...scenario.nodes.map((item) => ({ id: item.id, label: `${item.phaseLabel} (${item.id})` })),
    { id: CONCLUSION_NODE_ID, label: 'Conclusie' },
  ];

  function updateSelected(next: DecisionNode) {
    markDirty();
    setScenario((current) => replaceNode(current, next.id, next));
  }

  return (
    <div className="scenario-editor" data-testid="screen-scenario-editor" lang="nl">
      <header className="editor-header">
        <div>
          <p className="editor-kicker">Los van de studentensimulatie</p>
          <h1>Logopedie-scenariobewerker</h1>
          <p className="editor-meta">
            {scenario.title} · {scenario.id} · v{scenario.version}
          </p>
          <p className="editor-loaded" data-testid="editor-loaded-source">
            {loadedLabel}
          </p>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-reset-seed"
            onClick={resetToSeed}
          >
            Herstel startkopie
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-open-json"
            onClick={() => fileInputRef.current?.click()}
          >
            Open JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            data-testid="input-open-json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void openJsonFile(file);
            }}
          />
          <button
            type="button"
            className="btn"
            data-testid="btn-download-json"
            onClick={() => downloadEnvelope(scenario)}
          >
            Download JSON
          </button>
          {saveOnThisPc ? (
            <button
              type="button"
              className="btn"
              data-testid="btn-save-json"
              onClick={() => void saveToCopy()}
              disabled={saving}
            >
              Opslaan
            </button>
          ) : null}
        </div>
      </header>

      <p className="editor-notice" data-testid="editor-demo-notice">
        Dit is een demo-editor, geen les-app. Open JSON en Download JSON werken in de browser.
        Opslaan naar schijf kan alleen lokaal via Editor.exe.
      </p>
      <p className="editor-notice">
        Bij openen wordt logopedie.json geladen als die geldig is, anders de startkopie. De avatar
        is een stilstaande still, zonder zoom.
      </p>

      {loadNotice ? (
        <p className="editor-load-notice" data-testid="editor-load-notice" role="status">
          {loadNotice}
        </p>
      ) : null}
      {openError ? (
        <p className="editor-open-error" data-testid="editor-open-error" role="alert">
          Kan JSON niet openen: {openError}
        </p>
      ) : null}
      {saveError ? (
        <p className="editor-open-error" data-testid="editor-save-error" role="alert">
          {saveError}
        </p>
      ) : null}
      {saveMessage ? (
        <p className="editor-save-ok" data-testid="editor-save-ok" role="status">
          {saveMessage}
        </p>
      ) : null}

      <section
        className={`editor-issues${issues.length > 0 ? ' has-issues' : ''}`}
        data-testid="editor-issues"
        aria-live="polite"
      >
        <h2>Controle</h2>
        {issues.length === 0 ? (
          <p data-testid="editor-issues-ok">Geen validatiefouten.</p>
        ) : (
          <ul data-testid="editor-issues-list">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="editor-layout">
        <nav className="editor-nodes" aria-label="Beslissingspunten">
          <h2>Vragen</h2>
          <ol>
            {scenario.nodes.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === node?.id ? 'is-active' : undefined}
                  data-testid={`node-tab-${item.id}`}
                  onClick={() => {
                    setSelectedNodeId(item.id);
                    setPreviewOptionIndex(0);
                  }}
                >
                  {String(index + 1)}. {item.phaseLabel}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {node ? (
          <main className="editor-main" id="inhoud">
            <section className="editor-card">
              <h2>Vraag van de cliënt</h2>
              <p className="muted">Node {node.id}</p>
              <div className="field">
                <label htmlFor="prompt-text">Wat zegt de cliënt?</label>
                <textarea
                  id="prompt-text"
                  data-testid="prompt-text"
                  rows={3}
                  value={node.prompt.text}
                  onChange={(event) =>
                    updateSelected({
                      ...node,
                      prompt: { ...node.prompt, text: event.target.value },
                    })
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
                    updateSelected({
                      ...node,
                      prompt: { ...node.prompt, context: event.target.value },
                    })
                  }
                />
              </div>
            </section>

            {node.options.map((option, optionIndex) => (
              <section
                key={option.id}
                className={`editor-card option-card${previewOptionIndex === optionIndex ? ' is-previewed' : ''}`}
                data-testid={`option-editor-${option.id}`}
              >
                <div className="option-card-head">
                  <h2>Antwoord {String(optionIndex + 1)}</h2>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid={`btn-preview-option-${String(optionIndex)}`}
                    onClick={() => setPreviewOptionIndex(optionIndex)}
                  >
                    Toon gezicht
                  </button>
                </div>
                <div className="field">
                  <label htmlFor={`quality-${option.id}`}>Kwaliteit</label>
                  <select
                    id={`quality-${option.id}`}
                    data-testid={`option-quality-${option.id}`}
                    value={option.quality}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(node, optionIndex, {
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
                  <label htmlFor={`option-text-${option.id}`}>Wat zegt de student?</label>
                  <textarea
                    id={`option-text-${option.id}`}
                    data-testid={`option-text-${option.id}`}
                    rows={3}
                    value={option.text}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(node, optionIndex, { ...option, text: event.target.value }),
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor={`client-response-${option.id}`}>Reactie van de cliënt</label>
                  <textarea
                    id={`client-response-${option.id}`}
                    data-testid={`client-response-${option.id}`}
                    rows={2}
                    value={option.clientResponse.text}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(node, optionIndex, {
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
                          onChange={() => {
                            setPreviewOptionIndex(optionIndex);
                            updateSelected(
                              replaceOption(node, optionIndex, {
                                ...option,
                                emotion: face.emotion,
                              }),
                            );
                          }}
                        />
                        {face.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="field">
                  <label htmlFor={`next-${option.id}`}>Volgende stap</label>
                  <select
                    id={`next-${option.id}`}
                    data-testid={`option-next-${option.id}`}
                    value={option.nextNodeId}
                    onChange={(event) =>
                      updateSelected(
                        replaceOption(node, optionIndex, {
                          ...option,
                          nextNodeId: event.target.value,
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
          </main>
        ) : null}

        <aside className="editor-preview">
          <h2>Voorbeeld</h2>
          <p className="muted" data-testid="preview-face-label">
            {faceLabel(previewEmotion)}
          </p>
          <div className="editor-preview-stage" data-testid="editor-preview-stage">
            <LogopedieAvatar
              emotion={previewEmotion}
              heightPx={420}
              name={scenario.client.name}
              srcOverride={avatarOverride}
            />
          </div>
          <p className="muted">{previewOption?.clientResponse.text}</p>
        </aside>
      </div>

      <EditorMediaPanel
        staged={stagedMedia}
        previewPath={previewAvatarPath}
        onStage={(op) => {
          setStagedMedia((current) => {
            const without = current.filter((item) => item.relativePath !== op.relativePath);
            return [...without, op];
          });
        }}
      />
    </div>
  );
}
