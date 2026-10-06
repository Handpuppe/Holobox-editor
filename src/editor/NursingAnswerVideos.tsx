import { useMemo, useRef, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { publicResourceUrl } from '../media/logopedie/resolveAvatar';
import type { NursingScenario, NursingStep } from '../nursing/types';
import {
  ANSWER_VIDEO_LABELS,
  ANSWER_VIDEO_QUALITIES,
  assignAnswerVideo,
  optionForQuality,
  optionPrimaryMediaPath,
  saveAnswerPlaceholder,
  setAnswerVideoMode,
  type AnswerVideoQuality,
} from './nursingAnswerMedia';
import {
  isNursingMediaPath,
  isOwnedQuestionVideo,
  saveNursingMediaOp,
  unlinkDeletedNursingMedia,
  type StagedNursingMediaOp,
} from './nursingMedia';
import { questionVideoRelative, resolvedQuestionFolder } from './questionFolder';
import { placeholderDraft, syncPlaceholderDraft } from './placeholderDraft';

interface NursingAnswerVideosProps {
  draft: NursingScenario;
  step: NursingStep;
  staged: StagedNursingMediaOp[];
  catalog: string[];
  onChange: (next: NursingScenario) => void;
  onStage: (op: StagedNursingMediaOp) => void;
  quality?: AnswerVideoQuality;
  /** In Bewerken blijft het bestand staan tot Opslaan. */
  deferFileDelete?: boolean;
}

function isVideoPath(relativePath: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(relativePath);
}

function AnswerVideoPlace({
  draft,
  step,
  quality,
  staged,
  catalog,
  onChange,
  onStage,
  deferFileDelete = false,
}: NursingAnswerVideosProps & { quality: AnswerVideoQuality }) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [pendingPlaceholder, setPendingPlaceholder] = useState(false);
  const option = optionForQuality(step, quality);
  const linkedPath = optionPrimaryMediaPath(draft, option);
  const stagedOp = linkedPath ? staged.find((item) => item.relativePath === linkedPath) : undefined;
  const previewUrl = useMemo(() => {
    if (stagedOp && stagedOp.type !== 'delete') {
      return stagedOp.previewUrl;
    }
    if (stagedOp?.type === 'delete' || !linkedPath) {
      return null;
    }
    return publicResourceUrl(linkedPath);
  }, [linkedPath, stagedOp]);
  const shownPath = stagedOp?.type === 'delete' ? null : linkedPath;
  const mode = option?.answerVideoMode ?? (shownPath ? 'video' : null);
  const storedPlaceholder = option?.videoPlaceholder ?? '';
  const optionKey = option?.id ?? quality;
  const [placeholderState, setPlaceholderState] = useState(() =>
    placeholderDraft(optionKey, storedPlaceholder),
  );
  const syncedPlaceholder = syncPlaceholderDraft(placeholderState, optionKey, storedPlaceholder);
  if (syncedPlaceholder) {
    setPlaceholderState(syncedPlaceholder);
  }
  const placeholderField = syncedPlaceholder ?? placeholderState;
  const [error, setError] = useState<string | null>(null);
  const questionFolder = resolvedQuestionFolder(draft.meta.title, step);
  const uploadPath = questionVideoRelative(questionFolder, quality);
  const chooseOptions = catalog.filter((item) => isNursingMediaPath(item));
  const placeholderDraftText = placeholderField.text;
  const savedNote = placeholderField.saved;

  async function confirmPlaceholder() {
    const path = shownPath;
    setPendingPlaceholder(false);
    if (!path || !option) {
      return;
    }
    if (isOwnedQuestionVideo(path) && !deferFileDelete) {
      try {
        await saveNursingMediaOp({ type: 'delete', relativePath: path });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Verwijderen van de video is mislukt.');
        return;
      }
    }
    onStage({ type: 'delete', relativePath: path });
    onChange(
      setAnswerVideoMode(unlinkDeletedNursingMedia(draft, path), step.id, quality, 'placeholder'),
    );
  }

  function stageFile(relativePath: string, file: File, replace: boolean) {
    onStage({
      type: replace ? 'replace' : 'add',
      relativePath,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function uploadNew(file: File | undefined) {
    if (!file || !option) {
      return;
    }
    const relativePath = uploadPath;
    if (!relativePath) {
      setError('Alleen video onder resources/gesprekstechnieken/ is toegestaan.');
      return;
    }
    setError(null);
    const exists = chooseOptions.includes(relativePath) || shownPath === relativePath;
    stageFile(relativePath, file, exists);
    const linked = assignAnswerVideo(draft, step.id, quality, relativePath);
    onChange({
      ...linked,
      steps: linked.steps.map((item) =>
        item.id === step.id && item.questionFolder !== questionFolder
          ? { ...item, questionFolder }
          : item,
      ),
    });
  }

  function replaceCurrent(file: File | undefined) {
    if (!file) {
      return;
    }
    if (shownPath) {
      if (!isNursingMediaPath(shownPath)) {
        setError('Alleen video onder resources/gesprekstechnieken/ is toegestaan.');
        return;
      }
      setError(null);
      stageFile(shownPath, file, true);
      onChange(setAnswerVideoMode(draft, step.id, quality, 'video'));
      return;
    }
    uploadNew(file);
  }

  if (!option) {
    return (
      <section className="editor-card" data-testid={`nursing-answer-video-${quality}`}>
        <h2>{ANSWER_VIDEO_LABELS[quality]}</h2>
        <p className="muted">Deze vraag heeft geen antwoord van deze kwaliteit.</p>
      </section>
    );
  }

  return (
    <section className="editor-card" data-testid={`nursing-answer-video-${quality}`}>
      <h2>{ANSWER_VIDEO_LABELS[quality]}</h2>
      <fieldset className="face-picker">
        <legend>Video of placeholder</legend>
        <div className="face-options">
          <label className="face-option">
            <input
              type="radio"
              name={`answer-video-mode-${step.id}-${quality}`}
              checked={mode === 'video'}
              data-testid={`nursing-answer-mode-video-${quality}`}
              onChange={() => {
                setError(null);
                onChange(setAnswerVideoMode(draft, step.id, quality, 'video'));
              }}
            />
            Video
          </label>
          <label className="face-option">
            <input
              type="radio"
              name={`answer-video-mode-${step.id}-${quality}`}
              checked={mode === 'placeholder'}
              data-testid={`nursing-answer-mode-placeholder-${quality}`}
              onChange={() => {
                setError(null);
                if (shownPath) {
                  setPendingPlaceholder(true);
                  return;
                }
                onChange(setAnswerVideoMode(draft, step.id, quality, 'placeholder'));
              }}
            />
            Placeholder
          </label>
        </div>
      </fieldset>

      {mode === 'placeholder' ? (
        <div className="field">
          <label htmlFor={`nursing-answer-placeholder-${quality}`}>
            Welke video moet nog komen?
          </label>
          <textarea
            id={`nursing-answer-placeholder-${quality}`}
            data-testid={`nursing-answer-placeholder-${quality}`}
            rows={3}
            value={placeholderDraftText}
            onChange={(event) => {
              const text = event.target.value;
              setPlaceholderState((current) => ({ ...current, text, saved: false }));
              onChange(saveAnswerPlaceholder(draft, step.id, quality, text));
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            data-testid={`btn-nursing-answer-placeholder-save-${quality}`}
            onClick={() => {
              onChange(saveAnswerPlaceholder(draft, step.id, quality, placeholderDraftText));
              setPlaceholderState((current) => ({ ...current, saved: true }));
            }}
          >
            Opslaan
          </button>
          {savedNote ? (
            <p
              className="editor-save-ok"
              data-testid={`nursing-answer-placeholder-saved-${quality}`}
            >
              Placeholdertekst staat in deze vraag.
            </p>
          ) : null}
          <div
            className="editor-media-preview video-placeholder-stage"
            data-testid={`nursing-answer-placeholder-preview-${quality}`}
          >
            <p>{placeholderDraftText.trim()}</p>
          </div>
        </div>
      ) : null}

      {mode === 'video' ? (
        <>
          <p className="muted" data-testid={`nursing-answer-upload-target-${quality}`}>
            {uploadPath
              ? `Nieuwe upload: resources/${uploadPath}`
              : 'Alleen video onder resources/gesprekstechnieken/ is toegestaan.'}
          </p>
          <p className="muted" data-testid={`nursing-answer-video-path-${quality}`}>
            {shownPath ?? 'Geen video gekoppeld.'}
          </p>
          {shownPath && previewUrl ? (
            isVideoPath(shownPath) ? (
              <video
                src={previewUrl}
                className="editor-media-preview-video"
                data-testid={`nursing-answer-video-player-${quality}`}
                controls
                playsInline
                preload="metadata"
              >
                <track kind="captions" srcLang="nl" label="Nederlands" src="data:text/vtt,WEBVTT" />
              </video>
            ) : (
              <img
                src={previewUrl}
                alt={shownPath}
                className="editor-media-preview-img"
                data-testid={`nursing-answer-video-image-${quality}`}
              />
            )
          ) : (
            <p className="muted" data-testid={`nursing-answer-video-missing-${quality}`}>
              Geen video gekoppeld.
            </p>
          )}
          {error ? (
            <p className="editor-open-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor={`nursing-answer-choose-${quality}`}>Kies bestaande video</label>
            <select
              id={`nursing-answer-choose-${quality}`}
              data-testid={`nursing-answer-choose-${quality}`}
              value={shownPath ?? ''}
              onChange={(event) => {
                const next = event.target.value;
                setError(null);
                onChange(assignAnswerVideo(draft, step.id, quality, next || null));
              }}
            >
              <option value="">Geen</option>
              {chooseOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="editor-media-actions">
            <button
              type="button"
              className="btn btn-secondary"
              data-testid={`btn-nursing-answer-replace-${quality}`}
              onClick={() => replaceInputRef.current?.click()}
            >
              {shownPath ? 'Vervangen' : 'Uploaden'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid={`btn-nursing-answer-upload-${quality}`}
              onClick={() => uploadInputRef.current?.click()}
            >
              Nieuwe video koppelen
            </button>
            <input
              ref={replaceInputRef}
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              className="visually-hidden"
              data-testid={`input-nursing-answer-replace-${quality}`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                replaceCurrent(file);
              }}
            />
            <input
              ref={uploadInputRef}
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              className="visually-hidden"
              data-testid={`input-nursing-answer-upload-${quality}`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                uploadNew(file);
              }}
            />
          </div>
        </>
      ) : null}
      {pendingPlaceholder && shownPath ? (
        <Dialog
          title="Video verwijderen?"
          testId={`dialog-placeholder-delete-${quality}`}
          onClose={() => setPendingPlaceholder(false)}
        >
          <p>
            De video wordt verwijderd
            {isOwnedQuestionVideo(shownPath) ? ` uit resources/${shownPath}` : ''}. Opnieuw een
            video kiezen betekent opnieuw uploaden.
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-danger"
              data-testid={`btn-confirm-placeholder-delete-${quality}`}
              onClick={() => {
                void confirmPlaceholder();
              }}
            >
              Verwijderen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid={`btn-cancel-placeholder-delete-${quality}`}
              onClick={() => setPendingPlaceholder(false)}
            >
              Annuleren
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

export function NursingAnswerVideos(props: NursingAnswerVideosProps) {
  const qualities = props.quality ? [props.quality] : ANSWER_VIDEO_QUALITIES;
  return (
    <>
      {qualities.map((quality) => (
        <AnswerVideoPlace
          key={`${props.step.id}-${quality}`}
          {...props}
          quality={quality}
          deferFileDelete={props.deferFileDelete}
        />
      ))}
    </>
  );
}
