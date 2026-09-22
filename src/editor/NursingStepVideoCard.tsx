import { useMemo, useRef, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { publicResourceUrl } from '../media/logopedie/resolveAvatar';
import type { NursingScenario, NursingStep } from '../nursing/types';
import {
  assignStepPrimaryMedia,
  isNursingMediaPath,
  nursingRelativePathForFile,
  stepPrimaryMediaPath,
  unlinkDeletedNursingMedia,
  type StagedNursingMediaOp,
} from './nursingMedia';

interface NursingStepVideoCardProps {
  draft: NursingScenario;
  step: NursingStep;
  staged: StagedNursingMediaOp[];
  catalog: string[];
  onChange: (next: NursingScenario) => void;
  onStage: (op: StagedNursingMediaOp) => void;
}

function isVideoPath(relativePath: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(relativePath);
}

export function NursingStepVideoCard({
  draft,
  step,
  staged,
  catalog,
  onChange,
  onStage,
}: NursingStepVideoCardProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = stepPrimaryMediaPath(draft, step);
  const stagedOp = path ? staged.find((item) => item.relativePath === path) : undefined;
  const previewUrl = useMemo(() => {
    if (stagedOp && stagedOp.type !== 'delete') {
      return stagedOp.previewUrl;
    }
    if (stagedOp?.type === 'delete' || !path) {
      return null;
    }
    return publicResourceUrl(path);
  }, [path, stagedOp]);
  const linkedPath = stagedOp?.type === 'delete' ? null : path;
  const chooseOptions = catalog.filter((item) => isNursingMediaPath(item));

  function stageFile(relativePath: string, file: File, replace: boolean) {
    onStage({
      type: replace ? 'replace' : 'add',
      relativePath,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function replaceCurrent(file: File | undefined) {
    if (!file) {
      return;
    }
    if (linkedPath) {
      if (!isNursingMediaPath(linkedPath)) {
        setError('Alleen media in resources/verpleegkunde/ zijn toegestaan.');
        return;
      }
      setError(null);
      stageFile(linkedPath, file, true);
      return;
    }
    uploadNew(file);
  }

  function uploadNew(file: File | undefined) {
    if (!file) {
      return;
    }
    const relativePath = nursingRelativePathForFile(file.name);
    if (!relativePath) {
      setError('Alleen media in resources/verpleegkunde/ zijn toegestaan.');
      return;
    }
    setError(null);
    const exists = chooseOptions.includes(relativePath) || Boolean(linkedPath === relativePath);
    stageFile(relativePath, file, exists);
    onChange(assignStepPrimaryMedia(draft, step.id, relativePath));
  }

  return (
    <section className="editor-card" data-testid="nursing-step-video">
      <h2>Video van deze stap</h2>
      <p className="muted">
        Alleen resources/verpleegkunde/. Logopedie-bestanden blijven ongewijzigd.
      </p>
      <p className="muted" data-testid="nursing-step-video-path">
        {linkedPath ?? 'Geen video gekoppeld.'}
      </p>
      <div className="editor-media-preview" data-testid="nursing-step-video-preview">
        {linkedPath && previewUrl ? (
          isVideoPath(linkedPath) ? (
            <video
              src={previewUrl}
              className="editor-media-preview-video"
              data-testid="nursing-step-video-player"
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
              src={previewUrl}
              alt={linkedPath}
              className="editor-media-preview-img"
              data-testid="nursing-step-video-image"
            />
          )
        ) : (
          <p className="muted" data-testid="nursing-step-video-missing">
            Geen video. Kies of upload een bestand vóór Opslaan.
          </p>
        )}
      </div>
      {error ? (
        <p className="editor-open-error" data-testid="nursing-step-video-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="nursing-step-choose-video">Kies bestaande video</label>
        <select
          id="nursing-step-choose-video"
          data-testid="nursing-step-choose-video"
          value={linkedPath ?? ''}
          onChange={(event) => {
            const next = event.target.value;
            setError(null);
            onChange(assignStepPrimaryMedia(draft, step.id, next || null));
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
          data-testid="btn-nursing-step-replace"
          onClick={() => replaceInputRef.current?.click()}
        >
          {linkedPath ? 'Vervangen' : 'Uploaden'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-nursing-step-upload"
          onClick={() => uploadInputRef.current?.click()}
        >
          Nieuwe video koppelen
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-nursing-step-unlink"
          disabled={!linkedPath}
          onClick={() => {
            setError(null);
            onChange(assignStepPrimaryMedia(draft, step.id, null));
          }}
        >
          Ontkoppelen
        </button>
        <button
          type="button"
          className="btn btn-danger"
          data-testid="btn-nursing-step-delete"
          disabled={!linkedPath}
          onClick={() => setPendingDelete(true)}
        >
          Verwijderen
        </button>
        <input
          ref={replaceInputRef}
          type="file"
          accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,.mp4,.webm,.png,.jpg,.jpeg,.webp"
          className="visually-hidden"
          data-testid="input-nursing-step-replace"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            replaceCurrent(file);
          }}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,.mp4,.webm,.png,.jpg,.jpeg,.webp"
          className="visually-hidden"
          data-testid="input-nursing-step-upload"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            uploadNew(file);
          }}
        />
      </div>

      {pendingDelete && linkedPath ? (
        <Dialog
          title="Video verwijderen?"
          testId="dialog-delete-nursing-step-media"
          onClose={() => setPendingDelete(false)}
        >
          <p>
            Verwijder {linkedPath}? Dit geldt pas na Opslaan, blijft binnen
            resources/verpleegkunde/, en ontkoppelt stappen die dit bestand gebruiken.
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="btn-confirm-delete-nursing-step-media"
              onClick={() => {
                onStage({ type: 'delete', relativePath: linkedPath });
                onChange(unlinkDeletedNursingMedia(draft, linkedPath));
                setPendingDelete(false);
              }}
            >
              Verwijderen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-cancel-delete-nursing-step-media"
              onClick={() => setPendingDelete(false)}
            >
              Annuleren
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
