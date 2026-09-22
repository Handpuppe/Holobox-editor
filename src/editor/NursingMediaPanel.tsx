import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { publicResourceUrl } from '../media/logopedie/resolveAvatar';
import {
  applyStagedNursingMedia,
  isNursingMediaPath,
  listNursingMedia,
  nursingMediaRowTestId,
  type NursingMediaItem,
  type StagedNursingMediaOp,
} from './nursingMedia';

interface NursingMediaPanelProps {
  staged: StagedNursingMediaOp[];
  onStage: (op: StagedNursingMediaOp) => void;
  previewPath: string | null;
}

function isVideoPath(relativePath: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(relativePath);
}

export function NursingMediaPanel({ staged, onStage, previewPath }: NursingMediaPanelProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<NursingMediaItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pendingReplace, setPendingReplace] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }
    let cancelled = false;
    void listNursingMedia()
      .then((list) => {
        if (!cancelled) {
          setItems(list);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Media kon niet worden geladen.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const listed = useMemo(() => applyStagedNursingMedia(items, staged), [items, staged]);
  const selected =
    listed.find((item) => item.relativePath === selectedPath) ??
    listed.find((item) => item.relativePath === previewPath) ??
    listed[0];
  const previewSrc =
    selected?.previewUrl ?? (selected ? publicResourceUrl(selected.relativePath) : null);

  function stageAdd(file: File | undefined) {
    if (!file) {
      return;
    }
    const relativePath = `verpleegkunde/${file.name}`;
    if (!isNursingMediaPath(relativePath)) {
      setLoadError('Alleen media in resources/verpleegkunde/ zijn toegestaan.');
      return;
    }
    const exists = listed.some((item) => item.relativePath === relativePath);
    onStage({
      type: exists ? 'replace' : 'add',
      relativePath,
      file,
      previewUrl: URL.createObjectURL(file),
    });
    setSelectedPath(relativePath);
  }

  function stageReplace(relativePath: string, file: File | undefined) {
    if (!file) {
      return;
    }
    if (!isNursingMediaPath(relativePath)) {
      setLoadError('Alleen media in resources/verpleegkunde/ zijn toegestaan.');
      return;
    }
    onStage({
      type: 'replace',
      relativePath,
      file,
      previewUrl: URL.createObjectURL(file),
    });
    setSelectedPath(relativePath);
  }

  return (
    <section className="editor-media" data-testid="editor-nursing-media">
      <div className="editor-media-head">
        <h2>Verpleegkunde-media</h2>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-nursing-media-add"
          onClick={() => addInputRef.current?.click()}
        >
          Toevoegen
        </button>
        <input
          ref={addInputRef}
          type="file"
          accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,.mp4,.webm,.png,.jpg,.jpeg,.webp"
          className="visually-hidden"
          data-testid="input-nursing-media-add"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            stageAdd(file);
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,.mp4,.webm,.png,.jpg,.jpeg,.webp"
          className="visually-hidden"
          data-testid="input-nursing-media-replace"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (pendingReplace) {
              stageReplace(pendingReplace, file);
            }
            setPendingReplace(null);
          }}
        />
      </div>
      <p className="muted">
        Alleen bestanden onder resources/verpleegkunde/. Logopedie-stills blijven ongewijzigd.
      </p>
      {loadError ? (
        <p className="editor-open-error" data-testid="editor-nursing-media-error" role="alert">
          {loadError}
        </p>
      ) : null}
      <div className="editor-media-layout">
        <ul className="editor-media-list" data-testid="editor-nursing-media-list">
          {listed.map((item) => (
            <li key={item.relativePath}>
              <button
                type="button"
                className={item.relativePath === selected?.relativePath ? 'is-active' : undefined}
                data-testid={nursingMediaRowTestId(item.relativePath)}
                onClick={() => setSelectedPath(item.relativePath)}
              >
                {item.relativePath}
                {item.stagedType ? ` (${item.stagedType})` : ''}
              </button>
            </li>
          ))}
        </ul>
        <div className="editor-media-preview-wrap">
          {selected && previewSrc ? (
            <>
              <div className="editor-media-preview" data-testid="editor-nursing-media-preview">
                {isVideoPath(selected.relativePath) ? (
                  <video
                    src={previewSrc}
                    className="editor-media-preview-video"
                    data-testid="editor-nursing-media-preview-video"
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
                    src={previewSrc}
                    alt={selected.relativePath}
                    className="editor-media-preview-img"
                    data-testid="editor-nursing-media-preview-image"
                  />
                )}
              </div>
              <div className="editor-media-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="btn-nursing-media-replace"
                  onClick={() => {
                    setPendingReplace(selected.relativePath);
                    replaceInputRef.current?.click();
                  }}
                >
                  Vervangen
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-testid="btn-nursing-media-delete"
                  onClick={() => setPendingDelete(selected.relativePath)}
                >
                  Verwijderen
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Geen Verpleegkunde-media geselecteerd.</p>
          )}
        </div>
      </div>

      {pendingDelete ? (
        <Dialog
          title="Media verwijderen?"
          testId="dialog-delete-nursing-media"
          onClose={() => setPendingDelete(null)}
        >
          <p>
            Verwijder {pendingDelete}? Dit geldt pas na Opslaan en blijft binnen
            resources/verpleegkunde/.
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="btn-confirm-delete-nursing-media"
              onClick={() => {
                onStage({ type: 'delete', relativePath: pendingDelete });
                setPendingDelete(null);
              }}
            >
              Verwijderen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-cancel-delete-nursing-media"
              onClick={() => setPendingDelete(null)}
            >
              Annuleren
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
